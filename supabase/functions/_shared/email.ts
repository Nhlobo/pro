import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get("SMTP_HOST") || "smtp.gmail.com",
        port: Number(Deno.env.get("SMTP_PORT") || "587"),
        tls: true,
        auth: {
          username: Deno.env.get("SMTP_USER") || "",
          password: Deno.env.get("SMTP_PASSWORD") || "",
        },
      },
    });

    const fromEmail = options.from || Deno.env.get("SMTP_FROM_EMAIL") || "noreply@yourdomain.com";
    const fromName = "Medical Assessment System";

    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    for (const recipient of recipients) {
      await client.send({
        from: `${fromName} <${fromEmail}>`,
        to: recipient,
        subject: options.subject,
        html: options.html,
      });
    }

    await client.close();

    return { success: true, messageId: `sent-${Date.now()}` };
  } catch (error: any) {
    console.error("SMTP email error:", error);
    return { success: false, error: error.message };
  }
}
