import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from "npm:zod@3.22.4";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Comprehensive Zod validation schema
const ReportEmailRequestSchema = z.object({
  appointmentId: z.string().uuid({ message: "Invalid appointment ID format" }),
  emailType: z.enum(['report', 'statement'], { 
    errorMap: () => ({ message: "Email type must be 'report' or 'statement'" })
  }),
  recipientEmail: z.string()
    .email({ message: "Invalid email format" })
    .max(255, { message: "Email must be less than 255 characters" })
    .trim()
    .toLowerCase(),
  recipientName: z.string()
    .min(1, { message: "Recipient name is required" })
    .max(100, { message: "Recipient name must be less than 100 characters" })
    .trim(),
  recipientType: z.enum(['attorney', 'expert'], {
    errorMap: () => ({ message: "Recipient type must be 'attorney' or 'expert'" })
  }),
  customMessage: z.string()
    .max(1000, { message: "Custom message must be less than 1000 characters" })
    .trim()
    .optional()
}).strict();

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

    // Parse and validate request body
    const rawBody = await req.json();
    const validationResult = ReportEmailRequestSchema.safeParse(rawBody);

    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error.format());
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Validation failed',
          details: validationResult.error.flatten()
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        }
      );
    }

    const { appointmentId, emailType, recipientEmail, recipientName, recipientType, customMessage } = validationResult.data;

    console.log(`Sending ${emailType} email for appointment ${appointmentId} to ${recipientEmail}`);

    // Get appointment details
    const { data: appointmentData, error: appointmentError } = await supabaseClient
      .from('appointments')
      .select(`
        *,
        claimants:claimant_id(*),
        medical_experts:expert_id(*),
        referring_attorneys:referring_attorney_id(*)
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
    const referringAttorney = appointmentData.referring_attorneys;

    // Get active employee notifications
    const { data: employeeNotifications } = await supabaseClient
      .from('employee_notifications')
      .select('email, user_id')
      .eq('is_active', true)
      .eq('receive_assessment_changes', true);

    console.log(`Found ${employeeNotifications?.length || 0} active employees to notify`);

    // Generate email content based on type
    let subject: string;
    let htmlContent: string;

    if (emailType === 'report') {
      subject = `Report Request - ${claimant?.first_name} ${claimant?.last_name} (${claimant?.auto_id})`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            Report Request Notification
          </h2>
          
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin-top: 0; color: #92400e;">Action Required:</h3>
            <p style="margin: 0; font-weight: bold;">A report has been requested for the following claimant</p>
          </div>

          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Case Details:</h3>
            <p><strong>Claimant:</strong> ${claimant?.first_name} ${claimant?.last_name}</p>
            <p><strong>Case Reference:</strong> ${claimant?.auto_id}</p>
            <p><strong>Expert:</strong> ${expert?.first_name} ${expert?.last_name}</p>
            <p><strong>Expert Type:</strong> ${expert?.expert_type}</p>
            <p><strong>Appointment Date:</strong> ${new Date(appointmentData.appointment_date).toLocaleDateString()}</p>
            <p><strong>Referring Attorney:</strong> ${referringAttorney?.name}</p>
            <p><strong>Requesting Attorney:</strong> ${appointmentData.referring_attorney}</p>
          </div>

          ${expertReport ? `
          <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
            <h3 style="margin-top: 0; color: #065f46;">Current Report Status:</h3>
            <p><strong>Status:</strong> ${expertReport.report_status}</p>
            ${expertReport.report_submitted_date ? `<p><strong>Submitted Date:</strong> ${new Date(expertReport.report_submitted_date).toLocaleDateString()}</p>` : ''}
            ${expertReport.notes ? `<p><strong>Notes:</strong> ${expertReport.notes}</p>` : ''}
          </div>
          ` : ''}

          ${customMessage ? `
          <div style="background-color: #fefce8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #92400e;">Request Message:</h3>
            <p>${customMessage}</p>
          </div>
          ` : ''}

          <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 30px;">
            <p style="margin: 0; font-size: 14px; color: #64748b;">
              This is an automated notification from the Expert Report Tracking System. 
              Please process this request as soon as possible.
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
            <p><strong>Referring Attorney:</strong> ${referringAttorney?.name}</p>
            <p><strong>Requesting Attorney:</strong> ${appointmentData.referring_attorney}</p>
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

    // Send email to the original recipient
    const emailResponse = await sendEmail({
      from: "Expert Report System <noreply@kutlwanoassociate.com>",
      to: [recipientEmail],
      subject: subject,
      html: htmlContent,
    });

    console.log("Email sent to recipient:", emailResponse);

    // Send notification emails to all active employees
    if (employeeNotifications && employeeNotifications.length > 0) {
      const employeeEmails = employeeNotifications.map(n => n.email);
      
      const systemNotificationSubject = `[System] ${subject}`;
      const systemNotificationHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #3b82f6; color: white; padding: 15px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">System Notification</h2>
          </div>
          ${htmlContent}
        </div>
      `;

      const systemEmailResponse = await sendEmail({
        from: "Expert Report System <noreply@kutlwanoassociate.com>",
        to: employeeEmails,
        subject: systemNotificationSubject,
        html: systemNotificationHtml,
      });

      console.log(`System notification sent to ${employeeEmails.length} employees:`, systemEmailResponse);
      
      // Create email queue entries for tracking
      const queueEntries = employeeNotifications.map(employee => ({
        email_type: 'report_request_notification',
        recipient_email: employee.email,
        recipient_name: 'System Employee',
        subject: systemNotificationSubject,
        html_content: systemNotificationHtml,
        status: systemEmailResponse.success ? 'sent' : 'failed',
        sent_at: systemEmailResponse.success ? new Date().toISOString() : null,
        error_message: systemEmailResponse.success ? null : systemEmailResponse.error,
        related_record_id: appointmentId,
        related_table: 'appointments',
        metadata: {
          notification_type: 'report_request',
          claimant_name: `${claimant?.first_name} ${claimant?.last_name}`,
          claimant_auto_id: claimant?.auto_id,
          user_id: employee.user_id
        }
      }));

      await supabaseClient.from('email_queue').insert(queueEntries);
    }

    // Log the email activity in audit trail
    await supabaseClient.from('audit_logs').insert([{
      table_name: 'appointments',
      record_id: appointmentId,
      action_type: 'REPORT_REQUEST',
      function_area: 'report_distribution',
      description: `Report request sent to ${recipientType}: ${recipientEmail} and ${employeeNotifications?.length || 0} system employees`,
      user_email: recipientEmail,
      new_values: {
        email_type: emailType,
        recipient_type: recipientType,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        system_notifications_sent: employeeNotifications?.length || 0
      }
    }]);

    if (!emailResponse.success) {
      console.error("Failed to send email:", emailResponse.error);
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to send email",
        details: emailResponse.error
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Report request sent successfully to ${recipientName} and ${employeeNotifications?.length || 0} system employees`,
      emailId: emailResponse.messageId,
      systemNotificationsSent: employeeNotifications?.length || 0
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