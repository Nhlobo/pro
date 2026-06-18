// Admin-only: create a new user with no password. Sends activation email.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  adminClient, corsHeaders, json, requireAdmin, generateRandomToken, sha256Hex,
  extractEventContext, recordAuthEvent, appBaseUrl, brandedEmail,
} from "../_shared/auth-helpers.ts";
import { sendEmail } from "../_shared/email.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const ctx = extractEventContext(req);
  const admin = adminClient();

  try {
    const body = await req.json();
    const { email, firstName, lastName, role, position, lawFirmId, userType, permissions } = body || {};
    if (!email || !firstName || !lastName) {
      return json({ error: "Missing required fields: email, firstName, lastName" }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Invalid email format" }, 400);

    const validRoles = ["admin", "employee", "referring_attorney", "user", "sales_consultant", "medical_expert", "finance", "director"];
    const roleVal = role || "user";
    if (!validRoles.includes(roleVal)) return json({ error: "Invalid role" }, 400);

    // Create user without password.
    const tempPassword = generateRandomToken(24); // random, never shared, replaced on activation
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: false,
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    if (createErr || !newUser.user) {
      return json({ error: createErr?.message || "Failed to create user" }, 400);
    }
    const uid = newUser.user.id;

    // Profile (pending activation, must_reset_password true, security_setup_completed false)
    await admin.from("profiles").upsert({
      id: uid,
      email,
      first_name: firstName,
      last_name: lastName,
      role: roleVal,
      user_type: userType || "user",
      position: position || null,
      law_firm_id: lawFirmId || null,
      account_status: "pending_activation",
      must_reset_password: true,
      security_setup_completed: false,
    });

    await admin.from("user_roles").insert({ user_id: uid, role: roleVal, granted_by: guard.userId });

    if (roleVal !== "admin" && Array.isArray(permissions)) {
      for (const p of permissions) {
        await admin.from("user_permissions").upsert({
          user_id: uid, permission_name: p, granted: true, granted_by: guard.userId,
        });
      }
    }

    // Activation token: store hash only.
    const rawToken = generateRandomToken(32);
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await admin.from("auth_activation_tokens").insert({
      user_id: uid, token_hash: tokenHash, expires_at: expiresAt, created_by: guard.userId,
    });

    const activationUrl = `${appBaseUrl()}/activate?token=${rawToken}`;
    await sendEmail({
      to: email,
      subject: "Activate your Medico-Legal Pro account",
      html: brandedEmail("Activate Your Account", `
        <p>Hello ${firstName},</p>
        <p>An account has been created for you. Click below to set your password and complete the security setup. This link expires in 24 hours and can be used once.</p>
        <div style="text-align:center; margin: 28px 0;">
          <a href="${activationUrl}" style="background-color:#0ea5e9; color:#ffffff; padding: 12px 26px; text-decoration:none; border-radius:6px; font-weight:bold;">Activate Account</a>
        </div>
        <p style="font-size:12px; color:#64748b;">If the button doesn't work, paste this link:</p>
        <p style="font-size:11px; word-break:break-all; color:#0284c7;">${activationUrl}</p>
      `),
    });

    await recordAuthEvent(admin, {
      user_id: uid, email, event_type: "account_created", ctx,
      metadata: { by_admin: guard.userId, role: roleVal },
    });

    return json({ success: true, user: { id: uid, email } });
  } catch (e: any) {
    console.error(e);
    return json({ error: "Internal server error" }, 500);
  }
});
