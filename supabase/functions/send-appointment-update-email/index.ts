import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AppointmentUpdateEmailRequest {
  recipientEmail: string;
  subject: string;
  message: string;
  requestData: {
    id: string;
    referring_attorney_name: string;
    claimant_first_name: string;
    claimant_last_name: string;
    expert_type_requested: string;
    matter_type: string;
    province: string;
    status: string;
    suggested_date?: string;
    confirmed_appointment_date?: string;
    confirmed_appointment_time?: string;
    approval_notes?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmail, subject, message, requestData }: AppointmentUpdateEmailRequest = await req.json();

    console.log("Sending appointment update email to:", recipientEmail);

    // Format status display
    let statusDisplay = requestData.status;
    let statusColor = "#666";
    
    switch (requestData.status) {
      case "approved":
        statusDisplay = "Approved";
        statusColor = "#22c55e";
        break;
      case "rejected":
        statusDisplay = "Rejected";
        statusColor = "#ef4444";
        break;
      case "new_date_proposed":
        statusDisplay = "New Date Proposed";
        statusColor = "#3b82f6";
        break;
      case "pending":
        statusDisplay = "Pending";
        statusColor = "#f59e0b";
        break;
    }

    // Format dates for display in table
    let dateDisplay = "";
    let timeDisplay = "";
    
    // Prioritize confirmed appointment date/time, then fall back to suggested date
    if (requestData.confirmed_appointment_date) {
      const dateTimeStr = requestData.confirmed_appointment_time 
        ? `${requestData.confirmed_appointment_date}T${requestData.confirmed_appointment_time}`
        : requestData.confirmed_appointment_date;
      const date = new Date(dateTimeStr);
      dateDisplay = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      timeDisplay = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (requestData.suggested_date) {
      const date = new Date(requestData.suggested_date);
      dateDisplay = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      timeDisplay = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    // Build the email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Appointment Letter</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          
          <div style="background-color: #1fb6ce; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">New Appointment Letter</h1>
          </div>
          
          <div style="background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1fb6ce; margin-top: 0; font-size: 18px;">Case Information</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Claimant:</strong></td>
                  <td style="padding: 8px 0;">${requestData.claimant_first_name} ${requestData.claimant_last_name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Expert Type:</strong></td>
                  <td style="padding: 8px 0;">${requestData.expert_type_requested}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Matter Type:</strong></td>
                  <td style="padding: 8px 0;">${requestData.matter_type}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Province:</strong></td>
                  <td style="padding: 8px 0;">${requestData.province}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;">
                    <span style="background-color: ${statusColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 14px;">
                      ${statusDisplay}
                    </span>
                  </td>
                </tr>
                ${dateDisplay ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Date of Assessment:</strong></td>
                  <td style="padding: 8px 0;">${dateDisplay}</td>
                </tr>
                ` : ''}
                ${timeDisplay ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Time of Assessment:</strong></td>
                  <td style="padding: 8px 0;">${timeDisplay}</td>
                </tr>
                ` : ''}
              </table>
            </div>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1fb6ce; margin-top: 0; font-size: 18px;">Message from Kutlwano & Associate</h2>
              <div style="color: #333; white-space: pre-wrap;">${message}</div>
            </div>

            ${requestData.approval_notes ? `
            <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b;">
              <h3 style="color: #92400e; margin: 0 0 8px 0;">Additional Notes</h3>
              <p style="margin: 0; color: #92400e;">${requestData.approval_notes}</p>
            </div>
            ` : ''}

            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; color: #666; font-size: 14px;">
              <p style="margin: 0 0 8px 0;"><strong>Kutlwano & Associate</strong></p>
              <p style="margin: 0;">Email: info@kutlwanoassociate.com</p>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #999;">
                This is an automated notification from the Medico-Legal Assessment System.
              </p>
            </div>

          </div>

        </body>
      </html>
    `;

    // Queue email for review
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const queueResponse = await fetch(`${supabaseUrl}/rest/v1/email_queue`, {
      method: 'POST',
      headers: {
        'apikey': Deno.env.get("SUPABASE_ANON_KEY") || '',
        'authorization': `Bearer ${supabaseKey}`,
        'content-type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        email_type: 'appointment_update',
        recipient_email: recipientEmail,
        recipient_name: requestData.referring_attorney_name,
        subject: subject,
        html_content: emailHtml,
        metadata: {
          request_id: requestData.id,
          claimant_name: `${requestData.claimant_first_name} ${requestData.claimant_last_name}`,
          status: requestData.status
        },
        related_record_id: requestData.id,
        related_table: 'appointment_requests',
        status: 'pending'
      })
    });

    if (!queueResponse.ok) {
      throw new Error("Failed to queue email");
    }

    const queuedEmail = await queueResponse.json();
    console.log("Appointment update email queued for review:", queuedEmail[0]?.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        queued: true,
        queueId: queuedEmail[0]?.id
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-appointment-update-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to send appointment update email" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
