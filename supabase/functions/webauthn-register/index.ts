import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { generateRegistrationOptions, verifyRegistrationResponse } from "https://esm.sh/@simplewebauthn/server@13?target=deno";
import { BadRequest, Conflict, jsonResponse, MethodNotAllowed, withErrorHandler } from "../_shared/errors.ts";
import { RP_NAME, bytesToBase64, consumeChallenge, getClients, requireUser, resolveRelyingParty, storeChallenge } from "../_shared/webauthn.ts";

serve(withErrorHandler(async (req) => {
  if (req.method !== "POST") throw MethodNotAllowed();
  const body = await req.json();
  const { userClient, adminClient } = getClients(req);
  const user = await requireUser(userClient);
  const { origin, rpID } = resolveRelyingParty(req);

  if (body.action === "options") {
    const { data: devices } = await adminClient.from("trusted_devices").select("credential_id, transports").eq("user_id", user.id).is("revoked_at", null);
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userID: new TextEncoder().encode(user.id),
      userName: user.email ?? user.id,
      userDisplayName: user.email ?? user.id,
      timeout: 60000,
      attestationType: "none",
      authenticatorSelection: { residentKey: "preferred", userVerification: "required", authenticatorAttachment: "platform" },
      excludeCredentials: (devices ?? []).map((d) => ({ id: d.credential_id, transports: d.transports ?? [] })),
    });
    await storeChallenge(adminClient, user.id, "register", options.challenge);
    return jsonResponse({ options });
  }

  if (body.action === "verify") {
    const expectedChallenge = await consumeChallenge(adminClient, user.id, "register");
    const result = await verifyRegistrationResponse({ response: body.response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
    if (!result.verified || !result.registrationInfo) throw BadRequest("Biometric registration could not be verified.");
    const { credential } = result.registrationInfo;

    const { data: existing } = await adminClient.from("trusted_devices").select("id").eq("credential_id", credential.id).is("revoked_at", null).maybeSingle();
    if (existing) throw Conflict("This authenticator is already registered.");

    const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 100) : "Trusted device";
    const { data: device, error } = await adminClient.from("trusted_devices").insert({
      user_id: user.id,
      credential_id: credential.id,
      public_key: bytesToBase64(credential.publicKey),
      sign_count: credential.counter ?? 0,
      transports: credential.transports ?? [],
      device_label: label,
      user_agent: typeof body.userAgent === "string" ? body.userAgent : req.headers.get("User-Agent"),
      platform: typeof body.platform === "string" ? body.platform : null,
    }).select("id").single();
    if (error) throw error;

    await adminClient.from("trusted_device_events").insert({ device_id: device.id, user_id: user.id, event_type: "registered", user_agent: req.headers.get("User-Agent"), metadata: {} });

    return jsonResponse({ verified: true, credentialId: credential.id, label });
  }

  throw BadRequest("Unknown biometric registration action.");
}));
