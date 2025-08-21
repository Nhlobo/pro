import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResendRequestBody {
  email: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = (await req.json()) as ResendRequestBody;

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing Supabase env" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY secret");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Authenticated client (from caller) to verify admin
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    // Verify caller is authenticated and an admin
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser();

    if (getUserError || !user) {
      console.error("Unauthorized access attempt", getUserError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      console.error("Forbidden: non-admin tried to resend confirmation", profileError);
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Admin client for generating a confirmation link
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Use the origin of the caller if available, otherwise default
    const origin = req.headers.get("origin") || "http://localhost:3000";

    // Try to generate a signup confirmation link first; if the user already exists, fall back to a magic link
    let linkType: "signup" | "magiclink" = "signup";
    let linkData: any = null;
    let linkError: any = null;

    const attempt = await supabaseAdmin.auth.admin.generateLink({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${origin}/`,
      },
    });
    linkData = attempt.data;
    linkError = attempt.error;

    if (linkError && ((linkError as any).status === 422 || (linkError as any).code === "email_exists")) {
      // Email already registered – send a magic link instead which will also activate access on click
      const fallback = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          emailRedirectTo: `${origin}/`,
        },
      });
      linkData = fallback.data;
      linkError = fallback.error;
      linkType = "magiclink";
    }

    if (linkError) {
      console.error("Failed to generate confirmation/magic link:", linkError);
      return new Response(JSON.stringify({ error: linkError.message }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const actionLink = (linkData as any)?.properties?.action_link || (linkData as any)?.action_link;

    if (!actionLink) {
      console.error("No action link returned from generateLink", linkData);
      return new Response(JSON.stringify({ error: "Could not generate confirmation link" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Send email via Resend
    const resend = new Resend(RESEND_API_KEY);
    const emailResponse = await resend.emails.send({
      from: "Kutlwano & Associate <onboarding@resend.dev>",
      to: [email],
      subject: "Confirm your account",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Welcome to Kutlwano & Associate</h2>
          <p>Please confirm and activate your account by clicking the button below:</p>
          <p>
            <a href="${actionLink}"
               style="display:inline-block;padding:12px 18px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px">
               Confirm your account
            </a>
          </p>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${actionLink}</p>
          <hr />
          <p>This link will redirect you back to ${origin} once confirmed.</p>
        </div>
      `,
    });

    console.log("Resend email response:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Error in resend-user-confirmation function:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Unexpected error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
