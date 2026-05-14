import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";
import { z } from "npm:zod@3.22.4";
import { withErrorHandler } from "../_shared/errors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NotificationSchema = z.object({
  type: z.enum(['appointment_reminder', 'report_available', 'document_missing', 'general']),
  userId: z.string().uuid({ message: "Invalid user ID format" }),
  userEmail: z.string().email({ message: "Invalid email format" }).max(255),
  title: z.string().min(1).max(200, { message: "Title must be under 200 characters" }),
  message: z.string().min(1).max(2000, { message: "Message must be under 2000 characters" }),
  category: z.string().max(50).optional(),
  relatedRecordId: z.string().uuid().optional(),
  relatedTable: z.string().max(100).optional(),
  sendEmail: z.boolean().optional().default(true),
}).strict();

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.json();
    const validationResult = NotificationSchema.safeParse(rawBody);

    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error.format());
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: validationResult.error.flatten() }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { type, userId, userEmail, title, message, category, relatedRecordId, relatedTable, sendEmail } = validationResult.data;

    console.log(`Creating notification for user ${userId}: ${title}`);

    let notificationType = 'info';
    if (type === 'report_available') notificationType = 'success';
    if (type === 'document_missing') notificationType = 'warning';
    if (type === 'appointment_reminder') notificationType = 'info';

    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type: notificationType,
        category: category || type,
        related_record_id: relatedRecordId,
        related_table: relatedTable,
        email_sent: false
      })
      .select()
      .single();

    if (notificationError) {
      console.error("Error creating notification:", notificationError);
      throw notificationError;
    }

    console.log(`In-app notification created: ${notification.id}`);

    let emailResult = null;
    if (sendEmail && userEmail) {
      try {
        const emailSubject = getEmailSubject(type, title);
        const emailHtml = generateEmailHtml(type, title, message);

        emailResult = await resend.emails.send({
          from: "Kutlwano Associates <onboarding@resend.dev>",
          to: [userEmail],
          subject: emailSubject,
          html: emailHtml,
        });

        console.log("Email sent successfully:", emailResult);

        await supabase
          .from('notifications')
          .update({ email_sent: true })
          .eq('id', notification.id);

      } catch (emailError) {
        console.error("Error sending email:", emailError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationId: notification.id,
        emailSent: !!emailResult 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-notification function:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing the notification" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function getEmailSubject(type: string, title: string): string {
  switch (type) {
    case 'appointment_reminder':
      return `🗓️ Appointment Reminder: ${title}`;
    case 'report_available':
      return `📄 Report Ready: ${title}`;
    case 'document_missing':
      return `⚠️ Action Required: ${title}`;
    default:
      return `📢 Notification: ${title}`;
  }
}

function generateEmailHtml(type: string, title: string, message: string): string {
  const iconColor = type === 'report_available' ? '#10B981' : 
                    type === 'document_missing' ? '#F59E0B' : '#3B82F6';
  
  // Sanitize title and message to prevent XSS in email
  const sanitize = (str: string) => str.replace(/[<>&"']/g, (c) => {
    const entities: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
    return entities[c] || c;
  });

  const safeTitle = sanitize(title);
  const safeMessage = sanitize(message);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%); padding: 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Kutlwano Associates</h1>
                  <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px;">Medico-Legal Assessment System</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <div style="text-align: center; margin-bottom: 30px;">
                    <div style="width: 60px; height: 60px; background-color: ${iconColor}20; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">
                      <span style="font-size: 30px;">
                        ${type === 'appointment_reminder' ? '🗓️' : type === 'report_available' ? '📄' : type === 'document_missing' ? '⚠️' : '📢'}
                      </span>
                    </div>
                  </div>
                  <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 20px; text-align: center;">${safeTitle}</h2>
                  <p style="color: #64748b; margin: 0 0 25px 0; font-size: 16px; line-height: 1.6; text-align: center;">${safeMessage}</p>
                  <div style="text-align: center; margin-top: 30px;">
                    <a href="https://kamedico-legal.lovable.app" style="display: inline-block; background-color: #1e3a5f; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 500;">View in Dashboard</a>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="color: #94a3b8; margin: 0; font-size: 12px;">
                    This is an automated notification from Kutlwano Associates.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

serve(withErrorHandler(handler));
