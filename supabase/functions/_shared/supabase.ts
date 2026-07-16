import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL environment variable is missing.");
}

if (!SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is missing.");
}

/**
 * Service Role client.
 *
 * Used only inside Edge Functions.
 *
 * This client bypasses Row Level Security so it can safely:
 *
 * • create WebAuthn challenges
 * • store credentials
 * • verify credentials
 * • revoke devices
 * • write audit logs
 */
export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
