import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendQueuedEmailRequest {
  emailId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { emailId }: SendQueuedEmailRequest = await req.json();

    // Get the email from queue
    const { data: email, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('id', emailId)
      .eq('status', 'approved')
      .single();

    if (fetchError || !email) {
      throw new Error('Email not found or not approved');
    }

    // Import email sending function
    const { sendEmail } = await import('../_shared/email.ts');

    // Send the email
    const emailResult = await sendEmail({
      to: email.recipient_email,
      subject: email.subject,
      html: email.html_content,
      replyTo: 'info@kamedico-legal.co.za'
    });

    if (!emailResult.success) {
      // Update status to error
      await supabase
        .from('email_queue')
        .update({
          error_message: emailResult.error,
        })
        .eq('id', emailId);

      throw new Error('Failed to send email: ' + emailResult.error);
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
      action_type: 'EMAIL_SENT',
      table_name: email.related_table || 'email_queue',
      record_id: email.related_record_id || emailId,
      function_area: 'Email Queue',
      description: `Sent queued ${email.email_type} email to ${email.recipient_email}`,
      new_values: {
        recipient: email.recipient_email,
        message_id: emailResult.messageId,
        email_type: email.email_type
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        messageId: emailResult.messageId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error sending queued email:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
