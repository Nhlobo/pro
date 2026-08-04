// External Portal Module — admin-side link management.
//
// Staff-authenticated only (verify_jwt = true, see supabase/config.toml).
// Handles the "Admin creates portal access -> system generates a
// one-time secure link" step. This function never runs on behalf of
// an external end user — that's external-portal-auth, a separate
// function with a separate trust boundary.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withErrorHandler } from "../_shared/errors.ts";
import { sendEmail } from "../_shared/email.ts";
import {
  corsHeaders,
  jsonResponse,
  errorResponse,
  sha256Hex,
  randomToken,
  getPortalSettings,
  registrationLinkEmailHtml,
  PORTAL_LABEL,
} from "../_external-portal-shared/helpers.ts";

const APP_ORIGIN = "https://kamedico-legal.co.za";

type Action = "generate_link" | "revoke_link";

interface RequestBody {
  action: Action;
  account_id?: string;
  link_id?: string;
  reason?: string;
  send_email?: boolean;
}

serve(withErrorHandler(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return errorResponse("Missing authorization header", 401);

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) return errorResponse("Invalid authentication", 401);

  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return errorResponse("Admin privileges required", 403);

  const body: RequestBody = await req.json();

  if (body.action === "generate_link") {
    if (!body.account_id) return errorResponse("account_id is required");

    const { data: account, error: acctError } = await supabaseAdmin
      .from("external_portal_accounts")
      .select("id, full_name, email, portal_type, status, deleted_at")
      .eq("id", body.account_id)
      .single();

    if (acctError || !account) return errorResponse("Account not found", 404);
    if (account.deleted_at) return errorResponse("Account is in the Recycle Bin — restore it first", 409);
    if (account.status !== "active") return errorResponse(`Account is ${account.status} — set it to Active first`, 409);

    // Revoke any still-pending links for this account first — only one
    // live registration link per account at a time.
    await supabaseAdmin
      .from("external_portal_access_links")
      .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_reason: "Superseded by new link" })
      .eq("account_id", account.id)
      .eq("status", "pending");

    const settings = await getPortalSettings(supabaseAdmin);
    const rawToken = randomToken(32);
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + settings.access_link_expiry_hours * 60 * 60 * 1000).toISOString();

    const { data: link, error: linkError } = await supabaseAdmin
      .from("external_portal_access_links")
      .insert({
        account_id: account.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_by: user.id,
      })
      .select("id, expires_at, created_at")
      .single();

    if (linkError) return errorResponse(linkError.message, 500);

    const portalLabel = PORTAL_LABEL[account.portal_type] ?? "External";
    const linkUrl = `${APP_ORIGIN}/external-portal/sign-in?token=${rawToken}`;

    let emailSent = false;
    if (body.send_email !== false) {
      const result = await sendEmail({
        to: account.email,
        subject: `Your ${portalLabel} Portal access link`,
        html: registrationLinkEmailHtml({
          fullName: account.full_name,
          link: linkUrl,
          expiryHours: settings.access_link_expiry_hours,
          portalLabel,
        }),
      });
      emailSent = !!result.success;
    }

    await supabaseAdmin.rpc("external_portal_log_audit", {
      _actor_type: "admin",
      _actor_id: user.id,
      _account_id: account.id,
      _action: "access_link_generated",
      _details: { link_id: link.id, email_sent: emailSent },
    });

    return jsonResponse({
      success: true,
      data: {
        link_id: link.id,
        link_url: linkUrl,
        expires_at: link.expires_at,
        email_sent: emailSent,
      },
    });
  }

  if (body.action === "revoke_link") {
    if (!body.link_id) return errorResponse("link_id is required");

    const { data: link, error } = await supabaseAdmin
      .from("external_portal_access_links")
      .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_reason: body.reason || "Revoked by admin" })
      .eq("id", body.link_id)
      .eq("status", "pending")
      .select("id, account_id")
      .single();

    if (error || !link) return errorResponse("Link not found or already used/revoked", 404);

    await supabaseAdmin.rpc("external_portal_log_audit", {
      _actor_type: "admin",
      _actor_id: user.id,
      _account_id: link.account_id,
      _action: "access_link_revoked",
      _details: { link_id: link.id, reason: body.reason || null },
    });

    return jsonResponse({ success: true, data: { link_id: link.id } });
  }

  return errorResponse("Unknown action", 400);
}));
