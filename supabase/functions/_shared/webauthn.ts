// Shared helpers for the webauthn-register and webauthn-authenticate Edge Functions.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BadRequest, Unauthorized } from "./errors.ts";

export const RP_NAME = "Medico-Legal Assessment";

export function getClients(req: Request): { userClient: SupabaseClient; adminClient: SupabaseClient } {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { userClient, adminClient };
}

export async function requireUser(userClient: SupabaseClient) {
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) throw Unauthorized("You must be signed in to use biometric sign-in.");
  return data.user;
}

/**
 * Work out the WebAuthn Relying Party for this request.
 *
 * The RP ID must match the hostname the browser is actually on, otherwise the
 * browser rejects the ceremony (and previously, with no WEBAUTHN_* secrets set,
 * every enrollment fell back to "localhost" and failed).
 *
 * Resolution order:
 *  1. The request Origin (or Referer) header, when its hostname is allowed.
 *  2. The configured WEBAUTHN_ORIGIN list, when present.
 *  3. http://localhost:5173 for local development.
 */
export function resolveRelyingParty(req: Request): { rpID: string; origin: string } {
  const configuredOrigins = (Deno.env.get("WEBAUTHN_ORIGIN") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const configuredRpId = Deno.env.get("WEBAUTHN_RP_ID")?.trim();

  const headerOrigin = req.headers.get("Origin") ?? (() => {
    const referer = req.headers.get("Referer");
    if (!referer) return null;
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  })();

  const isAllowed = (origin: string): boolean => {
    if (configuredOrigins.includes(origin)) return true;
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      return false;
    }
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return false;
    }
    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host === "lovable.app" || host.endsWith(".lovable.app")) return true;
    if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
    if (configuredRpId && (host === configuredRpId || host.endsWith(`.${configuredRpId}`))) return true;
    return false;
  };

  if (headerOrigin && isAllowed(headerOrigin)) {
    return { rpID: new URL(headerOrigin).hostname, origin: headerOrigin };
  }

  if (configuredOrigins.length) {
    const fallback = configuredOrigins[0];
    return { rpID: configuredRpId || new URL(fallback).hostname, origin: fallback };
  }

  return { rpID: configuredRpId || "localhost", origin: "http://localhost:5173" };
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export async function storeChallenge(
  adminClient: SupabaseClient,
  userId: string,
  purpose: string,
  challenge: string,
) {
  await adminClient.from("trusted_device_challenges").delete().eq("user_id", userId).eq("purpose", purpose);
  const { error } = await adminClient.from("trusted_device_challenges").insert({
    user_id: userId,
    purpose,
    challenge,
    expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
  });
  if (error) throw error;
}

export async function consumeChallenge(
  adminClient: SupabaseClient,
  userId: string,
  purpose: string,
): Promise<string> {
  const { data, error } = await adminClient
    .from("trusted_device_challenges")
    .select("id, challenge, expires_at")
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw BadRequest("No pending biometric request found. Please try again.");

  await adminClient.from("trusted_device_challenges").delete().eq("id", data.id);

  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw BadRequest("This biometric request expired. Please try again.");
  }

  return data.challenge;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
           }
