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
//
// Deliberately self-contained: no imports from ../_shared or
// ../_external-portal-shared. Everything this function needs (CORS,
// crypto helpers, email sending) is inlined below so deployment never
// depends on the bundler resolving sibling folders — same pattern
// external-portal-admin-links already uses, for the same reason.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

// ---------------------------------------------------------------------
// inlined from _shared/errors.ts (withErrorHandler only)
// ---------------------------------------------------------------------

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

type Handler = (req: Request) => Promise<Response> | Response;

function withErrorHandler(handler: Handler) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    try {
      return await handler(req);
    } catch (err) {
      console.error("Unhandled error in external-portal-auth:", err);
      return jsonResponse(
        { success: false, error: err instanceof Error ? err.message : "Internal server error" },
        500,
      );
    }
  };
}

// ---------------------------------------------------------------------
// inlined from _external-portal-shared/helpers.ts
// ---------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function errorResponse(message: string, status = 400, code?: string): Response {
  return jsonResponse({ success: false, error: message, code }, status);
}

/** SHA-256 hex digest — used to store only hashes of tokens/OTP codes at rest. */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Cryptographically random URL-safe token for one-time links and sessions. */
function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Numeric OTP code of the given length, e.g. "483920" for length 6. */
function randomOtpCode(length: number): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => (b % 10).toString()).join("");
}

