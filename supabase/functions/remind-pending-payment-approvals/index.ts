import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APPROVER_EMAIL = Deno.env.get('PAYMENT_APPROVER_EMAIL') || 'boshomane@kutlwanoassociate.com';
// Configurable via env vars or system_settings table (key: payment_approval_reminders)
const ENV_REMINDER_AFTER_HOURS = Number(Deno.env.get('PAYMENT_REMINDER_AFTER_HOURS')) || 48;
const ENV_REPEAT_REMINDER_EVERY_HOURS = Number(Deno.env.get('PAYMENT_REPEAT_REMINDER_EVERY_HOURS')) || 24;

const ZAR = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(Number(n) || 0);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Load overrides from system_settings if present
    let REMINDER_AFTER_HOURS = ENV_REMINDER_AFTER_HOURS;
    let REPEAT_REMINDER_EVERY_HOURS = ENV_REPEAT_REMINDER_EVERY_HOURS;
    try {
      const { data: setting } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'payment_approval_reminders')
        .maybeSingle();
      const v: any = setting?.setting_value || {};
      if (Number(v.reminder_after_hours) > 0) REMINDER_AFTER_HOURS = Number(v.reminder_after_hours);
      if (Number(v.repeat_reminder_every_hours) > 0) REPEAT_REMINDER_EVERY_HOURS = Number(v.repeat_reminder_every_hours);
    } catch (e) {
      console.warn('Could not load system_settings overrides:', e);
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - REMINDER_AFTER_HOURS * 3600 * 1000).toISOString();

    const { data: pending, error } = await supabase
      .from('expert_payment_planner_snapshots')
      .select('id, label, submitted_for_approval_at, submitted_by, totals, last_reminder_sent_at, reminder_count')
      .eq('approval_status', 'pending')
      .not('submitted_for_approval_at', 'is', null)
      .lte('submitted_for_approval_at', cutoff)
      .order('submitted_for_approval_at', { ascending: true })
      .limit(50);

    if (error) throw error;

    // Collect admin recipient emails once
    const adminEmails = new Set<string>([APPROVER_EMAIL]);
    try {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
      const ids = (roles || []).map((r: any) => r.user_id).filter(Boolean);
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('email').in('id', ids);
        (profs || []).forEach((p: any) => {
          if (p?.email) adminEmails.add(String(p.email).trim().toLowerCase());
        });
      }
    } catch (e) {
      console.warn('Could not resolve admin emails:', e);
    }

    const recipients = Array.from(adminEmails);
    const results: any[] = [];

    for (const snap of pending || []) {
      // Throttle: skip if we sent a reminder within the repeat window
      if (snap.last_reminder_sent_at) {
        const sinceLast = (now.getTime() - new Date(snap.last_reminder_sent_at).getTime()) / 3600 / 1000;
        if (sinceLast < REPEAT_REMINDER_EVERY_HOURS) {
          results.push({ id: snap.id, skipped: 'recently_reminded' });
          continue;
        }
      }

      const submittedAt = new Date(snap.submitted_for_approval_at as string);
      const hoursPending = Math.floor((now.getTime() - submittedAt.getTime()) / 3600 / 1000);
      const totals: any = snap.totals || {};
      const subject = `⏰ Approval overdue (${hoursPending}h) — ${snap.label}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg,#d97706 0%,#b45309 100%); color:#fff; padding:18px 20px; border-radius:8px; margin-bottom:20px;">
            <h2 style="margin:0;font-size:16px;">PAYMENT APPROVAL OVERDUE</h2>
            <p style="margin:4px 0 0;font-size:11px;">Pending more than ${REMINDER_AFTER_HOURS} hours</p>
          </div>
          <p style="color:#374151;font-size:13px;">A payment plan submitted by <strong>${snap.submitted_by ?? 'a user'}</strong> has been awaiting your approval for <strong>${hoursPending} hour(s)</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;color:#111827;">
            <tr><td style="padding:6px 0;color:#6b7280;">Plan</td><td><strong>${snap.label}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Submitted</td><td>${submittedAt.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Items</td><td>${totals?.rows ?? '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">To be paid</td><td>${ZAR(totals?.plannedAmount ?? 0)}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Urgent</td><td>${ZAR(totals?.urgentAmount ?? 0)}</td></tr>
          </table>
          <p style="color:#374151;font-size:13px;">Please open <strong>Expert Payment Planner → Approval Requests</strong> to review and action this submission.</p>
          <p style="color:#9ca3af;font-size:11px;margin-top:24px;">Automated reminder — you will be reminded again every ${REPEAT_REMINDER_EVERY_HOURS}h until actioned.</p>
        </div>`;

      const result = await sendEmail({ to: recipients, subject, html });

      if (result.success) {
        await supabase
          .from('expert_payment_planner_snapshots')
          .update({
            last_reminder_sent_at: now.toISOString(),
            reminder_count: (snap.reminder_count ?? 0) + 1,
          })
          .eq('id', snap.id);

        // In-app notification to all admins
        try {
          const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
          const ids = (roles || []).map((r: any) => r.user_id).filter(Boolean);
          if (ids.length) {
            await supabase.from('notifications').insert(
              ids.map((uid: string) => ({
                user_id: uid,
                title: 'Payment approval overdue',
                message: `"${snap.label}" has been pending approval for ${hoursPending} hours.`,
                type: 'warning',
                category: 'payment',
                related_record_id: snap.id,
                related_table: 'expert_payment_planner_snapshots',
                is_read: false,
                email_sent: true,
              })),
            );
          }
        } catch (e) {
          console.warn('In-app reminder insert failed:', e);
        }
      }

      results.push({ id: snap.id, hoursPending, emailed: result.success, error: result.error });
    }

    return new Response(
      JSON.stringify({ success: true, checked: pending?.length ?? 0, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('remind-pending-payment-approvals failed:', err);
    return new Response(JSON.stringify({ success: false, error: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
