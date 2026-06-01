import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withErrorHandler } from "../_shared/errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Returns Document Vault entries (documents table) belonging to the
 * referring attorney associated with the given access code.
 *
 * Matching strategy (per product requirement):
 *   - Resolve the attorney from the access code.
 *   - Pull every claimant linked to that attorney (claimants.referring_attorney_id).
 *   - Return all vault documents whose claimant_id is in that set, OR whose
 *     documents.referring_attorney_id matches directly.
 *   - Each document is enriched with the claimant's full name and ID code
 *     (claimants.auto_id), and the document's approval_status is exposed so
 *     the attorney can see Approved / Pending / Rejected next to each item.
 */
Deno.serve(withErrorHandler(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { access_code } = await req.json();
    if (!access_code || typeof access_code !== "string" || !access_code.trim()) {
      return new Response(
        JSON.stringify({ error: "Access code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Resolve the referring attorney from the access code
    const { data: codeData, error: codeError } = await supabase
      .from("attorney_access_codes")
      .select("referring_attorney_id, is_active")
      .eq("access_code", access_code.trim())
      .single();

    if (codeError || !codeData) {
      return new Response(
        JSON.stringify({ error: "Invalid access code" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!codeData.is_active) {
      return new Response(
        JSON.stringify({ error: "Access code is no longer active" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const referringAttorneyId = codeData.referring_attorney_id;

    // 2. Build the set of claimants belonging to this attorney
    const { data: attorneyClaimants, error: claimantsError } = await supabase
      .from("claimants")
      .select("id, auto_id, first_name, last_name")
      .eq("referring_attorney_id", referringAttorneyId);

    if (claimantsError) {
      return new Response(
        JSON.stringify({ error: claimantsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const claimantIds = (attorneyClaimants ?? []).map((c) => c.id);
    const claimantMap: Record<string, { full_name: string; auto_id: string | null }> =
      Object.fromEntries(
        (attorneyClaimants ?? []).map((c) => [
          c.id,
          {
            full_name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
            auto_id: c.auto_id ?? null,
          },
        ]),
      );

    // 3. Fetch documents from Document Vault matching either the attorney
    //    directly OR any claimant linked to the attorney. We use an `or`
    //    filter so a single round-trip captures both buckets.
    const orParts: string[] = [`referring_attorney_id.eq.${referringAttorneyId}`];
    if (claimantIds.length > 0) {
      orParts.push(`claimant_id.in.(${claimantIds.join(",")})`);
    }

    const { data: docs, error: docsError } = await supabase
      .from("documents")
      .select(
        `id, file_name, file_path, file_type, file_size, document_type,
         upload_date, upload_time, notes, claimant_id, appointment_id,
         approval_status, is_visible_to_attorney`,
      )
      .or(orParts.join(","))
      .eq("is_visible_to_attorney", true)
      .order("upload_date", { ascending: false })
      .limit(2000);

    if (docsError) {
      return new Response(
        JSON.stringify({ error: docsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Lookup any extra claimants referenced by docs that don't belong to
    //    this attorney's primary list (e.g. legacy linkage).
    const extraIds = Array.from(
      new Set(
        (docs ?? [])
          .map((d) => d.claimant_id)
          .filter((id): id is string => !!id && !claimantMap[id]),
      ),
    );
    if (extraIds.length > 0) {
      const { data: extras } = await supabase
        .from("claimants")
        .select("id, auto_id, first_name, last_name")
        .in("id", extraIds);
      (extras ?? []).forEach((c) => {
        claimantMap[c.id] = {
          full_name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
          auto_id: c.auto_id ?? null,
        };
      });
    }

    // 5. Generate signed URLs for downloads
    const enriched = await Promise.all(
      (docs ?? []).map(async (d) => {
        let signed_url: string | null = null;
        if (d.file_path) {
          const { data: signed } = await supabase.storage
            .from("attorney-documents")
            .createSignedUrl(d.file_path, 604800); // 7 days — enables browser cache reuse
          if (signed?.signedUrl) {
            signed_url = signed.signedUrl;
          } else {
            const { data: alt } = await supabase.storage
              .from("documents")
              .createSignedUrl(d.file_path, 604800);
            signed_url = alt?.signedUrl ?? null;
          }
        }
        const claimantInfo = d.claimant_id ? claimantMap[d.claimant_id] : null;
        return {
          ...d,
          claimant_name: claimantInfo?.full_name ?? null,
          claimant_auto_id: claimantInfo?.auto_id ?? null,
          signed_url,
        };
      }),
    );

    return new Response(
      JSON.stringify({ documents: enriched, total: enriched.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}));
