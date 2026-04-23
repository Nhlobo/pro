import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Returns the Document Vault entries (documents table) that belong to the
 * referring attorney associated with the given access code. This powers the
 * "Supporting Documents" view in the public Case Access portal — attorneys
 * cannot read the documents table directly because anonymous access is
 * blocked by RLS.
 */
Deno.serve(async (req) => {
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

    // Resolve the referring attorney from the access code
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

    // Fetch documents from the Document Vault scoped to this attorney.
    // We expose the safe attorney-facing fields only.
    const { data: docs, error: docsError } = await supabase
      .from("documents")
      .select(
        `id, file_name, file_path, file_type, file_size, document_type,
         upload_date, upload_time, notes, claimant_id, appointment_id,
         approval_status, is_visible_to_attorney`,
      )
      .eq("referring_attorney_id", referringAttorneyId)
      .eq("is_visible_to_attorney", true)
      .order("upload_date", { ascending: false })
      .limit(2000);

    if (docsError) {
      return new Response(
        JSON.stringify({ error: docsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Enrich with claimant names so the UI can show them
    const claimantIds = Array.from(
      new Set((docs ?? []).map((d) => d.claimant_id).filter(Boolean)),
    ) as string[];

    let claimantMap: Record<string, string> = {};
    if (claimantIds.length > 0) {
      const { data: claimants } = await supabase
        .from("claimants")
        .select("id, first_name, last_name")
        .in("id", claimantIds);
      claimantMap = Object.fromEntries(
        (claimants ?? []).map((c) => [c.id, `${c.first_name} ${c.last_name}`.trim()]),
      );
    }

    // Generate signed URLs (1h) so the attorney can download without auth
    const enriched = await Promise.all(
      (docs ?? []).map(async (d) => {
        let signed_url: string | null = null;
        if (d.file_path) {
          const { data: signed } = await supabase.storage
            .from("attorney-documents")
            .createSignedUrl(d.file_path, 3600);
          if (!signed?.signedUrl) {
            const { data: alt } = await supabase.storage
              .from("documents")
              .createSignedUrl(d.file_path, 3600);
            signed_url = alt?.signedUrl ?? null;
          } else {
            signed_url = signed.signedUrl;
          }
        }
        return {
          ...d,
          claimant_name: d.claimant_id ? (claimantMap[d.claimant_id] ?? null) : null,
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
});
