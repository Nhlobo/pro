import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from "../_shared/email.ts";
import { withErrorHandler } from "../_shared/errors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { emailId } = await req.json();

    if (!emailId) {
      throw new Error('emailId is required');
    }

    // Get the email from queue
    const { data: email, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('id', emailId)
      .single();

    if (fetchError || !email) {
      throw new Error('Email not found: ' + (fetchError?.message || 'unknown'));
    }

    // If already sent, skip
    if (email.status === 'sent') {
      return new Response(
        JSON.stringify({ success: true, message: 'Already sent', messageId: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine the "from" name — use custom from_name in metadata if available
    const customFromName = email.metadata?.from_name;
    const fromAddress = customFromName 
      ? `${customFromName} <noreply@kamedico-legal.co.za>`
      : undefined; // will use default from sendEmail

    console.log(`Attempting to send email ${emailId} to: ${email.recipient_email}, subject: ${email.subject}`);
    
    // Extract attachments from metadata if present
    const metadataAttachments = email.metadata?.attachments || [];

    // Send the email immediately via Resend
    const emailResult = await sendEmail({
      to: email.recipient_email,
      subject: email.subject,
      html: email.html_content,
      replyTo: 'info@kamedico-legal.co.za',
      ...(fromAddress && { from: fromAddress }),
      ...(email.metadata?.cc_addresses?.length > 0 && { cc: email.metadata.cc_addresses }),
      ...(metadataAttachments.length > 0 && { attachments: metadataAttachments }),
    });

    console.log(`Email send result for ${emailId}:`, JSON.stringify(emailResult));

    if (!emailResult.success) {
      // Update status to error
      await supabase
        .from('email_queue')
        .update({
          status: 'failed',
          error_message: emailResult.error,
        })
        .eq('id', emailId);

      console.error('Email send failed:', emailResult.error);
      return new Response(
        JSON.stringify({ success: false, error: emailResult.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update email status to sent
    await supabase
      .from('email_queue')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', emailId);

    // Log email sent
    await supabase.from('audit_logs').insert({
      action_type: 'EMAIL_AUTO_SENT',
      table_name: email.related_table || 'email_queue',
      record_id: email.related_record_id || emailId,
      function_area: 'Email History',
      description: `Auto-sent ${email.email_type} email to ${email.recipient_email}`,
      new_values: {
        recipient: email.recipient_email,
        message_id: emailResult.messageId,
        email_type: email.email_type
      }
    });

    console.log(`Auto-sent email ${emailId} to ${email.recipient_email}. MessageID: ${emailResult.messageId}`);

    return new Response(
      JSON.stringify({ success: true, messageId: emailResult.messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in auto-send-queued-email:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(withErrorHandler(handler));
