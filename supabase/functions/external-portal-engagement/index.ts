// External Portal Module — Phase 5 engagement endpoint.
//
// Serves the shared "case engagement" surface for BOTH portal types
// (Referring Attorney and Medical Expert):
//   * documents  — read live from public.documents, honouring the
//                  existing is_visible_to_attorney / is_visible_to_expert
//                  flags. No document data is duplicated by this module.
//   * progress   — read live from public.case_timelines (the same
//                  7-phase litigation timeline staff use).
//   * notifications — derived on the fly from live case data (report
//                  status, new documents, timeline phase changes). No
//                  new tables: external users have no auth.users row,
//                  so public.notifications cannot serve them, and this
//                  module never writes case data. Read state is kept
//                  client-side per account.
//
// Public endpoint (verify_jwt = false) — authorization is entirely via
// the caller-supplied session_token, validated here against
// external_portal_sessions, then scoped by external_portal_case_links.
// Self-contained by design, like the other functions in this module.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STORAGE_BUCKETS = ["documents", "attorney-documents", "expert-documents", "aod-documents", "case-management-reports"];

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

type Action = "list_documents" | "get_document_url" | "get_case_progress" | "list_notifications";

interface RequestBody {
  action: Action;
  session_token?: string;
  appointment_id?: string;
  document_id?: string;
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

    // ---- validate session (identical contract to the data functions)
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

    await supabaseAdmin
      .from("external_portal_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", session.id);

    const isAttorney = account.portal_type === "attorney";
    const visibilityColumn = isAttorney ? "is_visible_to_attorney" : "is_visible_to_expert";

    // ---- case scoping ---------------------------------------------
    const { data: caseLinks } = await supabaseAdmin
      .from("external_portal_case_links")
      .select("appointment_id")
      .eq("account_id", account.id)
      .is("revoked_at", null);

    const allowedAppointmentIds = (caseLinks || []).map((l: { appointment_id: string }) => l.appointment_id);

    function assertAllowed(appointmentId?: string): string | null {
      if (!appointmentId) return null;
      return allowedAppointmentIds.includes(appointmentId) ? appointmentId : "DENY";
    }

    // ---- list_documents -------------------------------------------
    if (body.action === "list_documents") {
      const scoped = assertAllowed(body.appointment_id);
      if (scoped === "DENY") return errorResponse("This case is not linked to your portal account.", 403, "CASE_NOT_LINKED");
      if (allowedAppointmentIds.length === 0) return jsonResponse({ success: true, data: { documents: [] } });

      let query = supabaseAdmin
        .from("documents")
        .select("id, appointment_id, document_type, file_name, file_size, file_type, upload_date, upload_time, approval_status, notes")
        .eq(visibilityColumn, true)
        .order("upload_date", { ascending: false })
        .limit(200);

      query = scoped ? query.eq("appointment_id", scoped) : query.in("appointment_id", allowedAppointmentIds);

      const { data, error } = await query;
      if (error) return errorResponse(error.message, 500);

      return jsonResponse({ success: true, data: { documents: data || [] } });
    }

    // ---- get_document_url ------------------------------------------
    if (body.action === "get_document_url") {
      if (!body.document_id) return errorResponse("document_id is required");

      const { data: doc } = await supabaseAdmin
        .from("documents")
        .select(`id, appointment_id, file_path, file_name, ${visibilityColumn}`)
        .eq("id", body.document_id)
        .maybeSingle();

      // Every gate re-checked server-side: the document must exist, be
      // flagged visible to this portal type, and belong to a linked case.
      if (!doc || !(doc as Record<string, unknown>)[visibilityColumn]) {
        return errorResponse("Document not available.", 403, "DOCUMENT_NOT_VISIBLE");
      }
      if (!doc.appointment_id || !allowedAppointmentIds.includes(doc.appointment_id)) {
        return errorResponse("This document is not linked to your portal account.", 403, "CASE_NOT_LINKED");
      }

      for (const bucket of STORAGE_BUCKETS) {
        const { data: signed } = await supabaseAdmin.storage.from(bucket).createSignedUrl(doc.file_path, 300);
        if (signed?.signedUrl) {
          await supabaseAdmin.rpc("external_portal_log_audit", {
            _actor_type: "external_user",
            _actor_id: null,
            _account_id: account.id,
            _action: "document_downloaded",
            _details: { document_id: doc.id, file_name: doc.file_name, appointment_id: doc.appointment_id },
          });
          return jsonResponse({ success: true, data: { url: signed.signedUrl, file_name: doc.file_name } });
        }
      }

      return errorResponse("The file could not be located in storage.", 404, "FILE_NOT_FOUND");
    }

