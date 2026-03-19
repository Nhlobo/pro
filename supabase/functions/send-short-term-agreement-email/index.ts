import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  agreementId: string;
  recipientEmail?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { agreementId, recipientEmail }: EmailRequest = await req.json();

    // Generate PDF first
    const pdfResponse = await supabase.functions.invoke('generate-short-term-agreement-pdf', {
      body: { agreementId }
    });

    if (pdfResponse.error) {
      throw new Error('Failed to generate PDF: ' + pdfResponse.error.message);
    }

    const { pdfHtml, metadata } = pdfResponse.data;
    const targetEmail = recipientEmail || metadata.attorneyEmail;

    if (!targetEmail) {
      throw new Error('No recipient email address provided');
    }

    // Import email sending function
    const { sendEmail } = await import('../_shared/email.ts');

    // Prepare email content
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Short-Term Agreement – Payment Terms & Conditions</h2>
        
        <p>Dear ${metadata.attorneyName},</p>
        
        <p>Please find attached the Short-Term Agreement based on your selected payment terms.</p>
        
        <p>The agreement includes:</p>
        <ul>
          <li>Claimant details and assessments</li>
          <li>Total cost breakdown</li>
          <li>Payment structure and terms</li>
          <li>Installment schedule</li>
        </ul>
        
        <div style="background: #f8f9fa; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0;">
          <strong>Agreement Summary:</strong><br>
          <p style="margin: 5px 0;"><strong>Reference:</strong> ${metadata.agreementReference}</p>
          <p style="margin: 5px 0;"><strong>Total Reports:</strong> ${metadata.totalReports}</p>
          <p style="margin: 5px 0;"><strong>Total Cost:</strong> R ${metadata.totalCost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
        </div>
        
        <p>Please review the agreement carefully. If you have any questions or require clarification, please do not hesitate to contact us.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        
        <p style="margin-top: 30px;">Kind regards,<br>
        <strong>Kutlwano & Associates (Pty) Ltd</strong><br>
        Medico-Legal Service<br>
        Medical-Legal Services</p>
        
        <p style="font-style: italic; color: #1fb6ce; margin: 20px 0;">"We touch a file, We change a life, We are Kutlwano and Associate"</p>
        
        <p style="font-size: 10px; color: #999; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px;">
          <em>This is an automated email. Please do not reply directly to this message.</em>
        </p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        
        <div style="background: #fff; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Agreement Document</h3>
          ${pdfHtml}
        </div>
      </div>
    `;

    // Send email immediately via Resend
    const { sendEmail } = await import("../_shared/email.ts");
    const emailResult = await sendEmail({
      to: targetEmail,
      subject: `Short-Term Agreement – Payment Terms & Conditions (Ref: ${metadata.agreementReference})`,
      html: emailHtml,
      replyTo: 'info@kamedico-legal.co.za',
    });

    // Record in email_queue for history tracking
    const { data: queuedEmail, error: queueError } = await supabase
      .from('email_queue')
      .insert({
        email_type: 'short_term_agreement',
        recipient_email: targetEmail,
        recipient_name: metadata.attorneyName,
        subject: `Short-Term Agreement – Payment Terms & Conditions (Ref: ${metadata.agreementReference})`,
        html_content: emailHtml,
        metadata: {
          agreementId,
          agreementReference: metadata.agreementReference,
          totalReports: metadata.totalReports,
          totalCost: metadata.totalCost,
          message_id: emailResult.messageId,
        },
        related_record_id: agreementId,
        related_table: 'short_term_agreements',
        status: emailResult.success ? 'sent' : 'failed',
        sent_at: emailResult.success ? new Date().toISOString() : null,
        error_message: emailResult.success ? null : emailResult.error,
      })
      .select()
      .single();

    if (queueError) {
      console.error('Failed to record email in history:', queueError);
    }

    // Log email sent
    await supabase.from('audit_logs').insert({
      action_type: emailResult.success ? 'EMAIL_SENT' : 'EMAIL_FAILED',
      table_name: 'short_term_agreements',
      record_id: agreementId,
      function_area: 'Short-Term Agreement Email',
      description: `${emailResult.success ? 'Sent' : 'Failed to send'} short-term agreement email to ${targetEmail}`,
      new_values: {
        recipient: targetEmail,
        queue_id: queuedEmail?.id,
        agreement_reference: metadata.agreementReference,
        message_id: emailResult.messageId,
      }
    });

    return new Response(
      JSON.stringify({ 
        success: emailResult.success,
        sent: emailResult.success,
        queueId: queuedEmail?.id,
        recipientEmail: targetEmail,
        messageId: emailResult.messageId,
        error: emailResult.success ? undefined : emailResult.error,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error sending short-term agreement email:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
