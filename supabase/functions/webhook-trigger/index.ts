import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Verify the user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { event_type, payload } = await req.json();

    if (!event_type) {
      return new Response(
        JSON.stringify({ error: "event_type is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Triggering webhooks for event: ${event_type}`);

    // Get all active webhook configurations for this event type and user
    const { data: webhookConfigs, error: configError } = await supabase
      .from("webhook_configs")
      .select("*")
      .eq("user_id", user.id)
      .eq("event_type", event_type)
      .eq("is_active", true);

    if (configError) {
      console.error("Error fetching webhook configs:", configError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch webhook configurations" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!webhookConfigs || webhookConfigs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No active webhooks configured for this event",
          triggered: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Trigger all configured webhooks
    const results = await Promise.allSettled(
      webhookConfigs.map(async (config) => {
        try {
          console.log(`Sending webhook to: ${config.url}`);

          const webhookPayload = {
            event_type,
            timestamp: new Date().toISOString(),
            user_id: user.id,
            data: payload,
          };

          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };

          // Add secret as a header if configured
          if (config.secret) {
            headers["X-Webhook-Secret"] = config.secret;
          }

          const response = await fetch(config.url, {
            method: "POST",
            headers,
            body: JSON.stringify(webhookPayload),
          });

          const responseText = await response.text();

          // Log the webhook attempt
          await supabase.from("webhook_logs").insert({
            webhook_config_id: config.id,
            event_type,
            payload: webhookPayload,
            response_status: response.status,
            response_body: responseText.substring(0, 500), // Limit response body size
            error: response.ok ? null : `HTTP ${response.status}: ${responseText}`,
          });

          return {
            config_id: config.id,
            name: config.name,
            success: response.ok,
            status: response.status,
          };
        } catch (error) {
          console.error(`Error triggering webhook ${config.name}:`, error);

          // Log the error
          await supabase.from("webhook_logs").insert({
            webhook_config_id: config.id,
            event_type,
            payload: { event_type, data: payload },
            response_status: null,
            error: error.message,
          });

          return {
            config_id: config.id,
            name: config.name,
            success: false,
            error: error.message,
          };
        }
      })
    );

    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Triggered ${successCount} of ${webhookConfigs.length} webhooks`,
        triggered: successCount,
        total: webhookConfigs.length,
        results: results.map((r) =>
          r.status === "fulfilled" ? r.value : { success: false, error: r.reason }
        ),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Webhook trigger error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});