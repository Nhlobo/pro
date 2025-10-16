import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  testEmail: string;
  fromDomain?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { testEmail, fromDomain }: TestEmailRequest = await req.json();
    
    console.log(`Testing email delivery to: ${testEmail}`);
    
    // Test email with SendGrid
    const testEmailResponse = await sendEmail({
      from: "noreply@kutlwanoassociate.com",
      to: testEmail,
      subject: "Email Delivery Test - SendGrid",
      html: `
        <h2>Email Delivery Test</h2>
        <p>This is a test email sent via SendGrid.</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p><strong>Test Email:</strong> ${testEmail}</p>
        <hr>
        <p><em>If you receive this email, SendGrid integration is working correctly.</em></p>
        <p>Next steps:</p>
        <ol>
          <li>Verify your sender domain in SendGrid dashboard</li>
          <li>Set up domain authentication (SPF, DKIM)</li>
          <li>Configure any webhooks for bounce/spam tracking</li>
        </ol>
      `,
    });

    console.log("Test email sent:", testEmailResponse);

    // If custom domain is provided, test it too
    let customTestResponse = null;
    if (fromDomain) {
      try {
        customTestResponse = await sendEmail({
          from: `noreply@${fromDomain}`,
          to: testEmail,
          subject: "Email Delivery Test - Custom Domain",
          html: `
            <h2>Custom Domain Email Test</h2>
            <p>This email was sent from your custom domain: <strong>${fromDomain}</strong></p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          `,
        });
        console.log("Custom domain test email sent:", customTestResponse);
      } catch (error: any) {
        console.error("Custom domain test failed:", error);
        customTestResponse = { success: false, error: error.message };
      }
    }

    return new Response(JSON.stringify({
      success: testEmailResponse.success,
      message: testEmailResponse.success ? "Test email sent successfully" : "Failed to send test email",
      testResult: {
        success: testEmailResponse.success,
        messageId: testEmailResponse.messageId,
        error: testEmailResponse.error
      },
      ...(customTestResponse && {
        customDomainTest: customTestResponse
      }),
      troubleshooting: {
        sendGridDashboard: "https://app.sendgrid.com/",
        domainAuthentication: "https://app.sendgrid.com/settings/sender_auth",
        activityFeed: "https://app.sendgrid.com/email_activity"
      }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in test-email-delivery function:", error);

    let errorSuggestions = [
      "Verify SENDGRID_API_KEY is set correctly in Supabase secrets",
      "Check if email address is valid",
      "Ensure sender email is verified in SendGrid"
    ];

    if (error.message?.includes("API key") || error.message?.includes("401")) {
      errorSuggestions = [
        "Invalid SendGrid API key",
        "API key doesn't have 'Mail Send' permission",
        "Check API key in SendGrid dashboard"
      ];
    } else if (error.message?.includes("domain") || error.message?.includes("403")) {
      errorSuggestions = [
        "Sender email not verified in SendGrid",
        "Domain authentication not set up",
        "Add DNS records for domain authentication"
      ];
    }

    return new Response(
      JSON.stringify({ 
        error: error.message,
        troubleshooting: {
          possibleCauses: errorSuggestions,
          nextSteps: [
            "Check SendGrid dashboard for errors",
            "Verify domain DNS settings",
            "Check spam/junk folders",
            "Test with a different email provider"
          ],
          sendGridDashboard: "https://app.sendgrid.com/",
          domainAuthentication: "https://app.sendgrid.com/settings/sender_auth"
        }
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);