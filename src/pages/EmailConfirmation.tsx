import { Resend } from "npm:resend@4.0.0";

interface EmailAttachment {
  filename: string;
  content: string;
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  attachments?: EmailAttachment[];
}

interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
}

const MAX_EMAIL_SIZE_BYTES = 35 * 1024 * 1024;

function estimateAttachmentSize(base64Content: string): number {
  return base64Content.length;
}

function batchAttachments(attachments: EmailAttachment[]): EmailAttachment[][] {
  if (!attachments || attachments.length === 0) return [[]];

  const batches: EmailAttachment[][] = [];
  let currentBatch: EmailAttachment[] = [];
  let currentSize = 0;

  for (const att of attachments) {
    const attSize = estimateAttachmentSize(att.content);

    if (attSize >= MAX_EMAIL_SIZE_BYTES) {
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentSize = 0;
      }
      batches.push([att]);
      continue;
    }

    if (currentSize + attSize > MAX_EMAIL_SIZE_BYTES) {
      batches.push(currentBatch);
      currentBatch = [att];
      currentSize = attSize;
    } else {
      currentBatch.push(att);
      currentSize += attSize;
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches.length > 0 ? batches : [[]];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// FIXED 2026-08-31: rebuilt to be a true clone of the OTP email
// (external-portal-auth/index.ts otpEmailHtml) -- identical header,
// identical footer, identical fonts/spacing/sharp corners (no
// border-radius, matching the rest of the system's UI). Only the middle
// section differs: a Confirm button + fallback link instead of a 6-digit
// code. `actionLink` is always generated with redirectTo pointing at
// APP_ORIGIN (https://medico-legal-pro-71z1.onrender.com), never the
// retired kamedico-legal.co.za domain -- see create-user/index.ts and
// resend-user-confirmation/index.ts.
export function confirmAccountEmailHtml(actionLink: string, fullName?: string): string {
  const greeting = fullName?.trim()
    ? `<p style="color: #1f2937; font-size: 14px; margin: 0 0 12px;">Hi ${escapeHtml(fullName.trim())},</p>`
    : '';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f4f6f7;">
      <div style="background: #ffffff; border: 1px solid #e5e7eb; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1fb6ce 0%, #159baf 100%); color: #ffffff; padding: 22px 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 16px; letter-spacing: 0.5px;">KUTLWANO &amp; ASSOCIATES (PTY) LTD</h1>
          <p style="margin: 4px 0 0; font-size: 11px; opacity: 0.9;">Medico-Legal Service</p>
        </div>

        <div style="padding: 28px 28px 8px;">
          ${greeting}
          <p style="color: #374151; font-size: 14px; margin: 0 0 20px;">
            Please confirm your email address to activate your <strong>Medico-Legal Pro</strong> staff account:
          </p>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${actionLink}" style="display: inline-block; background: #159baf; color: #ffffff; padding: 14px 32px; text-decoration: none; font-weight: bold; font-size: 14px;">
              Confirm Email &amp; Sign In
            </a>
          </div>

          <p style="color: #374151; font-size: 13px; margin: 0 0 4px;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="font-size: 11px; word-break: break-all; color: #159baf; margin: 0 0 20px;">${actionLink}</p>
          <p style="color: #6b7280; font-size: 12px; margin: 0 0 20px;">
            If you weren't expecting this email, you can safely ignore it — no changes will be made to your account.
          </p>
        </div>

        <hr style="margin: 0; border: none; border-top: 1px solid #eee;">

        <div style="padding: 18px 28px 24px;">
          <p style="font-style: italic; color: #1fb6ce; font-size: 12px; margin: 0 0 10px;">
            "We touch a file, we change a life, we are Kutlwano and Associate"
          </p>
          <p style="font-size: 10px; color: #999; margin: 0;">
            This is an automated security email. Please do not reply directly to this message.
          </p>
        </div>
      </div>
      <p style="text-align: center; font-size: 10px; color: #9ca3af; margin: 14px 0 0;">
        Kutlwano &amp; Associates (Pty) Ltd | Registration: 2016/461385/07
      </p>
    </div>
  `;
}

export async function sendEmail(options: EmailOptions): Promise<EmailResponse> {
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("Missing Resend API key");
      return { success: false, error: "Resend API key is not configured", provider: "resend" };
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = options.from || "Kutlwano & Associate <noreply@kamedico-legal.co.za>";
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    const ccRecipients = options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : undefined;

    const attachments = options.attachments || [];
    const batches = batchAttachments(attachments);
    const needsSplit = batches.length > 1;

    if (needsSplit) {
      console.log(`Attachments exceed size limit. Splitting into ${batches.length} emails.`);
    }

    let lastMessageId = '';

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const isFollowUp = batchIndex > 0;

      const subject = isFollowUp
        ? `${options.subject} (Attachments ${batchIndex + 1}/${batches.length})`
        : options.subject;

      const html = isFollowUp
        ? `<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1fb6ce 0%, #159baf 100%); color: white; padding: 15px 20px; text-align: center; margin-bottom: 20px;">
              <h2 style="margin: 0; font-size: 14px;">KUTLWANO & ASSOCIATES (PTY) LTD</h2>
              <p style="margin: 4px 0 0; font-size: 10px;">Medico-Legal Service</p>
            </div>
            <p style="color: #374151; font-size: 12px;">This is a follow-up email containing additional document attachments (Part ${batchIndex + 1} of ${batches.length}) for the previous correspondence.</p>
            <p style="color: #374151; font-size: 12px;">📎 ${batch.length} document(s) attached.</p>
            <p style="color: #6b7280; font-size: 10px; margin-top: 20px; font-style: italic;">This is an automated email. Please do not reply directly to this message.</p>
          </div>`
        : options.html;

      console.log(`Sending email batch ${batchIndex + 1}/${batches.length} to: ${recipients.join(", ")}${ccRecipients ? ` (CC: ${ccRecipients.join(", ")})` : ''} with ${batch.length} attachment(s)`);

      const defaultReplyTo = "info@kamedico-legal.co.za";
      const replyToAddress = options.replyTo || defaultReplyTo;

      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: recipients,
        subject,
        html,
        reply_to: replyToAddress,
        headers: {
          "List-Unsubscribe": `<mailto:${defaultReplyTo}?subject=Unsubscribe>`,
          "X-Entity-Ref-ID": crypto.randomUUID(),
        },
        ...(ccRecipients && ccRecipients.length > 0 && { cc: ccRecipients }),
        ...(batch.length > 0 && { attachments: batch })
      });

      if (error) {
        console.error(`Resend API error on batch ${batchIndex + 1}:`, error);
        return { success: false, error: `Resend API error: ${error.message}`, provider: "resend" };
      }

      lastMessageId = data?.id || '';
      console.log(`Email batch ${batchIndex + 1} sent successfully. Message ID: ${lastMessageId}`);
    }

    return { success: true, messageId: lastMessageId, provider: "resend" };

  } catch (error: any) {
    console.error("Resend email error:", error);
    console.error("Error details:", { message: error.message, stack: error.stack, name: error.name });
    return { success: false, error: error.message || "Failed to send email via Resend", provider: "resend" };
  }
}
