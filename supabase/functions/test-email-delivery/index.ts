import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
    
    // Test with default verified domain first (onboarding@resend.dev)
    const testEmailResponse = await resend.emails.send({
      from: "Test Email <onboarding@resend.dev>",
      to: [testEmail],
      subject: "Email Delivery Test - Default Domain",
      html: `
        <h2>Email Delivery Test</h2>
        <p>This is a test email sent from the default Resend domain.</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p><strong>Test Email:</strong> ${testEmail}</p>
        <hr>
        <p><em>If you receive this email, the basic email functionality is working.</em></p>
      `,
    });

    console.log("Default domain test email sent:", testEmailResponse);

    // If custom domain is provided, test it too
    let customDomainResponse = null;
    if (fromDomain) {
      try {
        customDomainResponse = await resend.emails.send({
          from: `Test Email <noreply@${fromDomain}>`,
          to: [testEmail],
          subject: "Email Delivery Test - Custom Domain",
          html: `
            <h2>Custom Domain Email Test</h2>
            <p>This is a test email sent from your custom domain: ${fromDomain}</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p><strong>Test Email:</strong> ${testEmail}</p>
            <hr>
            <p><em>If you receive this email, your custom domain is properly configured.</em></p>
          `,
        });
        console.log("Custom domain test email sent:", customDomainResponse);
      } catch (domainError: any) {
        console.error("Custom domain email failed:", domainError);
        customDomainResponse = { error: domainError.message };
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      defaultDomainResult: testEmailResponse,
      customDomainResult: customDomainResponse,
      troubleshooting: {
        message: "Check your spam/junk folder if emails are not received",
        resendDashboard: "https://resend.com/emails",
        domainVerification: "https://resend.com/domains"
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
    return new Response(
      JSON.stringify({ 
        error: error.message,
        troubleshooting: {
          possibleCauses: [
            "Invalid Resend API key",
            "Domain not verified in Resend",
            "Missing SPF/DKIM records",
            "Rate limiting",
            "Invalid email format"
          ],
          nextSteps: [
            "Check Resend dashboard for errors",
            "Verify domain DNS settings",
            "Check spam/junk folders",
            "Test with a different email provider"
          ]
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