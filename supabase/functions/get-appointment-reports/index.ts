import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withErrorHandler } from "../_shared/errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Returns report documents linked to a specific appointment for the
 * referring attorney associated with the given access code.
 *
 * Used by the public Case Access portal "View All Cases" tab so the attorney
 * can download reports that were uploaded against their scheduled
 * assessment appointments — past, current, and future.
 */
Deno.serve(withErrorHandler(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { access_code, appointment_id } = await req.json();
    if (!access_code || typeof access_code !== "string" || !access_code.trim()) {
      return new Response(
        JSON.stringify({ error: "Access code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!appointment_id || typeof appointment_id !== "string") {
      return new Response(
        JSON.stringify({ error: "Appointment id is required" }),
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

    // Verify the appointment belongs to this attorney
    const { data: apt, error: aptErr } = await supabase
      .from("appointments")
      .select("id, referring_attorney_id")
      .eq("id", appointment_id)
      .maybeSingle();

    if (aptErr || !apt || apt.referring_attorney_id !== referringAttorneyId) {
      return new Response(
        JSON.stringify({ error: "Appointment not accessible" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch report documents linked to this appointment from the Document Vault.
    // Includes past (already submitted), current, and future reports as they are
    // uploaded by the admin/expert team.
    const { data: docs, error: docsError } = await supabase
      .from("documents")
      .select(
        `id, file_name, file_path, file_type, file_size, document_type,
         upload_date, upload_time, notes, approval_status`,
      )
      .eq("appointment_id", appointment_id)
      .eq("referring_attorney_id", referringAttorneyId)
      .eq("is_visible_to_attorney", true)
      .ilike("document_type", "%report%")
      .order("upload_date", { ascending: false });

    if (docsError) {
      return new Response(
        JSON.stringify({ error: docsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generate signed URLs (7 days) so the attorney can download without auth and the browser can cache the file
    const enriched = await Promise.all(
      (docs ?? []).map(async (d) => {
        let signed_url: string | null = null;
        if (d.file_path) {
          const { data: signed } = await supabase.storage
            .from("attorney-documents")
            .createSignedUrl(d.file_path, 604800);
          if (!signed?.signedUrl) {
            const { data: alt } = await supabase.storage
              .from("documents")
              .createSignedUrl(d.file_path, 604800);
            signed_url = alt?.signedUrl ?? null;
          } else {
            signed_url = signed.signedUrl;
          }
        }
        return { ...d, signed_url };
      }),
    );

    return new Response(
      JSON.stringify({ reports: enriched, total: enriched.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}));
