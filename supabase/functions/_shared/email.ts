interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

interface SendGridResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email using SendGrid API
 */
export async function sendEmail(options: EmailOptions): Promise<SendGridResponse> {
  try {
    const sendGridApiKey = Deno.env.get("SENDGRID_API_KEY");
    
    if (!sendGridApiKey) {
      console.error("Missing SendGrid API key");
      return { success: false, error: "SendGrid API key is not configured" };
    }

    const fromEmail = options.from || Deno.env.get("SENDGRID_FROM_EMAIL") || "noreply@kutlwanoassociate.com";
    const fromName = "KA Medico-Legal";

    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    
    // Build SendGrid email payload
    const payload = {
      personalizations: recipients.map(email => ({
        to: [{ email }]
      })),
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: options.subject,
      content: [
        {
          type: "text/html",
          value: options.html
        }
      ],
      ...(options.replyTo && {
        reply_to: {
          email: options.replyTo
        }
      })
    };

    console.log(`Sending email via SendGrid to: ${recipients.join(", ")}`);
    
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sendGridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SendGrid API error:", response.status, errorText);
      return { 
        success: false, 
        error: `SendGrid API error: ${response.status} - ${errorText}` 
      };
    }

    // SendGrid returns 202 Accepted with X-Message-Id header
    const messageId = response.headers.get("X-Message-Id") || `sent-${Date.now()}`;
    console.log(`Email sent successfully via SendGrid. Message ID: ${messageId}`);

    return { success: true, messageId };
  } catch (error: any) {
    console.error("SendGrid email error:", error);
    console.error("Error details:", { message: error.message, stack: error.stack, name: error.name });
    return { success: false, error: error.message || "Failed to send email via SendGrid" };
  }
}
