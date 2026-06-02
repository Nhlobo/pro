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
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Require admin/employee caller OR internal service-role invocation
    const authHeader = req.headers.get('Authorization') ?? '';
    const providedToken = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';
    const isInternal = providedToken && providedToken === supabaseKey;
    if (!isInternal) {
      if (!providedToken) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: userRes, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userRes?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: isStaff } = await userClient.rpc('is_admin_or_employee');
      if (!isStaff) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

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

    // Sanitize CC list ONCE so we can both send and audit-log the exact recipients used
    const sanitizedCc: string[] = (() => {
      const raw = email.metadata?.cc_addresses;
      if (!raw) return [];
      const emailRegex = /^[^\s<>@]+@[^\s<>@.]+\.[^\s<>@]+$/;
      const list = (Array.isArray(raw) ? raw : [raw])
        .flatMap((v: any) => String(v ?? '').split(/[,;:\s\n\r]+/))
        .map((s: string) => s.trim().replace(/^<|>$/g, ''))
        .filter((s: string) => s.length > 0 && emailRegex.test(s))
        .filter((s: string) => !/@kutlwanoassociate\.com$/i.test(s));
      return Array.from(new Set(list));
    })();

    const rawCcInput = email.metadata?.cc_addresses ?? null;
    const droppedCc = (() => {
      if (!rawCcInput) return [];
      const rawTokens = (Array.isArray(rawCcInput) ? rawCcInput : [rawCcInput])
        .flatMap((v: any) => String(v ?? '').split(/[,;:\s\n\r]+/))
        .map((s: string) => s.trim().replace(/^<|>$/g, ''))
        .filter((s: string) => s.length > 0);
      const keepSet = new Set(sanitizedCc.map(e => e.toLowerCase()));
      return Array.from(new Set(rawTokens.filter(t => !keepSet.has(t.toLowerCase()))));
    })();

    // Pre-send audit log: capture the EXACT sanitized recipients used for this send
    try {
      await supabase.from('audit_logs').insert({
        action_type: 'EMAIL_RECIPIENTS_SANITIZED',
        table_name: email.related_table || 'email_queue',
        record_id: email.related_record_id || emailId,
        function_area: 'Email History',
        description: `Sanitized recipients for queued email ${emailId} (${email.email_type})`,
        new_values: {
          email_id: emailId,
          email_type: email.email_type,
          subject: email.subject,
          to: email.recipient_email,
          cc: sanitizedCc,
          cc_count: sanitizedCc.length,
          attachments_count: metadataAttachments.length,
          cc_raw_input: rawCcInput,
          cc_dropped: droppedCc,
        },
      });
    } catch (auditErr) {
      console.error('Failed to write recipient audit log (non-fatal):', auditErr);
    }

    console.log(`Sanitized recipients for ${emailId} — to=${email.recipient_email} cc=[${sanitizedCc.join(', ')}] dropped=[${droppedCc.join(', ')}]`);

    // Send the email immediately via Resend
    const emailResult = await sendEmail({
      to: email.recipient_email,
      subject: email.subject,
      html: email.html_content,
      replyTo: 'info@kamedico-legal.co.za',
      ...(fromAddress && { from: fromAddress }),
      ...(sanitizedCc.length > 0 && { cc: sanitizedCc }),
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
