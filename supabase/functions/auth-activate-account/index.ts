// Validates an activation token (token only — password is set in setup wizard).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { adminClient, corsHeaders, json, sha256Hex, extractEventContext, recordAuthEvent } from "../_shared/auth-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ctx = extractEventContext(req);
  const admin = adminClient();

  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") return json({ valid: false }, 400);
    const tokenHash = await sha256Hex(token);

    const { data: row } = await admin
      .from("auth_activation_tokens")
      .select("id, user_id, expires_at, consumed_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!row || row.consumed_at || new Date(row.expires_at) < new Date()) {
      return json({ valid: false, reason: "expired_or_invalid" }, 200);
    }

    const { data: profile } = await admin
      .from("profiles").select("email, first_name").eq("id", row.user_id).maybeSingle();

    await recordAuthEvent(admin, {
      user_id: row.user_id, email: profile?.email ?? null,
      event_type: "activation_token_validated", ctx,
    });

    return json({ valid: true, user_id: row.user_id, email: profile?.email, first_name: profile?.first_name });
  } catch {
    return json({ valid: false }, 400);
  }
});
