// External Portal Module — end-user authentication.
//
// Public endpoint (verify_jwt = false, see supabase/config.toml) —
// external users are never Supabase auth.users, so there is no JWT to
// verify here. Every action is authorized entirely against this
// module's own tables via the service-role client, which is exactly
// why those tables have no anon/authenticated RLS policy: this
// function IS the access-control layer for external users.
//
// Actions:
//   consume_link   — one-time registration link -> sends first OTP
//   request_otp    — (re)send an OTP, for registration or login
//   verify_otp     — verify a code -> issues a session token
//   logout         — revoke a session token
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withErrorHandler } from "../_shared/errors.ts";
import { sendEmail } from "../_shared/email.ts";
import {
  corsHeaders,
  jsonResponse,
  errorResponse,
  sha256Hex,
  randomToken,
  randomOtpCode,
  maskEmail,
  getClientIp,
  getPortalSettings,
  otpEmailHtml,
  PORTAL_LABEL,
} from "../_external-portal-shared/helpers.ts";

type Action = "consume_link" | "request_otp" | "verify_otp" | "logout";

interface RequestBody {
  action: Action;
  token?: string;              // consume_link
  link_token?: string;         // request_otp (registration) / verify_otp (registration)
  email?: string;               // request_otp (login) / verify_otp (login)
  portal_type?: "attorney" | "expert"; // login flows only
  mode?: "registration" | "login";
  code?: string;                // verify_otp
  session_token?: string;       // logout
}

const GENERIC_OTP_ERROR = "Invalid or expired code. Please try again.";
const GENERIC_REQUEST_MESSAGE = "If that account exists and is active, a verification code has been sent.";

