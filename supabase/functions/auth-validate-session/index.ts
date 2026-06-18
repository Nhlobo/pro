// Session validation: called on protected route loads and periodically.
// Verifies that the user's session_token is still the active one (single-session)
// and hasn't been revoked or expired (8h absolute lifetime).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { adminClient, corsHeaders, json, userClient, extractEventContext, recordAuthEvent } from "../_shared/auth-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ctx = extractEventContext(req);
  const admin = adminClient();
  try {
    const { sessionToken } = await req.json();
    const u = userClient(req);
    const { data: userData, error: userErr } = await u.auth.getUser();
    if (userErr || !userData.user) return json({ valid: false, reason: "no_user" }, 200);
    const userId = userData.user.id;

    if (!sessionToken) return json({ valid: false, reason: "no_token" }, 200);

    const { data: row } = await admin.from("auth_active_sessions")
      .select("id, expires_at, revoked_at").eq("session_token", sessionToken).eq("user_id", userId).maybeSingle();

    if (!row) return json({ valid: false, reason: "unknown_session" }, 200);
    if (row.revoked_at) return json({ valid: false, reason: "revoked" }, 200);
    if (new Date(row.expires_at) < new Date()) {
      await admin.from("auth_active_sessions").update({ revoked_at: new Date().toISOString(), revoked_reason: "expired" }).eq("id", row.id);
      await recordAuthEvent(admin, { user_id: userId, email: userData.user.email ?? null, event_type: "session_expired", ctx });
      return json({ valid: false, reason: "expired" }, 200);
    }

    await admin.from("auth_active_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", row.id);
    return json({ valid: true });
  } catch (e) {
    console.error(e);
    return json({ valid: false }, 200);
  }
});
