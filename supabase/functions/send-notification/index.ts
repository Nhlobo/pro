import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: 'appointment_reminder' | 'report_available' | 'document_missing' | 'general';
  userId: string;
  userEmail: string;
  title: string;
  message: string;
  category?: string;
  relatedRecordId?: string;
  relatedTable?: string;
  sendEmail?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
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

    const { 
      type, 
      userId, 
      userEmail, 
      title, 
      message, 
      category, 
      relatedRecordId, 
      relatedTable,
      sendEmail = true 
    }: NotificationRequest = await req.json();

    console.log(`Creating notification for user ${userId}: ${title}`);

    // Determine notification type for UI
    let notificationType = 'info';
    if (type === 'report_available') notificationType = 'success';
    if (type === 'document_missing') notificationType = 'warning';
    if (type === 'appointment_reminder') notificationType = 'info';

    // Create in-app notification
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

    // Send email notification if requested
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

        // Update notification to mark email as sent
        await supabase
          .from('notifications')
          .update({ email_sent: true })
          .eq('id', notification.id);

      } catch (emailError) {
        console.error("Error sending email:", emailError);
        // Don't fail the whole request if email fails
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
      JSON.stringify({ error: error.message }),
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
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%); padding: 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Kutlwano Associates</h1>
                  <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px;">Medico-Legal Assessment System</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <div style="text-align: center; margin-bottom: 30px;">
                    <div style="width: 60px; height: 60px; background-color: ${iconColor}20; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">
                      <span style="font-size: 30px;">
                        ${type === 'appointment_reminder' ? '🗓️' : type === 'report_available' ? '📄' : type === 'document_missing' ? '⚠️' : '📢'}
                      </span>
                    </div>
                  </div>
                  
                  <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 20px; text-align: center;">${title}</h2>
                  <p style="color: #64748b; margin: 0 0 25px 0; font-size: 16px; line-height: 1.6; text-align: center;">${message}</p>
                  
                  <div style="text-align: center; margin-top: 30px;">
                    <a href="https://zybkhhxvsdjkluqydcbb.supabase.co" style="display: inline-block; background-color: #1e3a5f; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 500;">View in Dashboard</a>
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="color: #94a3b8; margin: 0; font-size: 12px;">
                    This is an automated notification from Kutlwano Associates.
                  </p>
                  <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 12px;">
                    © ${new Date().getFullYear()} Kutlwano Associates. All rights reserved.
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

serve(handler);
