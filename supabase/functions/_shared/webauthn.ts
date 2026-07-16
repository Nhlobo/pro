import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  type GenerateRegistrationOptionsOpts,
  type GenerateAuthenticationOptionsOpts,
} from "npm:@simplewebauthn/server@13";

export const RP_NAME = "Medico-Legal Assessment";

export const RP_ID =
  Deno.env.get("WEBAUTHN_RP_ID") ??
  "localhost";

export const ORIGIN =
  Deno.env.get("WEBAUTHN_ORIGIN") ??
  "http://localhost:5173";

/**
 * Registration options
 */
export async function createRegistrationOptions(

  userId: string,

  email: string,

  existingCredentialIds: string[] = []

) {

  const options = await generateRegistrationOptions({

    rpName: RP_NAME,

    rpID: RP_ID,

    userID: userId,

    userName: email,

    userDisplayName: email,

    timeout: 60000,

    attestationType: "none",

    authenticatorSelection: {

      residentKey: "preferred",

      userVerification: "preferred",

      authenticatorAttachment: "platform",

    },

    excludeCredentials: existingCredentialIds.map(id => ({

      id,

      type: "public-key",

    })),

  } satisfies GenerateRegistrationOptionsOpts);

  return options;
}

/**
 * Authentication options
 */
export async function createAuthenticationOptions(

  credentialIds: string[]

) {

  const options = await generateAuthenticationOptions({

    rpID: RP_ID,

    timeout: 60000,

    userVerification: "preferred",

    allowCredentials: credentialIds.map(id => ({

      id,

      type: "public-key",

    })),

  } satisfies GenerateAuthenticationOptionsOpts);

  return options;
}

/**
 * Base64URL → Uint8Array
 */
export function base64URLToBuffer(value: string): Uint8Array {

  const base64 = value

    .replace(/-/g, "+")

    .replace(/_/g, "/");

  const binary = atob(base64);

  return Uint8Array.from(

    binary,

    c => c.charCodeAt(0)

  );
}

/**
 * Uint8Array → Base64URL
 */
export function bufferToBase64URL(

  buffer: Uint8Array

): string {

  const binary = String.fromCharCode(...buffer);

  return btoa(binary)

    .replace(/\+/g, "-")

    .replace(/\//g, "_")

    .replace(/=/g, "");

}

/**
 * Challenge lifetime
 */
export const CHALLENGE_TTL_MINUTES = 5;

/**
 * Returns challenge expiry timestamp.
 */
export function challengeExpiresAt() {

  return new Date(

    Date.now() +

    CHALLENGE_TTL_MINUTES *

    60 *

    1000

  ).toISOString();

      }
