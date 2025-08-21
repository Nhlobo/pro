import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

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

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing Supabase env" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!SENDGRID_API_KEY) {
      console.error("Missing SENDGRID_API_KEY secret");
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

    // Send email via SendGrid
    console.log("Sending email using SendGrid...");
    
    const emailResponse = await sendEmailViaSendGrid({
      to: email,
      subject: linkType === "signup" ? "Confirm Your Account - Medical Assessment System" : "Access Your Account - Medical Assessment System",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: #2563eb; margin: 0 0 10px 0;">
              ${linkType === "signup" ? "Welcome to Medical Assessment System" : "Access Your Account"}
            </h1>
            <p style="color: #6b7280; margin: 0;">
              ${linkType === "signup" 
                ? "Click the link below to confirm your email and activate your account." 
                : "Click the link below to access your account."}
            </p>
          </div>
          
          <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <a href="${actionLink}" 
               style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; font-weight: bold; margin-bottom: 15px;">
              ${linkType === "signup" ? "Confirm Your Email" : "Access Your Account"}
            </a>
            <p style="color: #6b7280; margin: 0; font-size: 14px;">
              This link will expire in 24 hours for security purposes.
            </p>
          </div>

          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
            <p style="color: #4b5563; margin: 0; font-size: 14px;">
              If you didn't request this email, you can safely ignore it. 
              If you have questions, please contact our support team.
            </p>
          </div>
        </div>
      `,
    });

    console.log("SendGrid email response:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Confirmation email sent successfully",
      type: linkType,
      messageId: emailResponse.id
    }), {
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

async function sendEmailViaSendGrid(emailData: { to: string; subject: string; html: string }) {
  const response = await fetch(SENDGRID_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: emailData.to }],
        },
      ],
      from: {
        email: "onboarding@yourdomain.com",
        name: "Medical Assessment System",
      },
      subject: emailData.subject,
      content: [
        {
          type: "text/html",
          value: emailData.html,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SendGrid API error: ${response.status} ${error}`);
  }

  return { id: response.headers.get("x-message-id") };
}
