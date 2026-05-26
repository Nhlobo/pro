import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Row {
  id: string;
  law_firm_name: string | null;
  province: string | null;
  sales_person: string | null;
  created_at: string;
}

const norm = (s: string | null) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
const EXCLUDED_CONSULTANTS = new Set(["in-house", "kutlwano associate", "kutlwano"]);

function coachingTips(province: string, firms: string[]): string {
  return [
    `Coaching note for ${province}:`,
    `• Before pitching, search the Pitchlog by Province + Law Firm Name to confirm no other consultant has logged the firm.`,
    `• Plan your weekly route by province — divide territories with your team so two consultants don't overlap on the same firms.`,
    `• Use the Province Coverage view to spot under-covered provinces and shift focus there instead of duplicating effort.`,
    `• When a firm shows status "Pitched" or "Re-pitched" by another consultant, coordinate via internal chat before re-engaging.`,
    `• Set follow-up dates immediately after a pitch so the firm is visibly owned and won't be re-pitched by colleagues.`,
    firms.length > 1 ? `• Conflicting firm(s): ${firms.slice(0, 5).join(", ")}${firms.length > 5 ? "…" : ""}.` : "",
  ].filter(Boolean).join("\n");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const since = body.since || "2026-03-01";
    const dryRun = !!body.dryRun;

    // Fetch all pitchlog entries since the cutoff (page through to avoid 1000-row cap)
    const rows: Row[] = [];
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("attorney_pitchlog")
        .select("id, law_firm_name, province, sales_person, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      rows.push(...(data as Row[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }

    // Group by normalized firm + province
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      const firm = norm(r.law_firm_name);
      const prov = norm(r.province);
      const person = (r.sales_person || "").trim();
      if (!firm || !prov || !person) continue;
      if (EXCLUDED_CONSULTANTS.has(person.toLowerCase())) continue;
      const k = `${firm}||${prov}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }

    // Per-consultant aggregation of their conflicts
    type ConsultantPack = {
      name: string;
      provinceMap: Map<string, Set<string>>; // province -> firms
      conflicts: Array<{ firm: string; province: string; owner: string; ownerAt: string; recordId: string }>;
    };
    const perConsultant = new Map<string, ConsultantPack>();

    let conflictGroupCount = 0;
    for (const [, entries] of groups) {
      const distinctPeople = Array.from(new Set(entries.map(e => (e.sales_person || "").trim())));
      if (distinctPeople.length < 2) continue;
      conflictGroupCount++;
      const sorted = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const owner = sorted[0];
      const ownerName = (owner.sales_person || "").trim();
      const firmDisplay = owner.law_firm_name || "";
      const provDisplay = owner.province || "";

      // Each distinct consultant in this group is involved — they all need to know
      for (const person of distinctPeople) {
        if (!perConsultant.has(person)) {
          perConsultant.set(person, { name: person, provinceMap: new Map(), conflicts: [] });
        }
        const pack = perConsultant.get(person)!;
        if (!pack.provinceMap.has(provDisplay)) pack.provinceMap.set(provDisplay, new Set());
        pack.provinceMap.get(provDisplay)!.add(firmDisplay);
        pack.conflicts.push({
          firm: firmDisplay,
          province: provDisplay,
          owner: ownerName,
          ownerAt: owner.created_at,
          recordId: owner.id,
        });
      }
    }

    // Resolve consultant profiles
    const names = Array.from(perConsultant.keys());
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email");
    const findProfile = (name: string) =>
      (allProfiles || []).find(p =>
        `${p.first_name || ""} ${p.last_name || ""}`.trim().toLowerCase() === name.toLowerCase()
      );

    const results: Array<{ consultant: string; conflicts: number; notified: boolean; email?: string }> = [];

    for (const name of names) {
      const pack = perConsultant.get(name)!;
      const profile = findProfile(name);
      if (!profile?.id || !profile?.email) {
        results.push({ consultant: name, conflicts: pack.conflicts.length, notified: false });
        continue;
      }

      // Build summary
      const provinces = Array.from(pack.provinceMap.keys()).sort();
      const summaryLines: string[] = [];
      summaryLines.push(`Conflict scan from ${since} to date found ${pack.conflicts.length} attorney pitch(es) that overlap with other consultants.`);
      summaryLines.push("");
      summaryLines.push("Conflicting firms by province:");
      for (const p of provinces) {
        const firms = Array.from(pack.provinceMap.get(p)!);
        summaryLines.push(`• ${p}: ${firms.slice(0, 8).join(", ")}${firms.length > 8 ? ` …(+${firms.length - 8} more)` : ""}`);
      }
      summaryLines.push("");
      // Province-specific coaching for the consultant's most-conflicted province
      const topProvince = provinces.sort((a, b) =>
        (pack.provinceMap.get(b)!.size) - (pack.provinceMap.get(a)!.size)
      )[0];
      summaryLines.push(coachingTips(topProvince || "your province", Array.from(pack.provinceMap.get(topProvince!) || [])));

      const title = `Pitchlog Conflict Review (${pack.conflicts.length} firm${pack.conflicts.length === 1 ? "" : "s"})`;
      const message = summaryLines.join("\n").slice(0, 1900);

      if (dryRun) {
        results.push({ consultant: name, conflicts: pack.conflicts.length, notified: false, email: profile.email });
        continue;
      }

      try {
        await supabase.functions.invoke("send-notification", {
          body: {
            type: "general",
            userId: profile.id,
            userEmail: profile.email,
            title,
            message,
            category: "pitchlog_conflict_backfill",
            relatedTable: "attorney_pitchlog",
            sendEmail: true,
          },
        });
        results.push({ consultant: name, conflicts: pack.conflicts.length, notified: true, email: profile.email });
      } catch (e) {
        console.error("notify failed for", name, e);
        results.push({ consultant: name, conflicts: pack.conflicts.length, notified: false, email: profile.email });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        since,
        scannedRows: rows.length,
        conflictGroups: conflictGroupCount,
        consultantsAffected: names.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("backfill-pitchlog-conflicts error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