    // ---- get_case_progress -----------------------------------------
    if (body.action === "get_case_progress") {
      const scoped = assertAllowed(body.appointment_id);
      if (!body.appointment_id) return errorResponse("appointment_id is required");
      if (scoped === "DENY") return errorResponse("This case is not linked to your portal account.", 403, "CASE_NOT_LINKED");

      const { data: phases, error } = await supabaseAdmin
        .from("case_timelines")
        .select("id, phase_name, phase_order, status, started_at, completed_at, notes")
        .eq("appointment_id", body.appointment_id)
        .order("phase_order", { ascending: true });

      if (error) return errorResponse(error.message, 500);

      return jsonResponse({ success: true, data: { phases: phases || [] } });
    }

    // ---- list_notifications ----------------------------------------
    // Derived, read-only: assembled from live case data so the portal
    // never has to duplicate or write anything.
    if (body.action === "list_notifications") {
      if (allowedAppointmentIds.length === 0) return jsonResponse({ success: true, data: { notifications: [] } });

      const [{ data: appointments }, { data: reports }, { data: docs }, { data: phases }] = await Promise.all([
        supabaseAdmin
          .from("appointments")
          .select("id, appointment_date, case_status, updated_at, claimant:claimant_id ( first_name, last_name )")
          .in("id", allowedAppointmentIds),
        supabaseAdmin
          .from("expert_reports")
          .select("appointment_id, report_status, report_submitted_date, updated_at")
          .in("appointment_id", allowedAppointmentIds),
        supabaseAdmin
          .from("documents")
          .select("id, appointment_id, file_name, document_type, created_at")
          .eq(visibilityColumn, true)
          .in("appointment_id", allowedAppointmentIds)
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin
          .from("case_timelines")
          .select("id, appointment_id, phase_name, status, completed_at, updated_at")
          .in("appointment_id", allowedAppointmentIds)
          .eq("status", "completed")
          .order("updated_at", { ascending: false })
          .limit(50),
      ]);

      const claimantFor = new Map(
        (appointments || []).map((a: any) => [
          a.id,
          a.claimant ? `${a.claimant.first_name} ${a.claimant.last_name}` : "Case",
        ]),
      );

      const notifications: Array<{
        id: string;
        category: string;
        title: string;
        message: string;
        appointment_id: string;
        occurred_at: string;
      }> = [];

      for (const r of reports || []) {
        if (!r.appointment_id) continue;
        notifications.push({
          id: `report:${r.appointment_id}:${r.report_status}:${r.updated_at}`,
          category: "report",
          title: r.report_status === "completed" ? "Report completed" : "Report status updated",
          message: `${claimantFor.get(r.appointment_id) || "Case"} — report is now "${r.report_status}".`,
          appointment_id: r.appointment_id,
          occurred_at: r.report_submitted_date || r.updated_at,
        });
      }

      for (const d of docs || []) {
        if (!d.appointment_id) continue;
        notifications.push({
          id: `document:${d.id}`,
          category: "document",
          title: "New document available",
          message: `${claimantFor.get(d.appointment_id) || "Case"} — ${d.document_type}: ${d.file_name}`,
          appointment_id: d.appointment_id,
          occurred_at: d.created_at,
        });
      }

      for (const p of phases || []) {
        notifications.push({
          id: `phase:${p.id}:${p.updated_at}`,
          category: "progress",
          title: "Case progress update",
          message: `${claimantFor.get(p.appointment_id) || "Case"} — "${p.phase_name}" completed.`,
          appointment_id: p.appointment_id,
          occurred_at: p.completed_at || p.updated_at,
        });
      }

      notifications.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

      return jsonResponse({ success: true, data: { notifications: notifications.slice(0, 60) } });
    }

    return errorResponse("Unknown action", 400);
  } catch (err) {
    console.error("external-portal-engagement error:", err);
    return errorResponse(err instanceof Error ? err.message : "Internal server error", 500, "INTERNAL_ERROR");
  }
});
