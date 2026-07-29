import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  withErrorHandler,
  corsHeaders,
  BadRequest,
  Unauthorized,
  Forbidden,
  NotFound,
  ValidationError,
  UpstreamError,
} from "../_shared/errors.ts";

// Success responses stay flat ({ success, message, user }), matching
// delete-user/create-user, rather than jsonResponse's {success,data,requestId}
// envelope — the frontend handles both edge functions the same way.
const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify({ success: true, ...body }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Deactivate (or reactivate) an internal staff account without deleting it.
//
// Mirrors delete-user's security model exactly (admin-only via the
// user_roles-backed has_role RPC, caller can't act on their own account),
// since this is an equally sensitive account-management action.
//
// Two things happen on deactivation, deliberately kept separate:
//  1. profiles.is_active / deactivated_at / deactivated_by /
//     deactivation_reason are updated through the CALLER's own
//     authenticated client (not the service-role client) so RLS and the
//     existing privilege-escalation trigger see a real admin auth.uid() —
//     the same way updateUserRole() already changes another user's role
//     elsewhere in this app. This is the record admins see in the UI.
//  2. The account is banned via Supabase Auth's native ban_duration (which
//     does need the service-role client). This is the actual enforcement:
//     it blocks every sign-in path (password, OTP, magic link, OAuth,
//     passkey) at the source, and invalidates the session on its next
//     token refresh — not just whatever one login code path this app
//     happens to check.
// If step 2 fails, step 1 is rolled back so the UI never shows "deactivated"
// for an account that can actually still log in.

interface DeactivateUserRequest {
  userId: string;
  active: boolean; // false = deactivate, true = reactivate
  reason?: string; // required when active === false
}

const INDEFINITE_BAN = "876000h"; // 100 years — Supabase's own documented example for an effectively-permanent ban
const LIFT_BAN = "none";

serve(withErrorHandler(async (req) => {
  const body: DeactivateUserRequest = await req.json();
  const { userId, active, reason } = body;

  if (!userId || typeof userId !== "string" || userId.length !== 36) {
    throw ValidationError("Invalid user ID format");
  }
  if (typeof active !== "boolean") {
    throw ValidationError("`active` must be a boolean");
  }
  if (!active && (!reason || !reason.trim())) {
    throw ValidationError("A reason is required when deactivating a user");
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    console.error("Missing Supabase environment variables");
    throw new Error("Server misconfiguration: missing Supabase env");
  }

  const supabaseClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  // Verify caller is authenticated
  const { data: { user }, error: getUserError } = await supabaseClient.auth.getUser();
  if (getUserError || !user) {
    console.error("Unauthorized access attempt", getUserError);
    throw Unauthorized();
  }

  // Verify admin using the secure user_roles table — same check delete-user uses.
  const { data: isAdmin } = await supabaseClient
    .rpc("has_role", { _user_id: user.id, _role: "admin" });

  if (!isAdmin) {
    console.log("Access denied - Caller is not an admin");
    throw Forbidden("Access denied. Admin privileges required.");
  }

  // Prevent admins from locking themselves out
  if (userId === user.id) {
    throw BadRequest(active ? "Use your own profile settings to manage your account" : "Cannot deactivate your own account");
  }

  const { data: targetProfile, error: targetProfileError } = await supabaseClient
    .from("profiles")
    .select("email, role, is_active")
    .eq("id", userId)
    .single();

  if (targetProfileError || !targetProfile) {
    console.error("User not found:", targetProfileError);
    throw NotFound("User not found");
  }

  // Idempotency guard — avoid pointless writes / duplicate audit rows if the
  // account is already in the requested state (e.g. a double click).
  if (targetProfile.is_active === active) {
    return ok({
      message: active ? "User is already active" : "User is already deactivated",
      user: { email: targetProfile.email, role: targetProfile.role, is_active: targetProfile.is_active },
    });
  }

  const previousState = { is_active: targetProfile.is_active };

  const { error: updateError } = await supabaseClient
    .from("profiles")
    .update({
      is_active: active,
      deactivated_at: active ? null : new Date().toISOString(),
      deactivated_by: active ? null : user.id,
      deactivation_reason: active ? null : (reason as string).trim(),
    })
    .eq("id", userId);

  if (updateError) {
    console.error("Failed to update profile status:", updateError);
    throw new Error(updateError.message);
  }

  // Enforce it at the auth layer. Needs the service-role client — auth.admin.*
  // isn't reachable any other way.
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: active ? LIFT_BAN : INDEFINITE_BAN,
  });

  if (banError) {
    console.error("Failed to update auth ban state:", banError);
    // Roll back the profile flag so the UI never shows "deactivated" for an
    // account that can still actually log in.
    await supabaseClient
      .from("profiles")
      .update({
        is_active: previousState.is_active,
        deactivated_at: null,
        deactivated_by: null,
        deactivation_reason: null,
      })
      .eq("id", userId);
    throw UpstreamError(`Failed to ${active ? "re" : "de"}activate account: ${banError.message}`);
  }

  console.log(`User ${targetProfile.email} ${active ? "reactivated" : "deactivated"} by admin ${user.email}`);

  // Audit trail, same shape audit_logs already uses elsewhere in this app.
  const { error: auditError } = await supabaseAdmin.from("audit_logs").insert({
    table_name: "profiles",
    record_id: userId,
    action_type: active ? "REACTIVATE_USER" : "DEACTIVATE_USER",
    function_area: "User Management",
    user_id: user.id,
    user_email: user.email,
    old_values: previousState,
    new_values: { is_active: active, reason: active ? null : (reason as string).trim() },
    description: active
      ? `Reactivated ${targetProfile.email}`
      : `Deactivated ${targetProfile.email}: ${(reason as string).trim()}`,
  });

  if (auditError) {
    // Don't fail the request over a logging problem — the action itself
    // already succeeded and is enforced. Just surface it server-side.
    console.error("Failed to write audit log entry:", auditError);
  }

  return ok({
    message: active ? "User reactivated successfully" : "User deactivated successfully",
    user: { email: targetProfile.email, role: targetProfile.role, is_active: active },
  });
}));
