// Shared helpers for the secure authentication module.
// Used by every auth-* edge function. Never import from the frontend.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export function userClient(req: Request) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateRandomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateNumericOtp(digits = 6): string {
  const max = 10 ** digits;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const n = buf[0] % max;
  return n.toString().padStart(digits, "0");
}

// 100 worst-of-the-worst — enough to satisfy the "block common passwords" rule
// without bloating the function. Add more if compliance ever requires it.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd", "p@ssword", "p@ssw0rd",
  "qwerty", "qwerty123", "asdfgh", "zxcvbn", "letmein", "welcome", "welcome1",
  "admin", "administrator", "root", "toor", "iloveyou", "abc123", "123456",
  "1234567", "12345678", "123456789", "1234567890", "111111", "000000",
  "monkey", "dragon", "master", "trustno1", "football", "baseball", "shadow",
  "michael", "jordan", "michelle", "jennifer", "summer", "winter", "spring",
  "autumn", "sunshine", "princess", "pokemon", "starwars", "superman", "batman",
  "freedom", "whatever", "qazwsx", "mustang", "harley", "ranger", "soccer",
  "killer", "hockey", "george", "buster", "thomas", "robert", "tigger",
  "charlie", "andrew", "matthew", "access", "yankees", "dallas", "boston",
  "computer", "secret", "love", "money", "qwerty1", "qwerty12", "letmein1",
  "welcome123", "admin123", "admin1234", "admin1", "test", "test123",
  "testing", "abcdefg", "abcd1234", "asdf1234", "qweasdzxc", "kutlwano",
  "medicolegal", "medico", "legal", "lawfirm", "attorney", "lawyer",
  "company", "office", "default", "changeme", "temp", "temp123", "user123",
  "user1234", "demo", "demo123", "guest", "guest123",
]);

export function validatePasswordPolicy(password: string): string | null {
  if (typeof password !== "string") return "Invalid password";
  if (password.length < 12) return "Password must be at least 12 characters long";
  if (password.length > 200) return "Password is too long";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least one special character";
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return "Password is too common, please choose another";
  return null;
}

export interface EventContext {
  ip: string | null;
  user_agent: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
}

export function extractEventContext(req: Request): EventContext {
  const ua = req.headers.get("user-agent") ?? null;
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    null;

  let browser: string | null = null;
  let os: string | null = null;
  let device: string | null = null;
  if (ua) {
    const u = ua.toLowerCase();
    if (u.includes("edg/")) browser = "Edge";
    else if (u.includes("chrome/")) browser = "Chrome";
    else if (u.includes("safari/") && !u.includes("chrome/")) browser = "Safari";
    else if (u.includes("firefox/")) browser = "Firefox";
    if (u.includes("windows")) os = "Windows";
    else if (u.includes("mac os")) os = "macOS";
    else if (u.includes("android")) os = "Android";
    else if (u.includes("iphone") || u.includes("ipad")) os = "iOS";
    else if (u.includes("linux")) os = "Linux";
    device = u.includes("mobile") ? "Mobile" : "Desktop";
  }
  return { ip, user_agent: ua, device, browser, os };
}

export async function recordAuthEvent(
  admin: ReturnType<typeof adminClient>,
  params: {
    user_id: string | null;
    email: string | null;
    event_type: string;
    ctx: EventContext;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await admin.rpc("record_auth_event", {
    _user_id: params.user_id,
    _email: params.email,
    _event_type: params.event_type,
    _ip: params.ctx.ip,
    _user_agent: params.ctx.user_agent,
    _device: params.ctx.device,
    _browser: params.ctx.browser,
    _os: params.ctx.os,
    _metadata: params.metadata ?? {},
  });
  if (error) console.error("record_auth_event failed", error);
}

export async function requireAdmin(req: Request): Promise<{ ok: true; userId: string } | { ok: false; res: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, res: json({ error: "Unauthorized" }, 401) };
  }
  const u = userClient(req);
  const { data: userData, error: userErr } = await u.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false, res: json({ error: "Unauthorized" }, 401) };
  }
  const { data: isAdmin } = await u.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
  if (!isAdmin) {
    return { ok: false, res: json({ error: "Forbidden" }, 403) };
  }
  return { ok: true, userId: userData.user.id };
}

export function appBaseUrl(): string {
  return Deno.env.get("APP_BASE_URL") || "https://kamedico-legal.co.za";
}

// Generic branded HTML email wrapper to keep things consistent.
export function brandedEmail(title: string, bodyHtml: string): string {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <div style="text-align:center; border-bottom: 1px solid #e5e7eb; padding-bottom: 18px; margin-bottom: 24px;">
      <h1 style="margin:0; color:#0f172a; font-size:22px;">${title}</h1>
      <p style="margin:6px 0 0; color:#64748b; font-size:13px;">Medico-Legal Pro</p>
    </div>
    ${bodyHtml}
    <p style="font-size:11px; color:#94a3b8; margin-top:28px; text-align:center;">
      This is an automated security message. If you did not expect it, please contact your administrator.
    </p>
  </div>`;
}
