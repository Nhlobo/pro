import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { access_code, requests } = body;

    // Validate access code
    if (!access_code || typeof access_code !== "string" || access_code.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Access code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one request is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseKey);

    // Validate the access code
    const { data: codeData, error: codeError } = await adminClient
      .from("attorney_access_codes")
      .select("id, referring_attorney_id, is_active")
      .eq("access_code", access_code.trim())
      .maybeSingle();

    if (codeError || !codeData) {
      return new Response(
        JSON.stringify({ error: "Invalid access code." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!codeData.is_active) {
      return new Response(
        JSON.stringify({ error: "This access code has been deactivated." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch attorney info
    const { data: attorney } = await adminClient
      .from("referring_attorneys")
      .select("id, name, email")
      .eq("id", codeData.referring_attorney_id)
      .maybeSingle();

    if (!attorney) {
      return new Response(
        JSON.stringify({ error: "Attorney not found." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const insertedIds: string[] = [];

    for (const req of requests) {
      // Basic validation per request
      const claimantFirstName = (req.claimant_first_name || "").trim();
      const claimantLastName = (req.claimant_last_name || "").trim();

      if (!claimantFirstName) {
        continue; // Skip invalid entries
      }

      const { data: inserted, error: insertError } = await adminClient
        .from("appointment_requests")
        .insert({
          claimant_first_name: claimantFirstName.substring(0, 200),
          claimant_last_name: claimantLastName.substring(0, 200),
          expert_type_requested: (req.expert_type_requested || "To be determined").substring(0, 200),
          matter_type: (req.matter_type || "To be determined").substring(0, 200),
          province: (req.province || "To be determined").substring(0, 200),
          preferred_date_type: req.preferred_date_type || "any_date",
          suggested_date: req.suggested_date || null,
          is_minor: req.is_minor || false,
          guardian_name: req.guardian_name || null,
          additional_notes: (req.additional_notes || "").substring(0, 5000) || null,
          referring_attorney_id: attorney.id,
          referring_attorney_name: attorney.name,
          attorney_email: attorney.email || null,
          requested_by: attorney.id,
          status: "pending",
        })
        .select("id")
        .single();

      if (!insertError && inserted) {
        insertedIds.push(inserted.id);
      } else {
        console.error("Insert error:", insertError);
      }
    }

    console.log(`Inserted ${insertedIds.length} appointment requests for attorney ${attorney.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        inserted_count: insertedIds.length,
        ids: insertedIds,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in submit-appointment-request:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
