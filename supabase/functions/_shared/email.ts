import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Validate SMTP configuration
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");

    if (!smtpHost || !smtpUser || !smtpPassword) {
      console.error("Missing SMTP configuration:", { smtpHost: !!smtpHost, smtpUser: !!smtpUser, smtpPassword: !!smtpPassword });
      return { success: false, error: "SMTP configuration is incomplete" };
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: Number(Deno.env.get("SMTP_PORT") || "587"),
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
    });

    const fromEmail = options.from || Deno.env.get("SMTP_FROM_EMAIL") || smtpUser;
    const fromName = "Medical Assessment System";

    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    // Convert HTML to plain text for text version
    const textContent = options.html
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    for (const recipient of recipients) {
      console.log(`Sending email to: ${recipient}`);
      await client.send({
        from: `${fromName} <${fromEmail}>`,
        to: recipient,
        subject: options.subject,
        content: textContent,
        html: options.html,
      });
      console.log(`Email sent successfully to: ${recipient}`);
    }

    await client.close();

    return { success: true, messageId: `sent-${Date.now()}` };
  } catch (error: any) {
    console.error("SMTP email error:", error);
    console.error("Error details:", { message: error.message, stack: error.stack, name: error.name });
    return { success: false, error: error.message || "Failed to send email" };
  }
}
