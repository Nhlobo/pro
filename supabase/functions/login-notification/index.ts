import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email.ts";
import { z } from "npm:zod@3.22.4";
import { withErrorHandler } from "../_shared/errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LoginNotificationSchema = z.object({
  userId: z.string().uuid({ message: "Invalid user ID format" }),
  email: z.string().email({ message: "Invalid email format" }).max(255),
  loginTime: z.string().max(100),
  ipAddress: z.string().max(45).optional(),
  userAgent: z.string().max(500).optional(),
}).strict();

serve(withErrorHandler(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    const validationResult = LoginNotificationSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: validationResult.error.flatten() }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { userId, email, loginTime, ipAddress, userAgent } = validationResult.data;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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

    // Sanitize for HTML output
    const sanitize = (str: string) => str.replace(/[<>&"']/g, (c) => {
      const entities: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
      return entities[c] || c;
    });

    try {
      const emailResponse = await sendEmail({
        from: "noreply@kutlwanoassociate.com",
        to: [email],
        subject: "New Login Detected - Kutlwano & Associate",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; margin-bottom: 20px;">New Login Detected</h1>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              Hello ${sanitize(fullName)},
            </p>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              We detected a new login to your Kutlwano & Associate account:
            </p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
              <p style="margin: 5px 0;"><strong>Time:</strong> ${sanitize(formattedTime)}</p>
              <p style="margin: 5px 0;"><strong>IP Address:</strong> ${sanitize(ipAddress || 'Unknown')}</p>
              <p style="margin: 5px 0;"><strong>Device:</strong> ${sanitize(userAgent || 'Unknown')}</p>
            </div>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              If this was you, you can safely ignore this email. If you did not log in, please contact support immediately.
            </p>
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
              This is an automated security notification from Kutlwano & Associate.
            </p>
          </div>
        `,
      });

      if (!emailResponse.success) {
        console.error("Failed to send login notification:", emailResponse.error);
        return new Response(JSON.stringify({ error: "Failed to send notification" }), {
          status: 500,
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
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
))