import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const signature = req.headers.get("x-webhook-signature");
    const webhookType = req.headers.get("x-webhook-type") || "generic";

    console.log(`Webhook received - Type: ${webhookType}`);

    // Log the webhook event
    const { data: logData, error: logError } = await supabase
      .from("webhook_logs")
      .insert({
        webhook_config_id: null, // For incoming webhooks, no config ID
        event_type: webhookType,
        payload: body,
        response_status: 200,
        response_body: "Webhook received successfully",
      })
      .select()
      .single();

    if (logError) {
      console.error("Error logging webhook:", logError);
    }

    // Process webhook based on type
    let processedData = null;

    switch (webhookType) {
      case "resend":
        // Handle Resend webhook events (bounces, deliveries, opens, clicks)
        processedData = await handleResendWebhook(body, supabase);
        break;
      
      case "payment":
        // Handle payment webhooks
        processedData = await handlePaymentWebhook(body, supabase);
        break;
      
      case "zapier":
        // Handle Zapier webhooks
        processedData = await handleZapierWebhook(body, supabase);
        break;
      
      default:
        console.log("Generic webhook received:", body);
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
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

async function handleResendWebhook(body: any, supabase: any) {
  console.log("Processing Resend webhook:", body);
  
  const eventType = body.type;
  
  // Update email tracking based on event
  switch (eventType) {
    case "email.delivered":
      console.log("Email delivered:", body.data.email_id);
      break;
    case "email.bounced":
      console.log("Email bounced:", body.data.email_id);
      break;
    case "email.opened":
      console.log("Email opened:", body.data.email_id);
      break;
    case "email.clicked":
      console.log("Email link clicked:", body.data.email_id);
      break;
  }
  
  return { type: "resend", event: eventType, processed: true };
}

async function handlePaymentWebhook(body: any, supabase: any) {
  console.log("Processing payment webhook:", body);
  
  // Handle payment events (e.g., from Stripe, PayPal, etc.)
  // Update appointment payment status if needed
  
  return { type: "payment", processed: true };
}

async function handleZapierWebhook(body: any, supabase: any) {
  console.log("Processing Zapier webhook:", body);
  
  // Handle incoming data from Zapier
  // Can be used to create appointments, add data, etc.
  
  return { type: "zapier", processed: true };
}