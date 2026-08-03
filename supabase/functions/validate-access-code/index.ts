import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withErrorHandler } from "../_shared/errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(withErrorHandler(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { access_code } = await req.json();

    if (!access_code || typeof access_code !== "string" || access_code.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Access code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate the access code
    const { data: codeData, error: codeError } = await supabase
      .from("attorney_access_codes")
      .select("id, referring_attorney_id, appointment_id, is_active, access_count")
      .eq("access_code", access_code.trim())
      .single();

    if (codeError || !codeData) {
      return new Response(
        JSON.stringify({ error: "Invalid access code. Please check and try again." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!codeData.is_active) {
      return new Response(
        JSON.stringify({ error: "This access code has expired. The case has been paid in full and the report has been delivered." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update access tracking
    await supabase
      .from("attorney_access_codes")
      .update({
        last_accessed_at: new Date().toISOString(),
        access_count: (codeData.access_count || 0) + 1,
      })
      .eq("id", codeData.id);

    // Fetch attorney info
    const { data: attorney } = await supabase
      .from("referring_attorneys")
      .select("id, name, code, contact_person")
      .eq("id", codeData.referring_attorney_id)
      .single();

    // Fetch ALL appointments for this referring attorney (not just the one linked to the code)
    const { data: appointments } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        case_status,
        payment_status,
        matter_type,
        service_fee,
        deposit_amount,
        created_at,
        claimant_id,
        expert_id
      `)
      .eq("referring_attorney_id", codeData.referring_attorney_id)
      .is("deleted_at", null)
      .order("appointment_date", { ascending: false });

    if (!appointments || appointments.length === 0) {
      return new Response(
        JSON.stringify({
          attorney: attorney || null,
          cases: [],
          message: "No cases found for this attorney.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch claimant names
    const claimantIds = [...new Set(appointments.map((a) => a.claimant_id))];
    const { data: claimants } = await supabase
      .from("claimants")
      .select("id, first_name, last_name")
      .in("id", claimantIds);

    const claimantMap = new Map(
      (claimants || []).map((c) => [c.id, `${c.first_name} ${c.last_name}`])
    );

    // Fetch expert names
    const expertIds = [...new Set(appointments.map((a) => a.expert_id))];
    const { data: experts } = await supabase
      .from("medical_experts")
      .select("id, first_name, last_name, expert_type")
      .in("id", expertIds);

    const expertMap = new Map(
      (experts || []).map((e) => [e.id, { name: `${e.first_name || ''} ${e.last_name || ''}`.trim(), type: e.expert_type }])
    );

    // Fetch report statuses for these appointments
    const appointmentIds = appointments.map((a) => a.id);
    const { data: reports } = await supabase
      .from("expert_reports")
      .select("appointment_id, report_status, report_submitted_date")
      .in("appointment_id", appointmentIds);

    const reportMap = new Map(
      (reports || []).map((r) => [
        r.appointment_id,
        { status: r.report_status, submitted_date: r.report_submitted_date },
      ])
    );

    // Build response
    const cases = appointments.map((apt) => {
      const expert = expertMap.get(apt.expert_id);
      const report = reportMap.get(apt.id);
      return {
        id: apt.id,
        claimant_name: claimantMap.get(apt.claimant_id) || "Unknown",
        appointment_date: apt.appointment_date,
        case_status: apt.case_status || "Scheduled",
        payment_status: apt.payment_status || "Pending",
        matter_type: apt.matter_type || "N/A",
        expert_name: expert?.name || "Not assigned",
        expert_type: expert?.type || "N/A",
        report_status: report?.status || "Pending",
        report_submitted_date: report?.submitted_date || null,
        service_fee: apt.service_fee || 0,
        deposit_amount: apt.deposit_amount || 0,
      };
    });

    return new Response(
      JSON.stringify({
        attorney: {
          id: attorney?.id || "",
          name: attorney?.name || "Unknown",
          code: attorney?.code || "",
          contact_person: attorney?.contact_person || "",
        },
        cases,
        total_cases: cases.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error validating access code:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
