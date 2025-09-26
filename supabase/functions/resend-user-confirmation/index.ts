import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

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

    // Admin client for user management
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Initialize Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing Resend API key" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resend = new Resend(RESEND_API_KEY);

    // Use the production domain for email redirects
    const origin = 'https://kamedico-legal.co.za';

    console.log(`Attempting to resend confirmation email for: ${email}`);

    // First, check if user exists and their confirmation status
    const { data: existingUser, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    if (userError) {
      console.error("Error fetching users:", userError);
      return new Response(JSON.stringify({ error: "Failed to check user status" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userRecord = existingUser?.users?.find(u => u.email === email);
    
    if (userRecord) {
      console.log(`User found. Email confirmed: ${userRecord.email_confirmed_at ? 'yes' : 'no'}`);
      
      if (userRecord.email_confirmed_at) {
        // User is already confirmed, send a magic link for login
        console.log('Generating magic link for confirmed user');
        
        const { data: magicLinkData, error: magicLinkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: email,
          options: {
            redirectTo: `${origin}/dashboard`
          }
        });

        if (magicLinkError) {
          console.error("Failed to generate magic link:", magicLinkError);
          return new Response(JSON.stringify({ error: "Failed to generate login link" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        // Send magic link email using Resend
        const emailResponse = await resend.emails.send({
          from: "KA Medico-Legal <noreply@kamedico-legal.co.za>",
          to: [email],
          subject: "Your Login Link - KA Medico-Legal",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Login to KA Medico-Legal</h2>
              <p>Hello,</p>
              <p>Click the button below to login to your account:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${magicLinkData.properties?.action_link}" 
                   style="background-color: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Login to Your Account
                </a>
              </div>
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; color: #666;">${magicLinkData.properties?.action_link}</p>
              <p style="color: #666; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>
              <p>If you didn't request this login link, you can safely ignore this email.</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px;">KA Medico-Legal Assessment Services</p>
            </div>
          `,
        });

        if (emailResponse.error) {
          console.error("Failed to send magic link email:", emailResponse.error);
          return new Response(JSON.stringify({ error: "Failed to send login email" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        console.log("Magic link email sent successfully");

      } else {
        // User exists but not confirmed, generate invitation link instead
        console.log('Generating invitation link for unconfirmed user');
        
        const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'invite',
          email: email,
          options: {
            redirectTo: `${origin}/dashboard`
          }
        });

        if (inviteError) {
          console.error("Failed to generate invitation link:", inviteError);
          return new Response(JSON.stringify({ error: "Failed to generate confirmation link" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        // Send confirmation email using Resend
        const emailResponse = await resend.emails.send({
          from: "KA Medico-Legal <noreply@kamedico-legal.co.za>",
          to: [email],
          subject: "Confirm Your Email - KA Medico-Legal",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Welcome to KA Medico-Legal</h2>
              <p>Hello,</p>
              <p>Please confirm your email address to complete your account setup:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${inviteData.properties?.action_link}" 
                   style="background-color: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Confirm Your Email
                </a>
              </div>
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; color: #666;">${inviteData.properties?.action_link}</p>
              <p style="color: #666; font-size: 14px;">This link will expire in 24 hours for security reasons.</p>
              <p>If you didn't create an account, you can safely ignore this email.</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px;">KA Medico-Legal Assessment Services</p>
            </div>
          `,
        });

        if (emailResponse.error) {
          console.error("Failed to send confirmation email:", emailResponse.error);
          return new Response(JSON.stringify({ error: "Failed to send confirmation email" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        console.log("Confirmation email sent successfully");
      }
    } else {
      // User doesn't exist
      console.log('User not found - cannot resend confirmation for non-existent user');
      return new Response(JSON.stringify({ error: "User not found. Please check the email address." }), {
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