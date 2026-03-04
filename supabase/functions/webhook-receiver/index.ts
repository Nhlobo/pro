import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-type",
};

const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB

const WebhookTypeSchema = z.enum(['sendgrid', 'payment', 'zapier', 'generic']).default('generic');

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check content length
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
      return new Response(
        JSON.stringify({ error: "Payload too large" }),
        { status: 413, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const bodyText = await req.text();
    if (bodyText.length > MAX_PAYLOAD_SIZE) {
      return new Response(
        JSON.stringify({ error: "Payload too large" }),
        { status: 413, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const webhookTypeRaw = req.headers.get("x-webhook-type") || "generic";
    const webhookTypeResult = WebhookTypeSchema.safeParse(webhookTypeRaw);
    if (!webhookTypeResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid webhook type" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const webhookType = webhookTypeResult.data;

    console.log(`Webhook received - Type: ${webhookType}`);

    // Log the webhook event
    const { error: logError } = await supabase
      .from("webhook_logs")
      .insert({
        webhook_config_id: null,
        event_type: webhookType,
        payload: body as Record<string, unknown>,
        response_status: 200,
        response_body: "Webhook received successfully",
      });

    if (logError) {
      console.error("Error logging webhook:", logError);
    }

    let processedData = null;

    switch (webhookType) {
      case "sendgrid":
        processedData = await handleSendGridWebhook(body, supabase);
        break;
      case "payment":
        processedData = { type: "payment", processed: true };
        break;
      case "zapier":
        processedData = { type: "zapier", processed: true };
        break;
      default:
        processedData = { received: true, type: "generic" };
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook processed successfully",
        data: processedData,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

const SendGridEventSchema = z.object({
  event: z.string().max(50).optional(),
}).passthrough();

async function handleSendGridWebhook(body: unknown, supabase: any) {
  const events = Array.isArray(body) ? body : [body];
  
  // Limit number of events processed
  const limitedEvents = events.slice(0, 100);
  
  for (const rawEvent of limitedEvents) {
    const eventResult = SendGridEventSchema.safeParse(rawEvent);
    if (!eventResult.success) continue;
    
    const event = eventResult.data;
    const eventType = event.event || 'unknown';
    
    await supabase
      .from("webhook_logs")
      .insert({
        event_type: eventType,
        payload: event
      });

    switch (eventType) {
      case "bounce":
      case "dropped":
        console.log("Email delivery failed");
        break;
      case "delivered":
        console.log("Email delivered");
        break;
      case "open":
        console.log("Email opened");
        break;
      case "click":
        console.log("Email link clicked");
        break;
      case "spam":
        console.log("Email marked as spam");
        break;
    }
  }
  
  return { type: "sendgrid", eventsProcessed: limitedEvents.length, processed: true };
}
