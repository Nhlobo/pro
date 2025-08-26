import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Use the production domain for email redirects
    const origin = 'https://kamedico-legal.co.za';

    // Send login notification email using magic link (since Supabase doesn't have a direct notification email type)
    try {
      const { error: emailError } = await supabaseAdmin.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: `${origin}/dashboard`,
          data: {
            notification_type: 'login_alert',
            login_time: formattedTime,
            ip_address: ipAddress || 'Unknown',
            user_agent: userAgent || 'Unknown'
          }
        }
      });

      if (emailError) {
        console.error("Failed to send login notification:", emailError);
        return new Response(JSON.stringify({ error: emailError.message }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      console.log("Login notification sent successfully to:", email);

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