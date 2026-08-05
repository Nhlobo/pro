// External Portal Module — case messages.
//
// Public endpoint (verify_jwt = false); authorization is entirely via
// the caller-supplied session_token, same pattern as
// external-portal-attorney-data / external-portal-expert-data. Shared
// by both portal types since messaging works identically for either —
// the only per-portal-type logic is which case list to show it from,
// which lives in the two *-data functions, not here.
//
// Every read/write is scoped to external_portal_case_links: an account
// can only list or send messages for a case actually linked to it.
// Self-contained — no ../_shared imports.
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

type Action = "list" | "send";

interface RequestBody {
  action: Action;
  session_token?: string;
  appointment_id?: string;
  body?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const req_body: RequestBody = await req.json();
    if (!req_body.session_token) return errorResponse("session_token is required", 401, "SESSION_INVALID");
    if (!req_body.appointment_id) return errorResponse("appointment_id is required");

    // ---- validate session -----------------------------------------
    const tokenHash = await sha256Hex(req_body.session_token);
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
      .select("id, status, deleted_at")
      .eq("id", session.account_id)
      .single();

    if (!account || account.deleted_at || account.status !== "active") {
      return errorResponse("This account no longer has active portal access.", 403, "ACCOUNT_NOT_ACTIVE");
    }

    // ---- confirm this case is actually linked to this account ------
    const { data: link } = await supabaseAdmin
      .from("external_portal_case_links")
      .select("id")
      .eq("account_id", account.id)
      .eq("appointment_id", req_body.appointment_id)
      .is("revoked_at", null)
      .maybeSingle();

    if (!link) {
      return errorResponse("This case is not linked to your portal account.", 403, "CASE_NOT_LINKED");
    }

    if (req_body.action === "list") {
      const { data: messages, error } = await supabaseAdmin
        .from("external_portal_case_messages")
        .select("id, sender_type, body, created_at")
        .eq("account_id", account.id)
        .eq("appointment_id", req_body.appointment_id)
        .order("created_at", { ascending: true })
        .limit(200);

      if (error) return errorResponse(error.message, 500);

      // Mark admin messages as read by the external user now that they've fetched them.
      await supabaseAdmin
        .from("external_portal_case_messages")
        .update({ read_by_external_at: new Date().toISOString() })
        .eq("account_id", account.id)
        .eq("appointment_id", req_body.appointment_id)
        .eq("sender_type", "admin")
        .is("read_by_external_at", null);

      return jsonResponse({ success: true, data: { messages: messages || [] } });
    }

    if (req_body.action === "send") {
      const text = (req_body.body || "").trim();
      if (!text) return errorResponse("Message cannot be empty");
      if (text.length > 4000) return errorResponse("Message is too long (4000 characters max)");

      const { data: inserted, error } = await supabaseAdmin
        .from("external_portal_case_messages")
        .insert({
          account_id: account.id,
          appointment_id: req_body.appointment_id,
          sender_type: "external_user",
          body: text,
        })
        .select("id, sender_type, body, created_at")
        .single();

      if (error) return errorResponse(error.message, 500);

      return jsonResponse({ success: true, data: { message: inserted } });
    }

    return errorResponse("Unknown action", 400);
  } catch (err) {
    console.error("external-portal-messages error:", err);
    return errorResponse(err instanceof Error ? err.message : "Internal server error", 500, "INTERNAL_ERROR");
  }
});
