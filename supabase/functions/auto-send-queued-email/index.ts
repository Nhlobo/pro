import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from "../_shared/email.ts";
import { withErrorHandler } from "../_shared/errors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Expose-Headers': 'x-correlation-id',
};

const FUNCTION_NAME = 'auto-send-queued-email';

type LogLevel = 'info' | 'warn' | 'error';

function makeLogger(correlationId: string, baseCtx: Record<string, unknown> = {}) {
  const emit = (level: LogLevel, event: string, ctx: Record<string, unknown> = {}) => {
    const payload = {
      ts: new Date().toISOString(),
      level,
      fn: FUNCTION_NAME,
      correlation_id: correlationId,
      event,
      ...baseCtx,
      ...ctx,
    };
    const line = JSON.stringify(payload);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  };
  return {
    info: (event: string, ctx?: Record<string, unknown>) => emit('info', event, ctx),
    warn: (event: string, ctx?: Record<string, unknown>) => emit('warn', event, ctx),
    error: (event: string, ctx?: Record<string, unknown>) => emit('error', event, ctx),
    extend: (extra: Record<string, unknown>) => makeLogger(correlationId, { ...baseCtx, ...extra }),
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Correlation ID: honour inbound header if present, otherwise mint one.
  const correlationId =
    req.headers.get('x-correlation-id') ||
    req.headers.get('x-request-id') ||
    crypto.randomUUID();

  let log = makeLogger(correlationId);
  const startedAt = performance.now();
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify({ ...(body as object), correlation_id: correlationId }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-correlation-id': correlationId },
    });

  log.info('request_received', { method: req.method, url: req.url });

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
    let callerUserId: string | null = null;
    if (!isInternal) {
      if (!providedToken) {
        log.warn('auth_rejected', { reason: 'missing_bearer_token' });
        return respond({ success: false, error: 'Unauthorized' }, 401);
      }
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: userRes, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userRes?.user) {
        log.warn('auth_rejected', { reason: 'invalid_token', err: userErr?.message });
        return respond({ success: false, error: 'Unauthorized' }, 401);
      }
      callerUserId = userRes.user.id;
      const { data: isStaff } = await userClient.rpc('is_admin_or_employee');
      if (!isStaff) {
        log.warn('auth_rejected', { reason: 'not_staff', user_id: callerUserId });
        return respond({ success: false, error: 'Forbidden' }, 403);
      }
      log = log.extend({ caller_user_id: callerUserId, caller: 'staff' });
    } else {
      log = log.extend({ caller: 'service_role' });
    }
    log.info('auth_ok');

    const body = await req.json().catch(() => ({}));
    const { emailId } = body ?? {};

    if (!emailId) {
      log.error('validation_failed', { reason: 'missing_emailId' });
      return respond({ success: false, error: 'emailId is required' }, 400);
    }

    log = log.extend({ email_id: emailId });
    log.info('queue_fetch_start');

    // Get the email from queue
    const { data: email, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('id', emailId)
      .single();

    if (fetchError || !email) {
      log.error('queue_fetch_failed', { err: fetchError?.message });
      return respond({ success: false, error: 'Email not found: ' + (fetchError?.message || 'unknown') }, 404);
    }

    log = log.extend({
      email_type: email.email_type,
      recipient: email.recipient_email,
      related_table: email.related_table,
      related_record_id: email.related_record_id,
      queue_status: email.status,
    });
    log.info('queue_fetch_ok');

    // If already sent, skip
    if (email.status === 'sent') {
      log.info('skip_already_sent');
      return respond({ success: true, message: 'Already sent', messageId: null });
    }

    // Determine the "from" name — use custom from_name in metadata if available
    const customFromName = email.metadata?.from_name;
    const fromAddress = customFromName
      ? `${customFromName} <noreply@kamedico-legal.co.za>`
      : undefined; // will use default from sendEmail

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

    log.info('recipients_sanitized', {
      cc_count: sanitizedCc.length,
      cc_dropped_count: droppedCc.length,
      attachments_count: metadataAttachments.length,
      from_address: fromAddress ?? '(default)',
    });

    // Pre-send audit log: capture the EXACT sanitized recipients used for this send
    try {
      await supabase.from('audit_logs').insert({
        action_type: 'EMAIL_RECIPIENTS_SANITIZED',
        table_name: email.related_table || 'email_queue',
        record_id: email.related_record_id || emailId,
        function_area: 'Email History',
        description: `Sanitized recipients for queued email ${emailId} (${email.email_type})`,
        new_values: {
          correlation_id: correlationId,
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
    } catch (auditErr: any) {
      log.warn('audit_recipients_sanitized_failed', { err: auditErr?.message });
    }

    // Dedicated audit log: record CC addresses dropped by policy
    if (droppedCc.length > 0) {
      try {
        const emailRegex = /^[^\s<>@]+@[^\s<>@.]+\.[^\s<>@]+$/;
        const droppedDetails = droppedCc.map((addr) => {
          const reasons: string[] = [];
          if (/@kutlwanoassociate\.com$/i.test(addr)) reasons.push('blocked_domain_kutlwanoassociate');
          if (!emailRegex.test(addr)) reasons.push('invalid_format');
          if (reasons.length === 0) reasons.push('duplicate_or_filtered');
          return { address: addr, reasons };
        });

        await supabase.from('audit_logs').insert({
          action_type: 'EMAIL_CC_DROPPED_BY_POLICY',
          table_name: email.related_table || 'email_queue',
          record_id: email.related_record_id || emailId,
          function_area: 'Email History',
          description: `Dropped ${droppedCc.length} CC address(es) by policy for queued email ${emailId} (${email.email_type})`,
          new_values: {
            correlation_id: correlationId,
            email_id: emailId,
            email_type: email.email_type,
            subject: email.subject,
            to: email.recipient_email,
            cc_kept: sanitizedCc,
            cc_dropped: droppedCc,
            cc_dropped_count: droppedCc.length,
            cc_dropped_details: droppedDetails,
            cc_raw_input: rawCcInput,
          },
        });
        log.info('cc_dropped_logged', { dropped: droppedDetails });
      } catch (auditErr: any) {
        log.warn('audit_cc_dropped_failed', { err: auditErr?.message });
      }
    }

    // Send the email immediately via Resend
    log.info('send_start');
    const sendStart = performance.now();
    const emailResult = await sendEmail({
      to: email.recipient_email,
      subject: email.subject,
      html: email.html_content,
      replyTo: 'info@kamedico-legal.co.za',
      ...(fromAddress && { from: fromAddress }),
      ...(sanitizedCc.length > 0 && { cc: sanitizedCc }),
      ...(metadataAttachments.length > 0 && { attachments: metadataAttachments }),
    });
    const sendDurationMs = Math.round(performance.now() - sendStart);

    if (!emailResult.success) {
      log.error('send_failed', {
        provider_error: emailResult.error,
        send_duration_ms: sendDurationMs,
      });
      await supabase
        .from('email_queue')
        .update({
          status: 'failed',
          error_message: emailResult.error,
        })
        .eq('id', emailId);

      return respond({ success: false, error: emailResult.error }, 500);
    }

    log.info('send_ok', {
      message_id: emailResult.messageId,
      send_duration_ms: sendDurationMs,
    });

    // Update email status to sent
    await supabase
      .from('email_queue')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', emailId);

    // Log email sent
    try {
      await supabase.from('audit_logs').insert({
        action_type: 'EMAIL_AUTO_SENT',
        table_name: email.related_table || 'email_queue',
        record_id: email.related_record_id || emailId,
        function_area: 'Email History',
        description: `Auto-sent ${email.email_type} email to ${email.recipient_email}`,
        new_values: {
          correlation_id: correlationId,
          recipient: email.recipient_email,
          message_id: emailResult.messageId,
          email_type: email.email_type,
          send_duration_ms: sendDurationMs,
        },
      });
    } catch (auditErr: any) {
      log.warn('audit_auto_sent_failed', { err: auditErr?.message });
    }

    log.info('request_complete', {
      total_duration_ms: Math.round(performance.now() - startedAt),
      message_id: emailResult.messageId,
    });

    return respond({ success: true, messageId: emailResult.messageId });

  } catch (error: any) {
    log.error('unhandled_exception', {
      err: error?.message,
      stack: error?.stack,
      total_duration_ms: Math.round(performance.now() - startedAt),
    });
    return respond({ success: false, error: error.message }, 500);
  }
};

serve(withErrorHandler(handler));
