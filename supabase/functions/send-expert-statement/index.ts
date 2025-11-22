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
  toEmail: string;
  ccEmails: string;
  subject: string;
  message: string;
  pdfBase64: string;
  appointments: {
    appointment_id: string;
    appointment_date: string;
    claimant_name: string;
    consultation_fee: number;
    court_fee_used: boolean;
    court_fee_amount: number;
    total_due: number;
    deposit_paid: number;
    balance_due: number;
    payment_status: string;
    last_payment_date?: string;
    payment_updated_at?: string;
  }[];
  totalOwed: number;
  totalDeposit: number;
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
    const { expertId, expertName, toEmail, ccEmails, subject, message, pdfBase64, appointments, totalOwed, totalDeposit, totalBalance } = requestData;

    console.log('Sending payment statement to expert: ' + expertName);

    // Fetch the real email address from the database using service role (bypasses RLS)
    const { data: expertData, error: expertError } = await supabase
      .from('medical_experts')
      .select('email, contact_number')
      .eq('id', expertId)
      .single();

    if (expertError || !expertData) {
      console.error('Error fetching expert data:', expertError);
      throw new Error('Expert not found or unable to retrieve contact information');
    }

    const realEmail = expertData.email;

    if (!realEmail || !realEmail.includes('@') || !realEmail.includes('.')) {
      console.error('Invalid expert email address:', realEmail);
      throw new Error('Expert does not have a valid email address on file');
    }

    console.log('Resolved email address for expert');

    // Prepare email body
    const emailBody = '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; line-height: 1.6; color: #374151;">' +
      '<div style="max-width: 600px; margin: 0 auto; padding: 20px;">' +
        '<div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">' +
          '<h1 style="color: #ffffff; margin: 0; font-size: 24px;">Payment Statement</h1>' +
          '<p style="color: #e0e7ff; margin: 8px 0 0 0;">Kutlwano & Associates Medico-Legal</p>' +
        '</div>' +
        '<div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">' +
          '<div style="white-space: pre-wrap; margin-bottom: 20px;">' + message + '</div>' +
          '<div style="background-color: #eff6ff; padding: 15px; border-left: 4px solid #3b82f6; border-radius: 4px; margin: 20px 0;">' +
            '<p style="margin: 0; font-size: 14px; color: #1e40af;"><strong>Attachment:</strong> Payment statement PDF is attached to this email.</p>' +
          '</div>' +
        '</div>' +
        '<div style="text-align: center; margin-top: 20px; padding: 20px; color: #6b7280; font-size: 12px;">' +
          '<p style="margin: 0;">© ' + new Date().getFullYear() + ' Kutlwano & Associates Medico-Legal. All rights reserved.</p>' +
        '</div>' +
      '</div>' +
    '</div>';

    // Prepare CC recipients (filter out invalid emails)
    const ccRecipients = ccEmails ? 
      ccEmails.split(',')
        .map(email => email.trim())
        .filter(email => email && email.includes('@') && email.includes('.')) 
      : [];

    // Prepare attachments
    const attachments = pdfBase64 ? [{
      filename: 'Expert_Statement_' + expertName.replace(/\s+/g, '_') + '_' + new Date().toISOString().split('T')[0] + '.pdf',
      content: pdfBase64,
    }] : [];

    // Send email using the real email address
    const emailResult = await sendEmail({
      to: realEmail,
      cc: ccRecipients,
      subject: subject,
      html: emailBody,
      attachments: attachments,
      from: "Kutlwano & Associates <noreply@kamedico-legal.co.za>",
    });

    if (!emailResult.success) {
      throw new Error(emailResult.error || "Failed to send email");
    }

    // Log to audit trail
    await supabase.rpc('log_audit_trail', {
      p_table_name: 'medical_experts',
      p_record_id: expertId,
      p_action_type: 'EMAIL_SENT',
      p_function_area: 'expert_payment',
      p_new_values: { 
        email_type: 'payment_statement',
        recipient: realEmail,
        cc_recipients: ccRecipients,
        total_balance: totalBalance,
        appointment_count: appointments.length,
      },
      p_description: 'Payment statement sent to ' + expertName + ' with PDF attachment',
    });

    console.log('Payment statement sent successfully to ' + realEmail);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Statement sent successfully to " + expertName,
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