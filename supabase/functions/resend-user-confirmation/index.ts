import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Admin client for generating and sending confirmation email
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Use the production domain for email redirects
    const origin = 'https://kamedico-legal.co.za';

    // Try to resend confirmation email directly using Supabase
    let emailResponse: any = null;
    let emailError: any = null;

    console.log(`Attempting to resend confirmation email for: ${email}`);

    // First, check if user exists and their confirmation status
    const { data: existingUser, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    const userRecord = existingUser?.users?.find(u => u.email === email);
    
    if (userRecord) {
      console.log(`User found. Email confirmed: ${userRecord.email_confirmed_at ? 'yes' : 'no'}`);
      
      if (userRecord.email_confirmed_at) {
        // User is already confirmed, send a magic link for login
        console.log('Sending magic link for confirmed user');
        const magicLinkResult = await supabaseAdmin.auth.signInWithOtp({
          email: email,
          options: {
            emailRedirectTo: `${origin}/`
          }
        });
        emailResponse = magicLinkResult.data;
        emailError = magicLinkResult.error;
      } else {
        // User exists but not confirmed, resend confirmation
        console.log('Resending confirmation email for unconfirmed user');
        const resendResult = await supabaseAdmin.auth.resend({
          type: "signup",
          email: email,
          options: {
            emailRedirectTo: `${origin}/`
          }
        });
        emailResponse = resendResult.data;
        emailError = resendResult.error;
      }
    } else {
      // User doesn't exist, send invitation
      console.log('User not found, this might be an invitation scenario');
      const magicLinkResult = await supabaseAdmin.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: `${origin}/`
        }
      });
      emailResponse = magicLinkResult.data;
      emailError = magicLinkResult.error;
    }

    if (emailError) {
      console.error("Failed to send confirmation email:", emailError);
      return new Response(JSON.stringify({ error: emailError.message }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("Supabase email sent successfully");

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Confirmation email sent successfully using Supabase"
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