serve(withErrorHandler(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const body: RequestBody = await req.json();
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent");
  const settings = await getPortalSettings(supabaseAdmin);

  // -------------------------------------------------------------
  // consume_link — validates the one-time link and kicks off OTP
  // -------------------------------------------------------------
  if (body.action === "consume_link") {
    if (!body.token) return errorResponse("token is required");

    const tokenHash = await sha256Hex(body.token);
    const { data: link } = await supabaseAdmin
      .from("external_portal_access_links")
      .select("id, account_id, status, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!link || link.status !== "pending") {
      return errorResponse("This link is invalid, already used, or has been revoked.", 410, "LINK_INVALID");
    }
    if (new Date(link.expires_at).getTime() <= Date.now()) {
      await supabaseAdmin.from("external_portal_access_links").update({ status: "expired" }).eq("id", link.id);
      return errorResponse("This link has expired. Please ask your administrator for a new one.", 410, "LINK_EXPIRED");
    }

    const { data: account } = await supabaseAdmin
      .from("external_portal_accounts")
      .select("id, full_name, email, portal_type, status, deleted_at")
      .eq("id", link.account_id)
      .single();

    if (!account || account.deleted_at || account.status !== "active") {
      return errorResponse("This account no longer has active portal access.", 403, "ACCOUNT_NOT_ACTIVE");
    }

    await logHistory(supabaseAdmin, account.id, account.email, "registration_link_opened", true, null, ip, userAgent);

    await issueOtp(supabaseAdmin, {
      accountId: account.id,
      accessLinkId: link.id,
      destination: account.email,
      fullName: account.full_name,
      portalType: account.portal_type,
      purpose: "registration",
      settings,
      ip,
      userAgent,
    });

    return jsonResponse({
      success: true,
      data: {
        portal_type: account.portal_type,
        masked_email: maskEmail(account.email),
        otp_expiry_minutes: settings.otp_expiry_minutes,
      },
    });
  }

  // -------------------------------------------------------------
  // request_otp — send/resend a code, registration or login
  // -------------------------------------------------------------
  if (body.action === "request_otp") {
    if (body.mode === "registration") {
      if (!body.link_token) return errorResponse("link_token is required");
      const tokenHash = await sha256Hex(body.link_token);
      const { data: link } = await supabaseAdmin
        .from("external_portal_access_links")
        .select("id, account_id, status, expires_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (!link || link.status !== "pending" || new Date(link.expires_at).getTime() <= Date.now()) {
        return errorResponse("This link is no longer valid.", 410, "LINK_INVALID");
      }

      const { data: account } = await supabaseAdmin
        .from("external_portal_accounts")
        .select("id, full_name, email, portal_type, status, deleted_at")
        .eq("id", link.account_id)
        .single();

      if (!account || account.deleted_at || account.status !== "active") {
        return errorResponse("This account no longer has active portal access.", 403, "ACCOUNT_NOT_ACTIVE");
      }

      await issueOtp(supabaseAdmin, {
        accountId: account.id,
        accessLinkId: link.id,
        destination: account.email,
        fullName: account.full_name,
        portalType: account.portal_type,
        purpose: "registration",
        settings,
        ip,
        userAgent,
      });

      return jsonResponse({ success: true, data: { masked_email: maskEmail(account.email) } });
    }

    // Login flow — always return a generic message so the response
    // shape can't be used to enumerate which emails have accounts.
    if (!body.email || !body.portal_type) return errorResponse("email and portal_type are required");

    const { data: account } = await supabaseAdmin
      .from("external_portal_accounts")
      .select("id, full_name, email, portal_type, status, deleted_at")
      .eq("email", body.email.trim().toLowerCase())
      .eq("portal_type", body.portal_type)
      .is("deleted_at", null)
      .maybeSingle();

    if (account && account.status === "active") {
      await issueOtp(supabaseAdmin, {
        accountId: account.id,
        accessLinkId: null,
        destination: account.email,
        fullName: account.full_name,
        portalType: account.portal_type,
        purpose: "login",
        settings,
        ip,
        userAgent,
      });
      await logHistory(supabaseAdmin, account.id, account.email, "otp_requested", true, null, ip, userAgent);
    }

    return jsonResponse({ success: true, data: { message: GENERIC_REQUEST_MESSAGE } });
  }

  // -------------------------------------------------------------
  // verify_otp — check the code, issue a session
  // -------------------------------------------------------------
  if (body.action === "verify_otp") {
    if (!body.code) return errorResponse("code is required");

    let account: { id: string; full_name: string; email: string; portal_type: string; status: string } | null = null;
    let link: { id: string } | null = null;

    if (body.mode === "registration") {
      if (!body.link_token) return errorResponse("link_token is required");
      const tokenHash = await sha256Hex(body.link_token);
      const { data: linkRow } = await supabaseAdmin
        .from("external_portal_access_links")
        .select("id, account_id, status, expires_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (!linkRow || linkRow.status !== "pending" || new Date(linkRow.expires_at).getTime() <= Date.now()) {
        return errorResponse("This link is no longer valid.", 410, "LINK_INVALID");
      }
      link = { id: linkRow.id };

      const { data: acct } = await supabaseAdmin
        .from("external_portal_accounts")
        .select("id, full_name, email, portal_type, status")
        .eq("id", linkRow.account_id)
        .single();
      account = acct;
    } else {
      if (!body.email || !body.portal_type) return errorResponse("email and portal_type are required");
      const { data: acct } = await supabaseAdmin
        .from("external_portal_accounts")
        .select("id, full_name, email, portal_type, status")
        .eq("email", body.email.trim().toLowerCase())
        .eq("portal_type", body.portal_type)
        .is("deleted_at", null)
        .maybeSingle();
      account = acct;
    }

    if (!account || account.status !== "active") {
      // Same generic error whether the account exists or not.
      return errorResponse(GENERIC_OTP_ERROR, 401, "OTP_INVALID");
    }

    const purpose = body.mode === "registration" ? "registration" : "login";
    const { data: otpRow } = await supabaseAdmin
      .from("external_portal_otp_codes")
      .select("id, code_hash, attempts, max_attempts, expires_at, verified_at")
      .eq("account_id", account.id)
      .eq("purpose", purpose)
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRow || new Date(otpRow.expires_at).getTime() <= Date.now()) {
      await logHistory(supabaseAdmin, account.id, account.email, "otp_verify_failed", false, "No active code / expired", ip, userAgent);
      return errorResponse(GENERIC_OTP_ERROR, 401, "OTP_INVALID");
    }
    if (otpRow.attempts >= otpRow.max_attempts) {
      await logHistory(supabaseAdmin, account.id, account.email, "otp_verify_failed", false, "Too many attempts", ip, userAgent);
      return errorResponse("Too many incorrect attempts. Please request a new code.", 429, "OTP_LOCKED");
    }

    const codeHash = await sha256Hex(body.code.trim());
    if (codeHash !== otpRow.code_hash) {
      await supabaseAdmin
        .from("external_portal_otp_codes")
        .update({ attempts: otpRow.attempts + 1 })
        .eq("id", otpRow.id);
      await logHistory(supabaseAdmin, account.id, account.email, "otp_verify_failed", false, "Incorrect code", ip, userAgent);
      return errorResponse(GENERIC_OTP_ERROR, 401, "OTP_INVALID");
    }

    // Correct code — mark verified, consume the link (registration
    // only), issue a session, update account bookkeeping.
    await supabaseAdmin.from("external_portal_otp_codes").update({ verified_at: new Date().toISOString() }).eq("id", otpRow.id);

    if (link) {
      await supabaseAdmin
        .from("external_portal_access_links")
        .update({ status: "used", used_at: new Date().toISOString() })
        .eq("id", link.id);
    }

    const sessionRawToken = randomToken(32);
    const sessionTokenHash = await sha256Hex(sessionRawToken);
    const sessionExpiresAt = new Date(Date.now() + settings.session_expiry_hours * 60 * 60 * 1000).toISOString();

    await supabaseAdmin.from("external_portal_sessions").insert({
      account_id: account.id,
      session_token_hash: sessionTokenHash,
      expires_at: sessionExpiresAt,
      ip_address: ip,
      user_agent: userAgent,
    });

    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from("external_portal_accounts")
      .update({
        last_login_at: nowIso,
        last_login_ip: ip,
        registered_at: body.mode === "registration" ? nowIso : undefined,
      })
      .eq("id", account.id);

    await logHistory(supabaseAdmin, account.id, account.email, "login_success", true, null, ip, userAgent);
    await supabaseAdmin.rpc("external_portal_log_audit", {
      _actor_type: "external_user",
      _actor_id: null,
      _account_id: account.id,
      _action: body.mode === "registration" ? "account_registered" : "login_success",
      _details: {},
    });

    return jsonResponse({
      success: true,
      data: {
        session_token: sessionRawToken,
        expires_at: sessionExpiresAt,
        portal_type: account.portal_type,
        account: { full_name: account.full_name, email: account.email },
      },
    });
  }

  // -------------------------------------------------------------
  // logout — revoke a session
  // -------------------------------------------------------------
  if (body.action === "logout") {
    if (!body.session_token) return errorResponse("session_token is required");
    const tokenHash = await sha256Hex(body.session_token);

    const { data: session } = await supabaseAdmin
      .from("external_portal_sessions")
      .update({ revoked_at: new Date().toISOString(), revoked_reason: "User logged out" })
      .eq("session_token_hash", tokenHash)
      .is("revoked_at", null)
      .select("account_id")
      .maybeSingle();

    if (session) {
      const { data: account } = await supabaseAdmin
        .from("external_portal_accounts")
        .select("email")
        .eq("id", session.account_id)
        .single();
      await logHistory(supabaseAdmin, session.account_id, account?.email ?? null, "logout", true, null, ip, userAgent);
    }

    return jsonResponse({ success: true, data: {} });
  }

  return errorResponse("Unknown action", 400);
}));

