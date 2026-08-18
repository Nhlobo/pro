// External Portal Module — admin-side link management.
//
// Staff-authenticated only (verify_jwt = true, see supabase/config.toml).
// Handles the "Admin creates portal access -> system generates a
// one-time secure link" step. This function never runs on behalf of
// an external end user — that's external-portal-auth, a separate
// function with a separate trust boundary.
//
// Deliberately self-contained: no imports from ../_shared or
// ../_external-portal-shared. Everything this function needs (CORS,
// crypto helpers, email sending) is inlined below so deployment never
// depends on the bundler resolving sibling folders.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_ORIGIN = "https://medico-legal-pro-71z1.onrender.com";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ success: false, error: message }, status);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Same pattern used by supabase/functions/create-user/index.ts, kept
// identical on purpose so email validation behaves consistently across
// the app rather than introducing a second, stricter/looser regex here.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw);
  if (!email) return false;
  if (email.length > 254) return false;
  if (/\s/.test(email)) return false;
  return EMAIL_REGEX.test(email);
}

const PORTAL_LABEL: Record<string, string> = { attorney: "Referring Attorney", expert: "Medical Expert" };

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
  auto_expire_on_all_cases_closed: true,
};

// deno-lint-ignore no-explicit-any
async function getPortalSettings(supabaseAdmin: any): Promise<PortalSettings> {
  const { data } = await supabaseAdmin.from("external_portal_settings").select("*").eq("id", 1).maybeSingle();
  return data ? { ...DEFAULT_SETTINGS, ...data } : DEFAULT_SETTINGS;
}

// Shown only to Medical Expert accounts — MFA is currently required for
// that role only (POPIA Sec. 19: medical records / ID copies / reports).
// Inline SVG rather than a hosted <img>, so it can never show up as a
// broken image in a client that blocks remote images.
const AUTHENTICATOR_NOTICE = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 22px 0; background: #f0fbfc; border: 1px solid #b9ecf1; border-radius: 6px;">
    <tr>
      <td style="padding: 16px 18px; vertical-align: top; width: 40px;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L4 5v6c0 5.25 3.4 9.74 8 11 4.6-1.26 8-5.75 8-11V5l-8-3z" stroke="#159baf" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M9 12.2l2.1 2.1L15.5 9.8" stroke="#159baf" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </td>
      <td style="padding: 16px 18px 16px 0; vertical-align: top;">
        <p style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #0f766e;">You'll need an authenticator app</p>
        <p style="margin: 0; font-size: 12px; color: #374151; line-height: 1.5;">
          As a Medical Expert, your account requires two-factor authentication to protect medical records and reports.
          Before your first login, install a free authenticator app such as <strong>Google Authenticator</strong>,
          <strong>Microsoft Authenticator</strong>, <strong>Authy</strong>, or <strong>1Password</strong> on your phone —
          you'll scan a QR code to finish setting up your account.
        </p>
      </td>
    </tr>
  </table>`;

async function sendLinkEmail(to: string, fullName: string, link: string, expiryHours: number, portalLabel: string, portalType: string): Promise<boolean> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured — access link email not sent");
    return false;
  }
  const resend = new Resend(resendApiKey);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f4f6f7;">
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1fb6ce 0%, #159baf 100%); color: #ffffff; padding: 22px 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 16px; letter-spacing: 0.5px;">KUTLWANO &amp; ASSOCIATES (PTY) LTD</h1>
          <p style="margin: 4px 0 0; font-size: 11px; opacity: 0.9;">Medico-Legal Service</p>
        </div>

        <div style="padding: 28px 28px 8px;">
          <p style="color: #1f2937; font-size: 14px; margin: 0 0 12px;">Hi ${escapeHtml(fullName)},</p>
          <p style="color: #374151; font-size: 14px; margin: 0 0 8px;">
            You've been granted access to the <strong>${escapeHtml(portalLabel)} Portal</strong>. Use the secure
            link below to register — it can only be used once and expires in ${expiryHours} hours.
          </p>

          <div style="text-align: center; margin: 26px 0;">
            <a href="${link}" style="background: linear-gradient(135deg, #1fb6ce 0%, #159baf 100%); color: #ffffff; padding: 13px 28px; text-decoration: none; border-radius: 5px; font-size: 14px; font-weight: 600; display: inline-block;">
              Access Your Portal
            </a>
          </div>

          <p style="color: #6b7280; font-size: 12px; margin: 0 0 20px;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${link}" style="color: #159baf; word-break: break-all;">${link}</a>
          </p>

          ${portalType === "expert" ? AUTHENTICATOR_NOTICE : ""}
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
    </div>`;
  try {
    await resend.emails.send({
      from: "Kutlwano & Associate <noreply@kamedico-legal.co.za>",
      to: [to],
      subject: `Your ${portalLabel} Portal access link`,
      html,
      reply_to: "info@kamedico-legal.co.za",
    });
    return true;
  } catch (err) {
    console.error("Failed to send access link email:", err);
    return false;
  }
}

type Action = "generate_link" | "revoke_link";

