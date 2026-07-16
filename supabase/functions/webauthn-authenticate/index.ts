import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { generateAuthenticationOptions, verifyAuthenticationResponse } from "https://esm.sh/@simplewebauthn/server@13?target=deno";
import { BadRequest, Forbidden, jsonResponse, MethodNotAllowed, NotFound, withErrorHandler } from "../_shared/errors.ts";
import { base64ToBytes, getClients, requireUser, resolveRelyingParty, storeChallenge, consumeChallenge } from "../_shared/webauthn.ts";

serve(withErrorHandler(async (req) => {
  if (req.method !== "POST") throw MethodNotAllowed();
  const body = await req.json();
  const { userClient, adminClient } = getClients(req);
  const user = await requireUser(userClient);
  const { origin, rpID } = resolveRelyingParty(req);
  if (body.action === "options") {
    const { data: devices } = await adminClient.from("trusted_devices").select("credential_id, transports").eq("user_id", user.id).is("revoked_at", null);
    if (!devices?.length) throw NotFound("No enrolled biometric devices for this account.");
    const options = await generateAuthenticationOptions({ rpID, userVerification: "required", allowCredentials: devices.map((d) => ({ id: d.credential_id, transports: d.transports ?? [] })) });
    await storeChallenge(adminClient, user.id, "auth", options.challenge);
    return jsonResponse({ options });
  }
  if (body.action === "verify") {
    const { data: device } = await adminClient.from("trusted_devices").select("id, credential_id, public_key, sign_count, transports").eq("user_id", user.id).eq("credential_id", body.response?.id ?? "").is("revoked_at", null).maybeSingle();
    if (!device) throw Forbidden("This device is not enrolled or has been revoked.");
    const expectedChallenge = await consumeChallenge(adminClient, user.id, "auth");
    const result = await verifyAuthenticationResponse({ response: body.response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true, credential: { id: device.credential_id, publicKey: base64ToBytes(device.public_key), counter: Number(device.sign_count ?? 0), transports: device.transports ?? [] } });
    if (!result.verified) throw BadRequest("Biometric unlock could not be verified.");
    await adminClient.from("trusted_devices").update({ sign_count: result.authenticationInfo.newCounter, last_used_at: new Date().toISOString() }).eq("id", device.id);
    await adminClient.from("trusted_device_events").insert({ device_id: device.id, user_id: user.id, event_type: "unlocked", user_agent: req.headers.get("User-Agent"), metadata: {} });
    return jsonResponse({ verified: true });
  }
  throw BadRequest("Unknown biometric authentication action.");
}));
