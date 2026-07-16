import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { generateRegistrationOptions, verifyRegistrationResponse } from "https://esm.sh/@simplewebauthn/server@13?target=deno";
import { BadRequest, jsonResponse, MethodNotAllowed, withErrorHandler } from "../_shared/errors.ts";
import { bytesToBase64, getClients, requireUser, resolveRelyingParty, storeChallenge, consumeChallenge } from "../_shared/webauthn.ts";

serve(withErrorHandler(async (req) => {
  if (req.method !== "POST") throw MethodNotAllowed();
  const body = await req.json();
  const { userClient, adminClient } = getClients(req);
  const user = await requireUser(userClient);
  const { origin, rpID } = resolveRelyingParty(req);
  if (body.action === "options") {
    const { data: devices } = await adminClient.from("trusted_devices").select("credential_id, transports").eq("user_id", user.id).is("revoked_at", null);
    const options = await generateRegistrationOptions({
      rpName: "Kutlwano Associate", rpID, userID: new TextEncoder().encode(user.id), userName: user.email ?? user.id,
      attestationType: "none", authenticatorSelection: { residentKey: "preferred", userVerification: "required", authenticatorAttachment: "platform" }, supportedAlgorithmIDs: [-7, -257],
      excludeCredentials: (devices ?? []).map((d) => ({ id: d.credential_id, transports: d.transports ?? [] })),
    });
    await storeChallenge(adminClient, user.id, "register", options.challenge);
    return jsonResponse({ options });
  }
  if (body.action === "verify") {
    const expectedChallenge = await consumeChallenge(adminClient, user.id, "register");
    const result = await verifyRegistrationResponse({ response: body.response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
    if (!result.verified || !result.registrationInfo) throw BadRequest("Biometric registration could not be verified.");
    const credential = result.registrationInfo.credential;
    const label = body.label || "Trusted device";
    const { data: device, error } = await adminClient.from("trusted_devices").upsert({
      user_id: user.id, credential_id: credential.id, public_key: bytesToBase64(credential.publicKey), sign_count: credential.counter, transports: credential.transports ?? [], device_label: label, user_agent: body.userAgent ?? null, platform: body.platform ?? null, revoked_at: null, revoked_by: null, revoked_reason: null,
    }, { onConflict: "credential_id" }).select("id").single();
    if (error) throw BadRequest("Unable to save trusted device.", error);
    await adminClient.from("trusted_device_events").insert({ device_id: device.id, user_id: user.id, event_type: "enrolled", user_agent: body.userAgent ?? null, metadata: { platform: body.platform ?? null } });
    return jsonResponse({ verified: true, credentialId: credential.id, label });
  }
  throw BadRequest("Unknown biometric registration action.");
}));