interface RequestBody {
  action: Action;
  account_id?: string;
  link_id?: string;
  reason?: string;
  send_email?: boolean;
  // Optional override for generate_link: send this link to a specific
  // address instead of the account's current email — either one picked
  // from that account's email history, or a brand-new address. When
  // omitted, behavior is unchanged (falls back to account.email).
  email?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Missing authorization header", 401);

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) return errorResponse("Invalid authentication", 401);

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return errorResponse("Admin privileges required", 403);

    const body: RequestBody = await req.json();

    if (body.action === "generate_link") {
      if (!body.account_id) return errorResponse("account_id is required");

      const { data: account, error: acctError } = await supabaseAdmin
        .from("external_portal_accounts")
        .select("id, full_name, email, portal_type, status, deleted_at")
        .eq("id", body.account_id)
        .single();

      if (acctError || !account) return errorResponse("Account not found");
      if (account.deleted_at) return errorResponse("Account is in the Recycle Bin — restore it first");
      if (account.status !== "active") return errorResponse(`Account is ${account.status} — set it to Active first`);

      // Resolve which address this link actually goes to. Defaults to
      // the account's current email (unchanged behavior) but an admin
      // may override it with either a previously-used address or a
      // brand-new one — validated server-side regardless of source,
      // since the frontend's "existing email" list is not itself proof
      // of validity (it was validated when first entered, but we never
      // trust the client not to tamper with the request body).
      const rawTargetEmail = body.email && body.email.trim() ? body.email : account.email;
      const targetEmail = normalizeEmail(rawTargetEmail);
      if (!isValidEmail(targetEmail)) {
        return errorResponse("Invalid email address — check for typos, missing '@', or a missing domain");
      }

      await supabaseAdmin
        .from("external_portal_access_links")
        .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_reason: "Superseded by new link" })
        .eq("account_id", account.id)
        .eq("status", "pending");

      const settings = await getPortalSettings(supabaseAdmin);
      const rawToken = randomToken(32);
      const tokenHash = await sha256Hex(rawToken);
      const expiresAt = new Date(Date.now() + settings.access_link_expiry_hours * 60 * 60 * 1000).toISOString();

      const { data: link, error: linkError } = await supabaseAdmin
        .from("external_portal_access_links")
        .insert({
          account_id: account.id,
          token_hash: tokenHash,
          expires_at: expiresAt,
          created_by: user.id,
          sent_to_email: targetEmail,
        })
        .select("id, expires_at, created_at")
        .single();

      if (linkError) return errorResponse(linkError.message);

      // If the resolved address differs from the account's current
      // email, that address becomes the account's new current email
      // (it's what future OTP logins will be sent to — see
      // external-portal-auth, which always sends OTPs to account.email)
      // and is recorded in the email-history table. The previous
      // address is NOT deleted from history — only its is_current flag
      // flips to false — so it stays selectable/auditable later.
      const emailChanged = targetEmail !== normalizeEmail(account.email);
      if (emailChanged) {
        const { error: updateEmailError } = await supabaseAdmin
          .from("external_portal_accounts")
          .update({ email: targetEmail })
          .eq("id", account.id);

        if (updateEmailError) {
          // Most likely the (portal_type, email) uniqueness constraint —
          // another active account already uses this address. Roll the
          // link back rather than leaving an inconsistent state.
          await supabaseAdmin.from("external_portal_access_links").delete().eq("id", link.id);
          const msg = updateEmailError.message?.includes("external_portal_accounts_email_active_uq")
            ? "Another active account already uses this email address for this portal type."
            : updateEmailError.message;
          return errorResponse(msg);
        }

        await supabaseAdmin
          .from("external_portal_account_emails")
          .update({ is_current: false })
          .eq("account_id", account.id)
          .eq("is_current", true);

        const { error: historyError } = await supabaseAdmin
          .from("external_portal_account_emails")
          .upsert(
            { account_id: account.id, email: targetEmail, is_current: true, created_by: user.id },
            { onConflict: "account_id,email" },
          );
        // Non-fatal: the link itself is already correct (sent_to_email
        // is set regardless), so a history-write hiccup shouldn't block
        // the admin from sending the link. Logged for visibility only.
        if (historyError) console.error("Failed to record email history:", historyError);
      }

      const portalLabel = PORTAL_LABEL[account.portal_type] ?? "External";
      const linkUrl = `${APP_ORIGIN}/external-portal/sign-in?token=${rawToken}`;

      let emailSent = false;
      if (body.send_email !== false) {
        emailSent = await sendLinkEmail(targetEmail, account.full_name, linkUrl, settings.access_link_expiry_hours, portalLabel, account.portal_type);
      }

      await supabaseAdmin.rpc("external_portal_log_audit", {
        _actor_type: "admin",
        _actor_id: user.id,
        _account_id: account.id,
        _action: "access_link_generated",
        _details: { link_id: link.id, email_sent: emailSent, sent_to_email: targetEmail, email_changed: emailChanged },
      });

      return jsonResponse({
        success: true,
        data: { link_id: link.id, link_url: linkUrl, expires_at: link.expires_at, email_sent: emailSent, sent_to_email: targetEmail },
      });
    }

    if (body.action === "revoke_link") {
      if (!body.link_id) return errorResponse("link_id is required");

      const { data: link, error } = await supabaseAdmin
        .from("external_portal_access_links")
        .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_reason: body.reason || "Revoked by admin" })
        .eq("id", body.link_id)
        .eq("status", "pending")
        .select("id, account_id")
        .single();

      if (error || !link) return errorResponse("Link not found or already used/revoked");

      await supabaseAdmin.rpc("external_portal_log_audit", {
        _actor_type: "admin",
        _actor_id: user.id,
        _account_id: link.account_id,
        _action: "access_link_revoked",
        _details: { link_id: link.id, reason: body.reason || null },
      });

      return jsonResponse({ success: true, data: { link_id: link.id } });
    }

    return errorResponse("Unknown action", 400);
  } catch (err) {
    console.error("external-portal-admin-links error:", err);
    return errorResponse(err instanceof Error ? err.message : "Internal server error", 500);
  }
});
