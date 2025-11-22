import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExpertStatementRequest {
  expertId: string;
  expertName: string;
  expertEmail: string;
  appointments: {
    appointment_id: string;
    appointment_date: string;
    claimant_name: string;
    service_fee: number;
    paid_amount: number;
    balance_due: number;
    payment_status: string;
    last_payment_date?: string;
  }[];
  totalOwed: number;
  totalPaid: number;
  totalBalance: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestData: ExpertStatementRequest = await req.json();
    const { expertName, expertEmail, appointments, totalOwed, totalPaid, totalBalance } = requestData;

    console.log(`Sending payment statement to expert: ${expertName} (${expertEmail})`);

    // Build appointment rows for the email
    const appointmentRows = appointments.map(apt => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 8px;">${new Date(apt.appointment_date).toLocaleDateString('en-ZA')}</td>
        <td style="padding: 12px 8px;">${apt.claimant_name}</td>
        <td style="padding: 12px 8px; text-align: right;">R ${apt.service_fee.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 12px 8px; text-align: right; color: #10b981;">R ${apt.paid_amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 12px 8px; text-align: right; color: #ef4444;">R ${apt.balance_due.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 12px 8px;">
          <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; ${
            apt.payment_status === 'paid' 
              ? 'background-color: #d1fae5; color: #065f46;'
              : 'background-color: #fee2e2; color: #991b1b;'
          }">
            ${apt.payment_status}
          </span>
        </td>
        <td style="padding: 12px 8px;">${apt.last_payment_date ? new Date(apt.last_payment_date).toLocaleDateString('en-ZA') : 'Not paid'}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Statement</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f9fafb;">
          <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Payment Statement</h1>
              <p style="color: #e0e7ff; margin: 8px 0 0 0;">Kutlwano & Associates Medico-Legal</p>
            </div>

            <!-- Content -->
            <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <p style="font-size: 16px; margin: 0 0 20px 0;">Dear Dr. ${expertName},</p>
              
              <p style="margin: 0 0 20px 0;">
                Please find below your payment statement for services rendered. This statement shows all booked appointments and their payment status.
              </p>

              <!-- Summary Cards -->
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 30px 0;">
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Total Owed</p>
                  <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: bold; color: #111827;">
                    R ${totalOwed.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #065f46; text-transform: uppercase;">Total Paid</p>
                  <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: bold; color: #065f46;">
                    R ${totalPaid.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #991b1b; text-transform: uppercase;">Balance Due</p>
                  <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: bold; color: #991b1b;">
                    R ${totalBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <!-- Appointments Table -->
              <h2 style="font-size: 18px; color: #111827; margin: 30px 0 15px 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
                Appointment Details
              </h2>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                  <tr style="background-color: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                    <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151;">Date</th>
                    <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151;">Claimant</th>
                    <th style="padding: 12px 8px; text-align: right; font-weight: 600; color: #374151;">Service Fee</th>
                    <th style="padding: 12px 8px; text-align: right; font-weight: 600; color: #374151;">Paid</th>
                    <th style="padding: 12px 8px; text-align: right; font-weight: 600; color: #374151;">Balance</th>
                    <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151;">Status</th>
                    <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151;">Last Payment</th>
                  </tr>
                </thead>
                <tbody>
                  ${appointmentRows}
                </tbody>
              </table>

              <div style="margin: 30px 0; padding: 20px; background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #1e40af;">
                  <strong>Note:</strong> This statement was generated on ${new Date().toLocaleDateString('en-ZA', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })} at ${new Date().toLocaleTimeString('en-ZA', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}.
                </p>
              </div>

              <p style="margin: 20px 0 0 0;">
                If you have any questions regarding this statement, please contact our accounts department.
              </p>

              <p style="margin: 20px 0 0 0;">
                Best regards,<br>
                <strong>Kutlwano & Associates</strong><br>
                Medico-Legal Services
              </p>
            </div>

            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding: 20px; color: #6b7280; font-size: 12px;">
              <p style="margin: 0;">© ${new Date().getFullYear()} Kutlwano & Associates Medico-Legal. All rights reserved.</p>
              <p style="margin: 8px 0 0 0;">This is an automated statement. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email using the shared email utility
    const emailResult = await sendEmail({
      to: expertEmail,
      subject: `Payment Statement - ${new Date().toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}`,
      html: htmlContent,
      from: "Kutlwano & Associates <noreply@kamedico-legal.co.za>",
    });

    if (!emailResult.success) {
      throw new Error(emailResult.error || "Failed to send email");
    }

    // Log to audit trail
    await supabase.rpc('log_audit_trail', {
      p_table_name: 'medical_experts',
      p_record_id: requestData.expertId,
      p_action_type: 'EMAIL_SENT',
      p_function_area: 'expert_payment',
      p_new_values: { 
        email_type: 'payment_statement',
        recipient: expertEmail,
        total_balance: totalBalance,
        appointment_count: appointments.length,
      },
      p_description: `Payment statement sent to ${expertName}`,
    });

    console.log(`Payment statement sent successfully to ${expertEmail}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Statement sent successfully",
        messageId: emailResult.messageId,
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error sending expert statement:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
};

serve(handler);
