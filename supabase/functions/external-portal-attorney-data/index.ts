// External Portal Module — Referring Attorney Portal data.
//
// Public endpoint (verify_jwt = false) — authorization is entirely via
// the caller-supplied `session_token`, issued by external-portal-auth
// and validated here against external_portal_sessions. This function
// NEVER trusts a client-supplied account_id or appointment_id without
// checking it against external_portal_case_links first — that link
// table is the only source of truth for what an account may see.
//
// Read-only. No case data is duplicated anywhere in this module — this
// function reads live from the existing appointments/claimants/
// medical_experts/expert_reports tables via the service role and
// returns a display-shaped projection of it.
//
// Self-contained (no ../_shared or ../_external-portal-shared imports)
// by design, same as external-portal-auth and external-portal-admin-links.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function errorResponse(message: string, status = 400, code?: string): Response {
  return jsonResponse({ success: false, error: message, code }, status);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Action = "list_cases" | "get_case";

interface RequestBody {
  action: Action;
  session_token?: string;
  appointment_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body: RequestBody = await req.json();
    if (!body.session_token) return errorResponse("session_token is required", 401, "SESSION_INVALID");

    // ---- validate session -----------------------------------------
    const tokenHash = await sha256Hex(body.session_token);
    const { data: session } = await supabaseAdmin
      .from("external_portal_sessions")
      .select("id, account_id, expires_at, revoked_at")
      .eq("session_token_hash", tokenHash)
      .maybeSingle();

    if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
      return errorResponse("Your session has expired. Please sign in again.", 401, "SESSION_INVALID");
    }

    const { data: account } = await supabaseAdmin
      .from("external_portal_accounts")
      .select("id, full_name, email, portal_type, status, deleted_at")
      .eq("id", session.account_id)
      .single();

    if (!account || account.deleted_at || account.status !== "active") {
      return errorResponse("This account no longer has active portal access.", 403, "ACCOUNT_NOT_ACTIVE");
    }
    if (account.portal_type !== "attorney") {
      return errorResponse("This session is not valid for the Referring Attorney Portal.", 403, "WRONG_PORTAL");
    }

    // Session is good — refresh last_seen_at.
    await supabaseAdmin
      .from("external_portal_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", session.id);

    // ---- which cases can this account see? -------------------------
    const { data: caseLinks } = await supabaseAdmin
      .from("external_portal_case_links")
      .select("appointment_id")
      .eq("account_id", account.id)
      .is("revoked_at", null);

    const allowedAppointmentIds = (caseLinks || []).map((l: { appointment_id: string }) => l.appointment_id);

    if (body.action === "list_cases") {
      if (allowedAppointmentIds.length === 0) {
        return jsonResponse({ success: true, data: { cases: [] } });
      }

      const { data: appointments, error } = await supabaseAdmin
        .from("appointments")
        .select(`
          id, appointment_date, case_status, matter_type, payment_status,
          claimant:claimant_id ( id, first_name, last_name, auto_id ),
          expert:expert_id ( id, first_name, last_name, expert_type, province )
        `)
        .in("id", allowedAppointmentIds)
        .order("appointment_date", { ascending: false });

      if (error) return errorResponse(error.message, 500);

      const { data: reports } = await supabaseAdmin
        .from("expert_reports")
        .select("appointment_id, report_status, report_due_date, report_submitted_date")
        .in("appointment_id", allowedAppointmentIds);

      const reportByAppointment = new Map((reports || []).map((r: any) => [r.appointment_id, r]));

      const cases = (appointments || []).map((a: any) => ({
        appointment_id: a.id,
        appointment_date: a.appointment_date,
        case_status: a.case_status,
        matter_type: a.matter_type,
        payment_status: a.payment_status,
        claimant: a.claimant ? { first_name: a.claimant.first_name, last_name: a.claimant.last_name, reference: a.claimant.auto_id } : null,
        expert: a.expert
          ? { first_name: a.expert.first_name, last_name: a.expert.last_name, expert_type: a.expert.expert_type, province: a.expert.province }
          : null,
        report: reportByAppointment.get(a.id) || null,
      }));

      return jsonResponse({ success: true, data: { cases, account: { full_name: account.full_name, email: account.email } } });
    }

    if (body.action === "get_case") {
      if (!body.appointment_id) return errorResponse("appointment_id is required");
      if (!allowedAppointmentIds.includes(body.appointment_id)) {
        return errorResponse("This case is not linked to your portal account.", 403, "CASE_NOT_LINKED");
      }

      const { data: appointment, error } = await supabaseAdmin
        .from("appointments")
        .select(`
          id, appointment_date, case_status, matter_type, payment_status, service_fee,
          deposit_amount, agreement_duration_months, assessment_code,
          claimant:claimant_id ( id, first_name, last_name, auto_id, contact_number ),
          expert:expert_id ( id, first_name, last_name, expert_type, province, city )
        `)
        .eq("id", body.appointment_id)
        .single();

      if (error || !appointment) return errorResponse("Case not found", 404);

      const { data: report } = await supabaseAdmin
        .from("expert_reports")
        .select("report_status, report_due_date, report_submitted_date, payment_status")
        .eq("appointment_id", body.appointment_id)
        .maybeSingle();

      return jsonResponse({
        success: true,
        data: {
          case: {
            appointment_id: appointment.id,
            appointment_date: appointment.appointment_date,
            case_status: appointment.case_status,
            matter_type: appointment.matter_type,
            payment_status: appointment.payment_status,
            service_fee: appointment.service_fee,
            deposit_amount: appointment.deposit_amount,
            agreement_duration_months: appointment.agreement_duration_months,
            assessment_code: appointment.assessment_code,
            claimant: appointment.claimant,
            expert: appointment.expert,
            report,
          },
        },
      });
    }

    return errorResponse("Unknown action", 400);
  } catch (err) {
    console.error("external-portal-attorney-data error:", err);
    return errorResponse(err instanceof Error ? err.message : "Internal server error", 500, "INTERNAL_ERROR");
  }
});
