// Shared helpers for the authentication module edge functions.
// All functions here are side-effect free; they only depend on Web Crypto and the request.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function newCorrelationId(prefix = 'auth'): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function structuredLog(
  level: 'info' | 'warn' | 'error',
  fn: string,
  correlationId: string,
  message: string,
  extra: Record<string, unknown> = {},
) {
  const payload = { ts: new Date().toISOString(), level, fn, correlationId, message, ...extra };
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// 6-digit numeric OTP, cryptographically random.
export function generateOtp(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % 1_000_000).toString().padStart(6, '0');
}

// Long URL-safe token for activation / password reset links.
export function generateUrlToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
}

export function extractContext(req: Request): RequestContext {
  const ip =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null;
  const ua = req.headers.get('user-agent');
  const lower = (ua || '').toLowerCase();
  const browser =
    /edg\//.test(lower) ? 'Edge' :
    /chrome\//.test(lower) ? 'Chrome' :
    /firefox\//.test(lower) ? 'Firefox' :
    /safari\//.test(lower) ? 'Safari' :
    null;
  const os =
    /windows/.test(lower) ? 'Windows' :
    /android/.test(lower) ? 'Android' :
    /iphone|ipad|ios/.test(lower) ? 'iOS' :
    /mac os/.test(lower) ? 'macOS' :
    /linux/.test(lower) ? 'Linux' :
    null;
  const device =
    /mobile|android|iphone/.test(lower) ? 'Mobile' :
    /ipad|tablet/.test(lower) ? 'Tablet' :
    ua ? 'Desktop' : null;
  return { ip, userAgent: ua, browser, os, device };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Password policy: min 12 chars, upper, lower, digit, symbol.
export function validatePassword(pw: string): { ok: boolean; reason?: string } {
  if (typeof pw !== 'string' || pw.length < 12) return { ok: false, reason: 'Password must be at least 12 characters' };
  if (!/[A-Z]/.test(pw)) return { ok: false, reason: 'Password must include an uppercase letter' };
  if (!/[a-z]/.test(pw)) return { ok: false, reason: 'Password must include a lowercase letter' };
  if (!/[0-9]/.test(pw)) return { ok: false, reason: 'Password must include a number' };
  if (!/[^A-Za-z0-9]/.test(pw)) return { ok: false, reason: 'Password must include a symbol' };
  return { ok: true };
}

export function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
