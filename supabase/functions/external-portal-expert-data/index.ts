// External Portal Module — Medical Expert Portal data.
//
// Mirrors external-portal-attorney-data exactly in structure (same
// session validation, same external_portal_case_links scoping) — the
// only difference is which case fields matter to this audience: a
// Medical Expert cares about the claimant they're assessing and which
// attorney/firm referred the case, not the expert's own record.
//
// Public endpoint (verify_jwt = false); authorization is entirely via
// the caller-supplied session_token, validated against
// external_portal_sessions. Self-contained — no ../_shared imports.
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
    if (account.portal_type !== "expert") {
      return errorResponse("This session is not valid for the Medical Expert Portal.", 403, "WRONG_PORTAL");
    }

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
          attorney:referring_attorney_id ( id, name, code )
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
        referring_attorney: a.attorney ? { name: a.attorney.name, code: a.attorney.code } : null,
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
          id, appointment_date, case_status, matter_type, payment_status,
          assessment_code,
          claimant:claimant_id ( id, first_name, last_name, auto_id, contact_number ),
          attorney:referring_attorney_id ( id, name, code, contact_person, phone, email )
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
            assessment_code: appointment.assessment_code,
            claimant: appointment.claimant,
            referring_attorney: appointment.attorney,
            report,
          },
        },
      });
    }

    return errorResponse("Unknown action", 400);
  } catch (err) {
    console.error("external-portal-expert-data error:", err);
    return errorResponse(err instanceof Error ? err.message : "Internal server error", 500, "INTERNAL_ERROR");
  }
});
