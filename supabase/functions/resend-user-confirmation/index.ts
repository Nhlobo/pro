import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email.ts";

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

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(JSON.stringify({ error: "Unauthorized: No authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Authenticated client (from caller) to verify admin
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify caller is authenticated and an admin
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser();

    if (getUserError || !user) {
      console.error("Unauthorized access attempt:", getUserError?.message || "No user found");
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`User authenticated: ${user.email}, checking admin role...`);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      return new Response(JSON.stringify({ error: "Error verifying user role" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (profile?.role !== "admin") {
      console.error(`Forbidden: User ${user.email} with role ${profile?.role} tried to resend confirmation`);
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Admin verified: ${user.email}`);

    // Admin client for user management
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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
        // User exists but not confirmed, send confirmation email via Resend
        console.log('Attempting to resend invitation for unconfirmed user');
        
        try {
          // Generate a new confirmation token
          const { data: tokenData, error: tokenError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'signup',
            email: email,
            options: {
              redirectTo: `https://kamedico-legal.co.za/email-confirmation?email=${email}`
            }
          });

          if (tokenError) {
            console.error("Token generation error:", tokenError);
            return new Response(
              JSON.stringify({ error: "Failed to generate confirmation link" }),
              { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }

          console.log("Confirmation link generated, sending via SMTP");

          // Send email using SMTP
          const emailResult = await sendEmail({
            to: email,
            subject: "Confirm Your Email Address",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #333; margin-bottom: 20px;">Confirm Your Email</h1>
                <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                  Thank you for registering with KA Medico-Legal. Please confirm your email address by clicking the button below:
                </p>
                <a href="${tokenData.properties.action_link}" 
                   style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin-bottom: 20px;">
                  Confirm Email Address
                </a>
                <p style="color: #999; font-size: 14px; margin-top: 30px;">
                  If you didn't create an account, you can safely ignore this email.
                </p>
                <p style="color: #999; font-size: 12px; margin-top: 20px;">
                  If the button doesn't work, copy and paste this link into your browser:<br/>
                  <span style="color: #0066cc;">${tokenData.properties.action_link}</span>
                </p>
              </div>
            `,
          });

          if (!emailResult.success) {
            console.error("SMTP email error:", emailResult.error);
            return new Response(
              JSON.stringify({ error: "Failed to send confirmation email" }),
              { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }

          console.log("Confirmation email sent successfully via SMTP to:", email);
          
        } catch (emailError) {
          console.error("Email sending failed:", emailError);
          return new Response(JSON.stringify({ 
            error: "Email delivery failed",
            details: (emailError as Error).message
          }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
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