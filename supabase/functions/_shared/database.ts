import { supabaseAdmin } from "./supabase.ts";

export interface TrustedDevice {

  id: string;

  user_id: string;

  credential_id: string;

  public_key: string;

  counter: number;

  device_label: string;

  platform: string | null;

  user_agent: string | null;

  transports: string[] | null;

  last_used_at: string | null;

  revoked_at: string | null;

}

export async function createChallenge(

  userId: string,

  challenge: string,

  type: "registration" | "authentication",

  expiresAt: string,

) {

  const { error } = await supabaseAdmin

    .from("trusted_device_challenges")

    .insert({

      user_id: userId,

      challenge,

      challenge_type: type,

      expires_at: expiresAt,

    });

  if (error) throw error;

}

export async function getChallenge(

  userId: string,

  type: "registration" | "authentication",

) {

  const { data, error } = await supabaseAdmin

    .from("trusted_device_challenges")

    .select("*")

    .eq("user_id", userId)

    .eq("challenge_type", type)

    .is("used_at", null)

    .gt("expires_at", new Date().toISOString())

    .order("created_at", { ascending: false })

    .limit(1)

    .maybeSingle();

  if (error) throw error;

  return data;

}

export async function consumeChallenge(

  userId: string,

  challenge: string,

  type: "registration" | "authentication",

) {

  const { error } = await supabaseAdmin.rpc(

    "consume_trusted_device_challenge",

    {

      p_user: userId,

      p_challenge: challenge,

      p_type: type,

    },

  );

  if (error) throw error;

}

export async function getUserCredentials(

  userId: string,

) {

  const { data, error } = await supabaseAdmin

    .from("trusted_devices")

    .select("*")

    .eq("user_id", userId)

    .is("revoked_at", null);

  if (error) throw error;

  return (data ?? []) as TrustedDevice[];

}

export async function getCredential(

  credentialId: string,

) {

  const { data, error } = await supabaseAdmin

    .from("trusted_devices")

    .select("*")

    .eq("credential_id", credentialId)

    .is("revoked_at", null)

    .maybeSingle();

  if (error) throw error;

  return data as TrustedDevice | null;

}

export async function saveCredential(

  values: {

    user_id: string;

    credential_id: string;

    public_key: string;

    counter: number;

    device_label: string;

    platform: string;

    user_agent: string;

    transports: string[];

  },

) {

  const { data, error } = await supabaseAdmin

    .from("trusted_devices")

    .insert(values)

    .select()

    .single();

  if (error) throw error;

  return data;

}

export async function updateCredentialCounter(

  id: string,

  counter: number,

) {

  const { error } = await supabaseAdmin

    .from("trusted_devices")

    .update({

      counter,

      last_used_at: new Date().toISOString(),

    })

    .eq("id", id);

  if (error) throw error;

}

export async function revokeCredential(

  id: string,

  reason: string,

  revokedBy: string,

) {

  const { error } = await supabaseAdmin

    .from("trusted_devices")

    .update({

      revoked_at: new Date().toISOString(),

      revoked_reason: reason,

      revoked_by: revokedBy,

    })

    .eq("id", id);

  if (error) throw error;

}

export async function writeAuditEvent(

  values: {

    user_id: string;

    trusted_device_id?: string | null;

    credential_id?: string | null;

    event_type:
      | "registration"
      | "authentication"
      | "failed_authentication"
      | "rename"
      | "revoke";

    success?: boolean;

    message?: string;

    ip_address?: string | null;

    user_agent?: string | null;

  },

) {

  const { error } = await supabaseAdmin

    .from("trusted_device_events")

    .insert({

      success: true,

      ...values,

    });

  if (error) throw error;

  }
