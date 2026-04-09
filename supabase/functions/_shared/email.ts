import { Resend } from "npm:resend@4.0.0";

interface EmailAttachment {
  filename: string;
  content: string; // base64 string
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
}

// Resend limit is 40MB total. We use 35MB to leave room for email HTML content.
const MAX_EMAIL_SIZE_BYTES = 35 * 1024 * 1024;

/**
 * Estimate the size of a base64 attachment in bytes
 */
function estimateAttachmentSize(base64Content: string): number {
  // Base64 encoding is ~4/3 of the original size, but the payload IS base64
  // so the actual bytes sent in the API call ≈ base64 string length
  return base64Content.length;
}

/**
 * Split attachments into batches that fit within the size limit
 */
function batchAttachments(attachments: EmailAttachment[]): EmailAttachment[][] {
  if (!attachments || attachments.length === 0) return [[]];
  
  const batches: EmailAttachment[][] = [];
  let currentBatch: EmailAttachment[] = [];
  let currentSize = 0;

  for (const att of attachments) {
    const attSize = estimateAttachmentSize(att.content);
    
    // If a single attachment exceeds the limit, it goes alone
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

/**
 * Send email using Resend API.
 * If attachments exceed the 40MB Resend limit, automatically splits into
 * multiple emails with batched attachments.
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResponse> {
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      console.error("Missing Resend API key");
      return { success: false, error: "Resend API key is not configured" };
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
            <div style="background: linear-gradient(135deg, #1fb6ce 0%, #159baf 100%); color: white; padding: 15px 20px; text-align: center; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0; font-size: 14px;">KUTLWANO & ASSOCIATES (PTY) LTD</h2>
              <p style="margin: 4px 0 0; font-size: 10px;">Medico-Legal Service</p>
            </div>
            <p style="color: #374151; font-size: 12px;">This is a follow-up email containing additional document attachments (Part ${batchIndex + 1} of ${batches.length}) for the previous correspondence.</p>
            <p style="color: #374151; font-size: 12px;">📎 ${batch.length} document(s) attached.</p>
            <p style="color: #6b7280; font-size: 10px; margin-top: 20px; font-style: italic;">This is an automated email. Please do not reply directly to this message.</p>
          </div>`
        : options.html;

      console.log(`Sending email batch ${batchIndex + 1}/${batches.length} to: ${recipients.join(", ")}${ccRecipients ? ` (CC: ${ccRecipients.join(", ")})` : ''} with ${batch.length} attachment(s)`);

      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: recipients,
        subject,
        html,
        ...(options.replyTo && { reply_to: options.replyTo }),
        ...(ccRecipients && ccRecipients.length > 0 && { cc: ccRecipients }),
        ...(batch.length > 0 && { attachments: batch })
      });

      if (error) {
        console.error(`Resend API error on batch ${batchIndex + 1}:`, error);
        return { 
          success: false, 
          error: `Resend API error: ${error.message}` 
        };
      }

      lastMessageId = data?.id || '';
      console.log(`Email batch ${batchIndex + 1} sent successfully. Message ID: ${lastMessageId}`);
    }

    return { success: true, messageId: lastMessageId };
    
  } catch (error: any) {
    console.error("Resend email error:", error);
    console.error("Error details:", { message: error.message, stack: error.stack, name: error.name });
    return { success: false, error: error.message || "Failed to send email via Resend" };
  }
}
