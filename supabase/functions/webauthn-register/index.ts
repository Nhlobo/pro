import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "npm:@simplewebauthn/server";

import {
  createChallenge,
  consumeChallenge,
  getUserCredentials,
  saveCredential,
  writeAuditEvent,
} from "../_shared/database.ts";

import {
  getAuthenticatedUser,
  json,
  corsHeaders,
} from "../_shared/supabase.ts";

import {
  RP_ID,
  RP_NAME,
  ORIGIN,
} from "../_shared/webauthn.ts";

serve(async (req) => {

  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {

    const user = await getAuthenticatedUser(req);

    const body = await req.json();

    switch (body.action) {

      case "options":
        return await registrationOptions(user);

      case "verify":
        return await verifyRegistration(user, body);

      default:
        return json(
          {
            success: false,
            error: "Unknown action",
          },
          400,
        );
    }

  } catch (e) {

    console.error(e);

    return json(
      {
        success: false,
        error: e instanceof Error
          ? e.message
          : "Unexpected server error",
      },
      500,
    );
  }

});

async function registrationOptions(user: any) {

  const credentials =
    await getUserCredentials(user.id);

  const options =
    await generateRegistrationOptions({

      rpName: RP_NAME,

      rpID: RP_ID,

      userName: user.email,

      userID: user.id,

      attestationType: "none",

      authenticatorSelection: {

        residentKey: "preferred",

        userVerification: "preferred",

        authenticatorAttachment: "platform",

      },

      excludeCredentials:

        credentials.map((credential) => ({

          id: credential.credential_id,

          transports:

            credential.transports ?? undefined,

        })),

      supportedAlgorithmIDs: [

        -7,

        -257,

      ],

    });

  await createChallenge(

    user.id,

    options.challenge,

    "registration",

    new Date(
      Date.now() + 5 * 60 * 1000,
    ).toISOString(),

  );

  return json({

    success: true,

    data: {

      options,

    },

  });

      }
