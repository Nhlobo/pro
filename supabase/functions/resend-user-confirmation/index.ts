import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResendRequestBody {
  email: string;
  action?: "signup" | "magiclink";
}

const APP_ORIGIN = "https://kamedico-legal.co.za";

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const confirmationEmailHtml = (actionLink: string) => `
  <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <div style="text-align:center; border-bottom: 1px solid #e5e7eb; padding-bottom: 18px; margin-bottom: 24px;">
      <h1 style="margin:0; color:#0f172a; font-size:24px;">Confirm Your Email</h1>
      <p style="margin:8px 0 0; color:#64748b;">Medico-Legal Pro</p>
    </div>
    <p>Please click the button below to confirm your email address and activate your account.</p>
    <div style="text-align:center; margin: 32px 0;">
      <a href="${actionLink}" style="background-color:#0ea5e9; color:#ffffff; padding: 13px 28px; text-decoration:none; border-radius:6px; display:inline-block; font-weight:bold;">Confirm Email</a>
    </div>
    <p style="font-size:13px; color:#64748b;">If the button does not work, copy and paste this link into your browser:</p>
    <p style="font-size:12px; word-break:break-all; color:#0284c7;">${actionLink}</p>
    <p style="font-size:12px; color:#94a3b8; margin-top:28px;">If you did not request this email, you can safely ignore it.</p>
  </div>
`;

const magicLinkEmailHtml = (actionLink: string) => `
  <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <div style="text-align:center; border-bottom: 1px solid #e5e7eb; padding-bottom: 18px; margin-bottom: 24px;">
      <h1 style="margin:0; color:#0f172a; font-size:24px;">Your Login Link</h1>
      <p style="margin:8px 0 0; color:#64748b;">Medico-Legal Pro</p>
    </div>
    <p>Please click the button below to securely sign in to your account.</p>
    <div style="text-align:center; margin: 32px 0;">
      <a href="${actionLink}" style="background-color:#14b8a6; color:#ffffff; padding: 13px 28px; text-decoration:none; border-radius:6px; display:inline-block; font-weight:bold;">Sign In</a>
    </div>
    <p style="font-size:13px; color:#64748b;">If the button does not work, copy and paste this link into your browser:</p>
    <p style="font-size:12px; word-break:break-all; color:#0d9488;">${actionLink}</p>
    <p style="font-size:12px; color:#94a3b8; margin-top:28px;">If you did not request this email, you can safely ignore it.</p>
  </div>
`;

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, action = "signup" } = (await req.json()) as ResendRequestBody;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return new Response(JSON.stringify({ error: "A valid email address is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!["signup", "magiclink"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid email action" }), {
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

    // Admin client for user management
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    console.log(`Attempting to send ${action} email for: ${normalizedEmail}`);

    // First, check if user exists and their confirmation status
    const { data: existingUser, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error("Error fetching users:", listError);
      return new Response(JSON.stringify({ error: "Failed to check user status" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userRecord = existingUser?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
    
    if (userRecord) {
      console.log(`User found. Email confirmed: ${userRecord.email_confirmed_at ? 'yes' : 'no'}`);
      
      if (userRecord.email_confirmed_at && action === "signup") {
        // User is already confirmed, notify admin that user is already confirmed
        console.log('User is already confirmed - no action needed');
        return new Response(JSON.stringify({ 
          success: true, 
          message: "User is already confirmed and can log in directly. No email needed.",
          userStatus: "confirmed"
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });

      } else {
        // User exists, generate a Supabase action link and send it through the project email service.
        console.log(`Generating ${action} link and sending email`);
        
        // Generate OTP for email confirmation
        const { data: otpData, error: otpError } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: normalizedEmail,
          options: {
            redirectTo: `${APP_ORIGIN}/`
          }
        });

        if (otpError || !otpData) {
          console.error('Error generating confirmation link:', otpError);
          return new Response(
            JSON.stringify({ 
              error: 'Failed to generate confirmation link',
              details: otpError?.message
            }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const actionLink = otpData.properties?.action_link;
        if (!actionLink) {
          return new Response(JSON.stringify({ error: "Failed to generate email link" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        const emailHtml = action === "magiclink" ? magicLinkEmailHtml(actionLink) : confirmationEmailHtml(actionLink);

        const emailResult = await sendEmail({
          to: normalizedEmail,
          subject: action === "magiclink" ? 'Your login link - Medico-Legal Pro' : 'Confirm your email - Medico-Legal Pro',
          html: emailHtml
        });

        if (!emailResult.success) {
          console.error('Failed to send email via SendGrid:', emailResult.error);
          return new Response(
            JSON.stringify({ 
              error: 'Failed to send confirmation email',
              details: emailResult.error
            }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        console.log(`${action} email sent successfully to:`, normalizedEmail);
      }
    } else {
      // User doesn't exist
      console.log('User not found - cannot send auth link for non-existent user');
      return new Response(JSON.stringify({ error: "No account was found for this email address." }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Email sent successfully"
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