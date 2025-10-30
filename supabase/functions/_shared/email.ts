import { Resend } from "npm:resend@4.0.0";

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email using Resend API
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResponse> {
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      console.error("Missing Resend API key");
      return { success: false, error: "Resend API key is not configured" };
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = options.from || "KA Medico-Legal <noreply@kamedico-legal.co.za>";
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    
    console.log(`Sending email via Resend to: ${recipients.join(", ")}`);
    
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: recipients,
      subject: options.subject,
      html: options.html,
      ...(options.replyTo && { reply_to: options.replyTo })
    });

    if (error) {
      console.error("Resend API error:", error);
      return { 
        success: false, 
        error: `Resend API error: ${error.message}` 
      };
    }

    console.log(`Email sent successfully via Resend. Message ID: ${data?.id}`);
    return { success: true, messageId: data?.id };
    
  } catch (error: any) {
    console.error("Resend email error:", error);
    console.error("Error details:", { message: error.message, stack: error.stack, name: error.name });
    return { success: false, error: error.message || "Failed to send email via Resend" };
  }
}
