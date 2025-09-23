import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportEmailRequest {
  appointmentId: string;
  emailType: 'report' | 'statement';
  recipientEmail: string;
  recipientName: string;
  recipientType: 'attorney' | 'expert';
  customMessage?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const { appointmentId, emailType, recipientEmail, recipientName, recipientType, customMessage }: ReportEmailRequest = await req.json();

    console.log(`Sending ${emailType} email for appointment ${appointmentId} to ${recipientEmail}`);

    // Get appointment details
    const { data: appointmentData, error: appointmentError } = await supabaseClient
      .from('appointments')
      .select(`
        *,
        claimants:claimant_id(*),
        medical_experts:expert_id(*),
        law_firms:law_firm_id(*)
      `)
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointmentData) {
      console.error('Error fetching appointment:', appointmentError);
      throw new Error('Appointment not found');
    }

    // Get expert report details if available
    const { data: expertReport } = await supabaseClient
      .from('expert_reports')
      .select('*')
      .eq('appointment_id', appointmentId)
      .maybeSingle();

    const claimant = appointmentData.claimants;
    const expert = appointmentData.medical_experts;
    const lawFirm = appointmentData.law_firms;

    // Generate email content based on type
    let subject: string;
    let htmlContent: string;

    if (emailType === 'report') {
      subject = `Expert Report - ${claimant?.first_name} ${claimant?.last_name} (${claimant?.auto_id})`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            Expert Report Notification
          </h2>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Case Details:</h3>
            <p><strong>Claimant:</strong> ${claimant?.first_name} ${claimant?.last_name}</p>
            <p><strong>Case Reference:</strong> ${claimant?.auto_id}</p>
            <p><strong>Expert:</strong> ${expert?.first_name} ${expert?.last_name}</p>
            <p><strong>Expert Type:</strong> ${expert?.expert_type}</p>
            <p><strong>Appointment Date:</strong> ${new Date(appointmentData.appointment_date).toLocaleDateString()}</p>
            <p><strong>Law Firm:</strong> ${lawFirm?.name}</p>
            <p><strong>Referring Attorney:</strong> ${appointmentData.referring_attorney}</p>
          </div>

          ${expertReport ? `
          <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
            <h3 style="margin-top: 0; color: #065f46;">Report Status:</h3>
            <p><strong>Status:</strong> ${expertReport.report_status}</p>
            ${expertReport.report_submitted_date ? `<p><strong>Submitted Date:</strong> ${new Date(expertReport.report_submitted_date).toLocaleDateString()}</p>` : ''}
            ${expertReport.notes ? `<p><strong>Notes:</strong> ${expertReport.notes}</p>` : ''}
          </div>
          ` : ''}

          ${customMessage ? `
          <div style="background-color: #fefce8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #92400e;">Additional Message:</h3>
            <p>${customMessage}</p>
          </div>
          ` : ''}

          <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 30px;">
            <p style="margin: 0; font-size: 14px; color: #64748b;">
              This is an automated notification from the Expert Report Tracking System. 
              Please contact the law firm directly for any inquiries.
            </p>
          </div>
        </div>
      `;
    } else {
      subject = `Statement Available - ${claimant?.first_name} ${claimant?.last_name} (${claimant?.auto_id})`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            Statement Distribution Notice
          </h2>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <h3 style="margin-top: 0; color: #991b1b;">Important Notice:</h3>
            <p style="margin: 0; font-weight: bold;">This report should not be used to distribute Statements to customers. Please use the Customer Statement Run to distribute Statements.</p>
          </div>

          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Case Details:</h3>
            <p><strong>Claimant:</strong> ${claimant?.first_name} ${claimant?.last_name}</p>
            <p><strong>Case Reference:</strong> ${claimant?.auto_id}</p>
            <p><strong>Expert:</strong> ${expert?.first_name} ${expert?.last_name}</p>
            <p><strong>Law Firm:</strong> ${lawFirm?.name}</p>
            <p><strong>Referring Attorney:</strong> ${appointmentData.referring_attorney}</p>
            <p><strong>Case Status:</strong> ${appointmentData.case_status}</p>
            ${appointmentData.deposit_amount ? `<p><strong>Deposit Amount:</strong> R${appointmentData.deposit_amount}</p>` : ''}
          </div>

          ${customMessage ? `
          <div style="background-color: #fefce8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #92400e;">Additional Message:</h3>
            <p>${customMessage}</p>
          </div>
          ` : ''}

          <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 30px;">
            <p style="margin: 0; font-size: 14px; color: #64748b;">
              This statement is for internal use only. Please refer to proper customer statement procedures for client distribution.
            </p>
          </div>
        </div>
      `;
    }

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Expert Report System <noreply@kutlwanoassociate.com>",
      to: [recipientEmail],
      subject: subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    // Log the email activity in audit trail
    await supabaseClient.from('audit_logs').insert([{
      table_name: 'appointments',
      record_id: appointmentId,
      action_type: 'EMAIL_SENT',
      function_area: 'report_distribution',
      description: `${emailType.toUpperCase()} sent to ${recipientType}: ${recipientEmail}`,
      user_email: recipientEmail,
      new_values: {
        email_type: emailType,
        recipient_type: recipientType,
        recipient_email: recipientEmail,
        recipient_name: recipientName
      }
    }]);

    return new Response(JSON.stringify({
      success: true,
      message: `${emailType.charAt(0).toUpperCase() + emailType.slice(1)} sent successfully to ${recipientName}`,
      emailId: emailResponse.data?.id
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in send-report-email function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to send email' 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);