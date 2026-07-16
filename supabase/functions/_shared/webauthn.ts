import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BadRequest, Forbidden, Unauthorized } from "./errors.ts";

/**
 * Creates user-scoped and service-role Supabase clients for a request.
 *
 * @param req - The request whose `Authorization` header is applied to the user-scoped client
 * @returns An object containing `userClient` and `adminClient`
 */
export function getClients(req: Request) {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  return {
    userClient: createClient(url, anon, { global: { headers: { Authorization: auth } } }),
    adminClient: createClient(url, service),
  };
}

/**
 * Requires an authenticated user for the current client.
 *
 * @param userClient - The Supabase client used to retrieve the authenticated user
 * @returns The authenticated user
 */
export async function requireUser(userClient: ReturnType<typeof createClient>) {
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw Unauthorized("Sign in with your email and password first.");
  return data.user;
}

/**
 * Validates the request origin and derives the WebAuthn relying-party identifier.
 *
 * @param req - The request whose origin must be authorized.
 * @returns The validated origin and its hostname as the relying-party identifier.
 */
export function resolveRelyingParty(req: Request) {
  const origin = req.headers.get("Origin");
  const allowed = (Deno.env.get("WEBAUTHN_ALLOWED_ORIGINS") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) throw Forbidden("This origin is not allowed for biometric trusted devices.");
  return { origin, rpID: new URL(origin).hostname };
}

/**
 * Stores a biometric challenge for a user and purpose with a five-minute expiration.
 *
 * @param userId - The user associated with the challenge
 * @param purpose - The operation for which the challenge is issued
 * @param challenge - The challenge value to store
 */
export async function storeChallenge(adminClient: ReturnType<typeof createClient>, userId: string, purpose: string, challenge: string) {
  await adminClient.from("trusted_device_challenges").delete().eq("user_id", userId).eq("purpose", purpose);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { error } = await adminClient.from("trusted_device_challenges").insert({ user_id: userId, purpose, challenge, expires_at: expiresAt });
  if (error) throw BadRequest("Unable to create biometric challenge.", error);
}

/**
 * Retrieves and consumes the most recent biometric challenge for a user and purpose.
 *
 * @param userId - The user associated with the challenge
 * @param purpose - The operation for which the challenge was created
 * @returns The challenge value
 */
export async function consumeChallenge(adminClient: ReturnType<typeof createClient>, userId: string, purpose: string) {
  const { data, error } = await adminClient.from("trusted_device_challenges").select("id, challenge, expires_at").eq("user_id", userId).eq("purpose", purpose).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) throw BadRequest("Biometric challenge is missing or expired.");
  await adminClient.from("trusted_device_challenges").delete().eq("id", data.id);
  if (new Date(data.expires_at).getTime() < Date.now()) throw BadRequest("Biometric challenge is missing or expired.");
  return data.challenge as string;
}

/**
 * Encodes a byte array as a Base64 string.
 *
 * @param bytes - The bytes to encode
 * @returns The Base64-encoded representation of `bytes`
 */
export function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Decodes a Base64 string into a byte array.
 *
 * @param value - The Base64-encoded string
 * @returns The decoded bytes
 */
export function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