// ---------------------------------------------------------------------
// helpers local to this function
// ---------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function issueOtp(supabaseAdmin: any, params: {
  accountId: string;
  accessLinkId: string | null;
  destination: string;
  fullName: string;
  portalType: string;
  purpose: "registration" | "login";
  // deno-lint-ignore no-explicit-any
  settings: any;
  ip: string | null;
  userAgent: string | null;
}) {
  const { accountId, accessLinkId, destination, fullName, portalType, purpose, settings, ip, userAgent } = params;

  // Invalidate any still-open code of the same purpose so only the
  // latest one is ever checkable.
  await supabaseAdmin
    .from("external_portal_otp_codes")
    .update({ expires_at: new Date().toISOString() })
    .eq("account_id", accountId)
    .eq("purpose", purpose)
    .is("verified_at", null);

  const code = randomOtpCode(settings.otp_length);
  const codeHash = await sha256Hex(code);
  const expiresAt = new Date(Date.now() + settings.otp_expiry_minutes * 60 * 1000).toISOString();

  await supabaseAdmin.from("external_portal_otp_codes").insert({
    account_id: accountId,
    access_link_id: accessLinkId,
    purpose,
    code_hash: codeHash,
    destination,
    max_attempts: settings.otp_max_attempts,
    expires_at: expiresAt,
    ip_address: ip,
    user_agent: userAgent,
  });

  const portalLabel = PORTAL_LABEL[portalType] ?? "External";
  await sendEmail({
    to: destination,
    subject: `Your ${portalLabel} Portal verification code`,
    html: otpEmailHtml({ fullName, code, expiryMinutes: settings.otp_expiry_minutes, portalLabel }),
  });
}

async function logHistory(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  accountId: string | null,
  email: string | null,
  eventType: string,
  success: boolean,
  failureReason: string | null,
  ip: string | null,
  userAgent: string | null,
) {
  await supabaseAdmin.from("external_portal_login_history").insert({
    account_id: accountId,
    email_attempted: email,
    event_type: eventType,
    success,
    failure_reason: failureReason,
    ip_address: ip,
    user_agent: userAgent,
  });
}