/** "jane.doe@example.com" -> "j***@example.com" — never expose the full address pre-auth. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(local.length - 1, 3))}@${domain}`;
}

function getClientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

interface PortalSettings {
  access_link_expiry_hours: number;
  otp_length: number;
  otp_expiry_minutes: number;
  otp_max_attempts: number;
  session_expiry_hours: number;
  auto_expire_on_all_cases_closed: boolean;
}

const DEFAULT_SETTINGS: PortalSettings = {
  access_link_expiry_hours: 72,
  otp_length: 6,
  otp_expiry_minutes: 10,
  otp_max_attempts: 5,
  session_expiry_hours: 12,
  auto_expire_on_all_cases_closed: false,
};

// deno-lint-ignore no-explicit-any
async function getPortalSettings(supabaseAdmin: any): Promise<PortalSettings> {
  const { data } = await supabaseAdmin
    .from("external_portal_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return data ? { ...DEFAULT_SETTINGS, ...data } : DEFAULT_SETTINGS;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function otpEmailHtml(params: { fullName: string; code: string; expiryMinutes: number; portalLabel: string }): string {
  const { fullName, code, expiryMinutes, portalLabel } = params;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f4f6f7;">
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1fb6ce 0%, #159baf 100%); color: #ffffff; padding: 22px 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 16px; letter-spacing: 0.5px;">KUTLWANO &amp; ASSOCIATES (PTY) LTD</h1>
          <p style="margin: 4px 0 0; font-size: 11px; opacity: 0.9;">Medico-Legal Service</p>
        </div>

        <div style="padding: 28px 28px 8px;">
          <p style="color: #1f2937; font-size: 14px; margin: 0 0 12px;">Hi ${escapeHtml(fullName)},</p>
          <p style="color: #374151; font-size: 14px; margin: 0 0 20px;">
            Here is your one-time verification code for the <strong>${escapeHtml(portalLabel)} Portal</strong>:
          </p>

          <div style="text-align: center; margin: 24px 0;">
            <span style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #159baf; background: #eaf9fb; border: 1px solid #b9ecf1; border-radius: 6px; padding: 14px 22px;">
              ${escapeHtml(code)}
            </span>
          </div>

          <p style="color: #374151; font-size: 13px; margin: 0 0 8px;">
            This code expires in <strong>${expiryMinutes} minutes</strong>.
          </p>
          <p style="color: #6b7280; font-size: 12px; margin: 0 0 20px;">
            If you didn't request this, you can safely ignore this email — no changes will be made to your account.
          </p>
        </div>

        <hr style="margin: 0; border: none; border-top: 1px solid #eee;">

        <div style="padding: 18px 28px 24px;">
          <p style="font-style: italic; color: #1fb6ce; font-size: 12px; margin: 0 0 10px;">
            "We touch a file, we change a life, we are Kutlwano and Associate"
          </p>
          <p style="font-size: 10px; color: #999; margin: 0;">
            This is an automated security email. Please do not reply directly to this message.
          </p>
        </div>
      </div>
      <p style="text-align: center; font-size: 10px; color: #9ca3af; margin: 14px 0 0;">
        Kutlwano &amp; Associates (Pty) Ltd | Registration: 2016/461385/07
      </p>
    </div>
  `;
}

const PORTAL_LABEL: Record<string, string> = {
  attorney: "Referring Attorney",
  expert: "Medical Expert",
};

// ---------------------------------------------------------------------
// inlined from _shared/email.ts (simplified — this function never
// sends attachments, so the batching logic there doesn't apply)
// ---------------------------------------------------------------------

async function sendEmail(options: { to: string; subject: string; html: string }): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("Missing Resend API key");
    return { success: false, error: "Resend API key is not configured" };
  }
  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: "Kutlwano & Associate <noreply@kamedico-legal.co.za>",
      to: [options.to],
      subject: options.subject,
      html: options.html,
      reply_to: "info@kamedico-legal.co.za",
    });
    if (error) {
      console.error("Resend API error:", error);
      return { success: false, error: `Resend API error: ${error.message}` };
    }
    return { success: true };
  } catch (error) {
    console.error("Resend email error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to send email via Resend" };
  }
}

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

    // This runs on every load of the link URL, not just one deliberate
    // "send me a code" action — a second tab, a reload, or (very
    // commonly) a mail provider/security gateway pre-fetching the link
    // to scan it before the recipient ever opens the message will all
    // hit this same branch. status can't be used to dedupe that (it
    // must stay 'pending' until verify_otp succeeds below, since
    // request_otp/verify_otp both require 'pending' too), so instead:
    // if a code from a previous hit is still live, reuse it silently
    // rather than calling issueOtp again — issueOtp unconditionally
    // invalidates whatever code is outstanding and emails a new one,
    // so without this check every re-load sends another email and
    // kills the code from the one before it. The explicit "Resend"
    // button (request_otp) is unaffected — it always sends a fresh
    // code on demand, exactly as it should.
    const { data: liveOtp } = await supabaseAdmin
      .from("external_portal_otp_codes")
      .select("id")
      .eq("account_id", account.id)
      .eq("purpose", "registration")
      .is("verified_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!liveOtp) {
      const otpResult = await issueOtp(supabaseAdmin, {
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

      if (!otpResult.success) {
        await logHistory(supabaseAdmin, account.id, account.email, "otp_email_failed", false, otpResult.error ?? null, ip, userAgent);
        return errorResponse(
          "We couldn't send your verification code email. Please try again in a moment — if this keeps happening, contact your administrator.",
          502,
          "EMAIL_SEND_FAILED",
        );
      }
    }

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

      const otpResult = await issueOtp(supabaseAdmin, {
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

      if (!otpResult.success) {
        await logHistory(supabaseAdmin, account.id, account.email, "otp_email_failed", false, otpResult.error ?? null, ip, userAgent);
        return errorResponse(
          "We couldn't send your verification code email. Please try again in a moment — if this keeps happening, contact your administrator.",
          502,
          "EMAIL_SEND_FAILED",
        );
      }

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
      const otpResult = await issueOtp(supabaseAdmin, {
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
      // Deliberately still returns the generic message below either way —
      // revealing send success/failure here would tell a caller whether
      // this email has an account, which is exactly what this endpoint's
      // generic response is designed to avoid. The failure is instead
      // recorded to this account's own history, where an admin who is
      // looking into "this attorney says they never got a code" can
      // actually find it — instead of only a Supabase function log
      // nobody but a developer would think to check.
      await logHistory(
        supabaseAdmin,
        account.id,
        account.email,
        otpResult.success ? "otp_requested" : "otp_email_failed",
        otpResult.success,
        otpResult.success ? null : otpResult.error ?? null,
        ip,
        userAgent,
      );
    }

    return jsonResponse({ success: true, data: { message: GENERIC_REQUEST_MESSAGE } });
  }

  // -------------------------------------------------------------
  // verify_otp — check the code, issue a session
  // -------------------------------------------------------------
  if (body.action === "verify_otp") {
    if (!body.code) return errorResponse("code is required");

    let account: {
      id: string;
      full_name: string;
      email: string;
      portal_type: string;
      status: string;
      referring_attorney_id: string | null;
      medical_expert_id: string | null;
      assigned_attorney_contact_id: string | null;
    } | null = null;
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
        .select("id, full_name, email, portal_type, status, referring_attorney_id, medical_expert_id, assigned_attorney_contact_id")
        .eq("id", linkRow.account_id)
        .single();
      account = acct;
    } else {
      if (!body.email || !body.portal_type) return errorResponse("email and portal_type are required");
      const { data: acct } = await supabaseAdmin
        .from("external_portal_accounts")
        .select("id, full_name, email, portal_type, status, referring_attorney_id, medical_expert_id, assigned_attorney_contact_id")
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

    // Bridge into a real Supabase Auth session — mint (or reuse) a
    // shadow auth.users record for this external account and hand the
    // frontend a one-time magiclink token it can redeem client-side
    // via supabase.auth.verifyOtp(). This is what lets a correct OTP
    // land the person on the actual, unmodified /attorney-portal or
    // /expert-portal instead of a dead end.
    const bridge = await bridgeToSupabaseAuth(supabaseAdmin, account);

    return jsonResponse({
      success: true,
      data: {
        session_token: sessionRawToken,
        expires_at: sessionExpiresAt,
        portal_type: account.portal_type,
        account: { full_name: account.full_name, email: account.email },
        bridge_email: bridge.bridgeEmail,
        bridge_token: bridge.bridgeToken,
        portal_path: bridge.portalPath,
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
  const sendResult = await sendEmail({
    to: destination,
    subject: `Your ${portalLabel} Portal verification code`,
    html: otpEmailHtml({ fullName, code, expiryMinutes: settings.otp_expiry_minutes, portalLabel }),
  });

  if (!sendResult.success) {
    // The OTP row above is still written (so a subsequent resend can
    // reuse the same "one active code" invalidation logic cleanly),
    // but the caller MUST know this failed — previously this result
    // was discarded entirely, so a Resend outage/misconfiguration
    // looked identical to a normal successful send: the frontend said
    // "check your email" and nobody ever got a code, with no error
    // anywhere the person using the portal could see.
    console.error(`external-portal-auth: failed to send OTP email to ${destination}:`, sendResult.error);
  }

  return sendResult;
}

// Portal-account role/table mapping used when provisioning the shadow
// Supabase Auth user that backs the bridged session.
const PORTAL_ROLE: Record<string, string> = {
  attorney: "referring_attorney",
  expert: "medical_expert",
};
const PORTAL_PATH: Record<string, string> = {
  attorney: "/attorney-portal",
  expert: "/expert-portal",
};

// deno-lint-ignore no-explicit-any
async function bridgeToSupabaseAuth(supabaseAdmin: any, account: {
  id: string;
  full_name: string;
  email: string;
  portal_type: string;
  referring_attorney_id: string | null;
  medical_expert_id: string | null;
  assigned_attorney_contact_id: string | null;
}): Promise<{ bridgeEmail: string; bridgeToken: string; portalPath: string }> {
  const email = account.email.trim().toLowerCase();
  const role = PORTAL_ROLE[account.portal_type];
  const portalPath = PORTAL_PATH[account.portal_type] ?? "/";

  const [firstName, ...rest] = account.full_name.trim().split(/\s+/);
  const lastName = rest.join(" ") || firstName;

  // Find an existing shadow auth user for this email, if one was
  // already provisioned on a previous login.
  let authUserId: string | null = null;
  {
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const match = existing?.users?.find(
      (u: { id: string; email?: string }) => u.email?.toLowerCase() === email,
    );
    if (match) authUserId = match.id;
  }

  // Refuse to bridge into an identity that already holds an internal
  // staff role. Every RLS policy in this system treats admin/employee
  // as "see everything, no scoping" — if this email happens to match
  // (or was previously used for) an internal staff account, bridging
  // into it would silently hand the external portal login full
  // cross-firm visibility into every case, invoice, and document in
  // the system, not just their own. This is a hard stop, not a
  // silent downgrade, because an admin/employee row existing here at
  // all means something upstream (account creation, an email typo)
  // needs a human to look at it before this person logs in as anyone.
  if (authUserId) {
    const { data: staffRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", authUserId)
      .in("role", ["admin", "employee"]);
    if (staffRoles && staffRoles.length > 0) {
      throw new Error(
        `Cannot provision external portal session: ${email} is linked to an internal staff account. Contact an administrator.`,
      );
    }
  }

  // First login for this external account — create the shadow user.
  // email_confirm is true because they've already proven ownership of
  // the inbox by receiving and entering the OTP.
  if (!authUserId) {
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName, external_portal: true },
    });
    if (createError || !created?.user) {
      throw new Error(`Could not provision portal session: ${createError?.message ?? "unknown error"}`);
    }
    authUserId = created.user.id;
  }

  // Keep the profile in sync with the external_portal_accounts record
  // on every login (name changes, re-links to a different
  // attorney/expert row, etc. all flow through here). This is what
  // actually gives the person access to their own case data — RLS on
  // appointments/expert_reports/etc. keys off referring_attorney_id /
  // expert_id on this row, so a failed upsert here means a "successful"
  // login that can't see any cases at all, active or closed.
  // Previously this failed on every single call (account_status below
  // is not a real column on profiles — profiles only has is_active;
  // account_status belongs to external_portal_accounts, not this
  // table) and the result was never checked, so the login proceeded
  // anyway with a blank, unlinked profile. Both are fixed here: the
  // bad field is gone, and a failure now hard-stops the login instead
  // of quietly handing out a session that can't see anything.
  //
  // attorney_contact_id (Phase 12) is synced here too — this was
  // missing entirely, which meant every bridged attorney session had
  // profiles.attorney_contact_id = NULL forever, regardless of what
  // external_portal_accounts.assigned_attorney_contact_id said. Since
  // the individual-contact RLS branch (get_current_user_attorney_contact())
  // is the ONLY branch a bridged session can use — the firm-level
  // branch is explicitly excluded for is_external_portal_user = true —
  // a NULL here means appointments/expert_reports/claimants/documents/
  // case_timelines/document_checklist/expert_payments all resolve to
  // zero rows for that attorney, no matter how many real cases they
  // have. Same failure mode as the original bug this comment already
  // describes: a "successful" login that can't see anything.
  const { error: profileSyncError } = await supabaseAdmin.from("profiles").upsert({
    id: authUserId,
    email,
    first_name: firstName,
    last_name: lastName,
    role,
    user_type: "external_portal",
    is_external_portal_user: true,
    referring_attorney_id: account.portal_type === "attorney" ? account.referring_attorney_id : null,
    attorney_contact_id: account.portal_type === "attorney" ? account.assigned_attorney_contact_id : null,
    expert_id: account.portal_type === "expert" ? account.medical_expert_id : null,
    is_active: true,
  });
  if (profileSyncError) {
    throw new Error(`Could not link portal session to case data: ${profileSyncError.message}`);
  }

  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: authUserId, role }, { onConflict: "user_id,role" });

  // Mint a one-time magiclink token the frontend redeems client-side
  // via supabase.auth.verifyOtp({ email, token, type: 'magiclink' }).
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const bridgeToken = linkData?.properties?.email_otp;
  if (linkError || !bridgeToken) {
    throw new Error(`Could not mint portal session token: ${linkError?.message ?? "unknown error"}`);
  }

  return { bridgeEmail: email, bridgeToken, portalPath };
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
