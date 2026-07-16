// Shared helpers for the webauthn-register and webauthn-authenticate Edge Functions.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BadRequest, Unauthorized } from "./errors.ts";

export const RP_NAME = "Medico-Legal Assessment";

/**
 * Builds the two Supabase clients an Edge Function needs:
 *  - `userClient`: acts as the calling user (forwards their Authorization header),
 *    used only to resolve who is making the request.
 *  - `adminClient`: service-role client that bypasses RLS, used for reading/writing
 *    trusted_devices, trusted_device_events and trusted_device_challenges.
 */
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

/**
 * Resolves the authenticated user from the request's Authorization header,
 * or throws a 401 if there isn't one.
 */
export async function requireUser(userClient: SupabaseClient) {
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) throw Unauthorized("You must be signed in to use biometric sign-in.");
  return data.user;
}

/**
 * Resolves the relying party ID and origin to use for WebAuthn ceremonies.
 *
 * WEBAUTHN_ORIGIN may be a comma-separated allowlist (e.g. production + a staging
 * preview). The request's own Origin header is only ever used to pick *which*
 * pre-configured origin to expect back — it can never introduce an origin that
 * wasn't explicitly allow-listed via env vars.
 */
export function resolveRelyingParty(req: Request): { rpID: string; origin: string } {
  const rpID = Deno.env.get("WEBAUTHN_RP_ID") ?? "localhost";
  const configuredOrigins = (Deno.env.get("WEBAUTHN_ORIGIN") ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const requestOrigin = req.headers.get("Origin");
  const origin = requestOrigin && configuredOrigins.includes(requestOrigin)
    ? requestOrigin
    : configuredOrigins[0];

  return { rpID, origin };
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * Persists a freshly generated challenge for (user, purpose), replacing any
 * previous pending challenge for the same purpose so only the latest is valid.
 */
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

/**
 * Retrieves and deletes the pending challenge for (user, purpose) so it can
 * never be replayed, and throws if none exists or it has expired.
 */
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

  // Delete on read regardless of expiry, so a stale challenge is never reusable.
  await adminClient.from("trusted_device_challenges").delete().eq("id", data.id);

  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw BadRequest("This biometric request expired. Please try again.");
  }

  return data.challenge;
}

/** Standard base64 <-> Uint8Array helpers for storing/reading credential public keys. */
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
