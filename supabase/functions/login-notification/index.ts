import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LoginNotificationRequest {
  userId: string;
  email: string;
  loginTime: string;
  ipAddress?: string;
  userAgent?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email, loginTime, ipAddress, userAgent }: LoginNotificationRequest = await req.json();

    if (!userId || !email) {
      return new Response(JSON.stringify({ error: "User ID and email are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Admin client for sending emails
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Get user profile information
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
    }

    const fullName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : email;
    const formattedTime = new Date(loginTime).toLocaleString();

    // Send login notification email using SendGrid
    try {
      const emailResponse = await sendEmail({
        from: "noreply@kutlwanoassociate.com",
        to: [email],
        subject: "New Login Detected - KA Medico-Legal",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; margin-bottom: 20px;">New Login Detected</h1>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              Hello ${fullName},
            </p>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              We detected a new login to your KA Medico-Legal account:
            </p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
              <p style="margin: 5px 0;"><strong>Time:</strong> ${formattedTime}</p>
              <p style="margin: 5px 0;"><strong>IP Address:</strong> ${ipAddress || 'Unknown'}</p>
              <p style="margin: 5px 0;"><strong>Device:</strong> ${userAgent || 'Unknown'}</p>
            </div>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              If this was you, you can safely ignore this email. If you did not log in, please contact support immediately.
            </p>
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
              This is an automated security notification from KA Medico-Legal.
            </p>
          </div>
        `,
      });

      if (!emailResponse.success) {
        console.error("Failed to send login notification:", emailResponse.error);
        return new Response(JSON.stringify({ error: emailResponse.error }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      console.log("Login notification sent successfully to:", email, emailResponse.messageId);

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Login notification sent successfully"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });

    } catch (error) {
      console.error("Error sending login notification:", error);
      return new Response(JSON.stringify({ error: "Failed to send notification" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

  } catch (error) {
    console.error("Error in login-notification function:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Unexpected error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});