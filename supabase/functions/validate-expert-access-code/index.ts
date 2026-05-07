import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { access_code, action, appointment_id, decline_reason, notes } = body;

    if (!access_code || typeof access_code !== "string" || access_code.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Access code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate the expert access code
    const { data: codeData, error: codeError } = await supabase
      .from("expert_access_codes")
      .select("id, expert_id, appointment_id, is_active, access_count, expires_at")
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
        JSON.stringify({ error: "This access code has expired. The matter has been closed — report delivered and payment received." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check 1-year expiry
    if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
      await supabase
        .from("expert_access_codes")
        .update({ is_active: false, deactivated_at: new Date().toISOString(), deactivation_reason: "Expired after 1 year" })
        .eq("id", codeData.id);

      return new Response(
        JSON.stringify({ error: "This access code has expired after 1 year. Please contact Kutlwano & Associates for a new code." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update access tracking
    await supabase
      .from("expert_access_codes")
      .update({
        last_accessed_at: new Date().toISOString(),
        access_count: (codeData.access_count || 0) + 1,
      })
      .eq("id", codeData.id);

    // ============ HANDLE ACTIONS ============
    if (action === "accept_appointment" && appointment_id) {
      await supabase
        .from("appointments")
        .update({ case_status: "confirmed" })
        .eq("id", appointment_id)
        .eq("expert_id", codeData.expert_id);

      await supabase.from("audit_logs").insert({
        action_type: "expert_accept_appointment",
        table_name: "appointments",
        record_id: appointment_id,
        function_area: "expert_portal",
        description: `Expert accepted appointment via access code`,
        user_id: codeData.expert_id,
      });

      return new Response(
        JSON.stringify({ success: true, message: "Appointment accepted successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "decline_appointment" && appointment_id) {
      await supabase
        .from("appointments")
        .update({ case_status: "expert declined" })
        .eq("id", appointment_id)
        .eq("expert_id", codeData.expert_id);

      await supabase.from("audit_logs").insert({
        action_type: "expert_decline_appointment",
        table_name: "appointments",
        record_id: appointment_id,
        function_area: "expert_portal",
        description: `Expert declined appointment: ${decline_reason || 'No reason provided'}`,
        user_id: codeData.expert_id,
      });

      return new Response(
        JSON.stringify({ success: true, message: "Appointment declined" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "add_notes" && appointment_id && notes) {
      await supabase.from("audit_logs").insert({
        action_type: "expert_case_note",
        table_name: "appointments",
        record_id: appointment_id,
        function_area: "expert_portal",
        description: notes,
        user_id: codeData.expert_id,
      });

      return new Response(
        JSON.stringify({ success: true, message: "Notes added successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ FETCH CASE DATA ============
    // Fetch expert info
    const { data: expert } = await supabase
      .from("medical_experts")
      .select("id, first_name, last_name, expert_type, practice_name, province")
      .eq("id", codeData.expert_id)
      .single();

    // Fetch ALL appointments for this expert
    const { data: appointments } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        case_status,
        matter_type,
        created_at,
        claimant_id,
        referring_attorney_id
      `)
      .eq("expert_id", codeData.expert_id)
      .is("deleted_at", null)
      .order("appointment_date", { ascending: false });

    if (!appointments || appointments.length === 0) {
      return new Response(
        JSON.stringify({
          expert: expert ? {
            id: expert.id,
            name: `${expert.first_name || ""} ${expert.last_name || ""}`.trim(),
            expert_type: expert.expert_type || "",
            practice_name: expert.practice_name || "",
            province: expert.province || "",
          } : null,
          cases: [],
          documents: {},
          total_cases: 0,
          message: "No cases found for this expert.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch claimant names
    const claimantIds = [...new Set(appointments.map((a) => a.claimant_id))];
    const { data: claimants } = await supabase
      .from("claimants")
      .select("id, first_name, last_name, contact_number")
      .in("id", claimantIds);

    const claimantMap = new Map(
      (claimants || []).map((c) => [c.id, { name: `${c.first_name} ${c.last_name}`, contact: c.contact_number }])
    );

    // Fetch attorney names
    const attorneyIds = [...new Set(appointments.map((a) => a.referring_attorney_id))];
    const { data: attorneys } = await supabase
      .from("referring_attorneys")
      .select("id, name, contact_person, email, phone")
      .in("id", attorneyIds);

    const attorneyMap = new Map(
      (attorneys || []).map((a) => [a.id, { name: a.name, contact_person: a.contact_person, email: a.email, phone: a.phone }])
    );

    // Fetch report statuses
    const appointmentIds = appointments.map((a) => a.id);
    const { data: reports } = await supabase
      .from("expert_reports")
      .select("appointment_id, report_status, report_submitted_date, report_due_date")
      .in("appointment_id", appointmentIds);

    const reportMap = new Map(
      (reports || []).map((r) => [
        r.appointment_id,
        { status: r.report_status, submitted_date: r.report_submitted_date, due_date: r.report_due_date },
      ])
    );

    // Fetch documents for all appointments (only expert-visible ones)
    const { data: documents } = await supabase
      .from("documents")
      .select("id, file_name, document_type, file_size, file_type, upload_date, appointment_id, is_visible_to_expert")
      .in("appointment_id", appointmentIds)
      .eq("is_visible_to_expert", true)
      .order("upload_date", { ascending: false });

    // Group documents by appointment_id
    const documentsByAppointment: Record<string, any[]> = {};
    (documents || []).forEach((doc) => {
      if (!documentsByAppointment[doc.appointment_id!]) {
        documentsByAppointment[doc.appointment_id!] = [];
      }
      documentsByAppointment[doc.appointment_id!].push({
        id: doc.id,
        file_name: doc.file_name,
        document_type: doc.document_type,
        file_size: doc.file_size,
        file_type: doc.file_type,
        upload_date: doc.upload_date,
      });
    });

    // Build response
    const cases = appointments.map((apt) => {
      const attorney = attorneyMap.get(apt.referring_attorney_id);
      const claimant = claimantMap.get(apt.claimant_id);
      const report = reportMap.get(apt.id);
      return {
        id: apt.id,
        claimant_name: claimant?.name || "Unknown",
        claimant_contact: claimant?.contact || null,
        appointment_date: apt.appointment_date,
        case_status: apt.case_status || "Scheduled",
        payment_status: apt.payment_status || "Pending",
        matter_type: apt.matter_type || "N/A",
        attorney_name: attorney?.name || "Unknown",
        attorney_contact_person: attorney?.contact_person || null,
        attorney_email: attorney?.email || null,
        attorney_phone: attorney?.phone || null,
        report_status: report?.status || "Pending",
        report_submitted_date: report?.submitted_date || null,
        report_due_date: report?.due_date || null,
        service_fee: apt.service_fee || null,
        deposit_amount: apt.deposit_amount || null,
        documents: documentsByAppointment[apt.id] || [],
      };
    });

    return new Response(
      JSON.stringify({
        expert: {
          id: expert?.id || "",
          name: `${expert?.first_name || ""} ${expert?.last_name || ""}`.trim() || "Unknown",
          expert_type: expert?.expert_type || "",
          practice_name: expert?.practice_name || "",
          province: expert?.province || "",
        },
        cases,
        total_cases: cases.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error validating expert access code:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
