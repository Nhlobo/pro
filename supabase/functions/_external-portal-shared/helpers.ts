// External Portal Module — shared helpers for its own edge functions ONLY.
//
// Deliberately NOT placed in supabase/functions/_shared (the app-wide
// shared folder) to keep this module's edge-function layer fully
// isolated, per the architecture requirement. Only
// external-portal-auth and external-portal-admin-links import from
// here.

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

export function errorResponse(message: string, status = 400, code?: string): Response {
  return jsonResponse({ success: false, error: message, code }, status);
}

/** SHA-256 hex digest — used to store only hashes of tokens/OTP codes at rest. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Cryptographically random URL-safe token for one-time links and sessions. */
export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Numeric OTP code of the given length, e.g. "483920" for length 6. */
export function randomOtpCode(length: number): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => (b % 10).toString()).join("");
}

/** "jane.doe@example.com" -> "j***@example.com" — never expose the full address pre-auth. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(local.length - 1, 3))}@${domain}`;
}

export function getClientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

export interface PortalSettings {
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
export async function getPortalSettings(supabaseAdmin: any): Promise<PortalSettings> {
  const { data } = await supabaseAdmin
    .from("external_portal_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return data ? { ...DEFAULT_SETTINGS, ...data } : DEFAULT_SETTINGS;
}

export function otpEmailHtml(params: { fullName: string; code: string; expiryMinutes: number; portalLabel: string }): string {
  const { fullName, code, expiryMinutes, portalLabel } = params;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <p>Hi ${escapeHtml(fullName)},</p>
      <p>Here is your one-time verification code for the ${escapeHtml(portalLabel)} Portal:</p>
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; margin: 24px 0;">${escapeHtml(code)}</p>
      <p>This code expires in ${expiryMinutes} minutes. If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
}

export function registrationLinkEmailHtml(params: { fullName: string; link: string; expiryHours: number; portalLabel: string }): string {
  const { fullName, link, expiryHours, portalLabel } = params;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <p>Hi ${escapeHtml(fullName)},</p>
      <p>You've been granted access to the ${escapeHtml(portalLabel)} Portal. Use the secure link below to register — it can only be used once and expires in ${expiryHours} hours:</p>
      <p style="margin: 24px 0;"><a href="${link}" style="background:#00BAAD;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;">Access Your Portal</a></p>
      <p>If the button doesn't work, copy this link into your browser:<br/>${link}</p>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const PORTAL_LABEL: Record<string, string> = {
  attorney: "Referring Attorney",
  expert: "Medical Expert",
};
