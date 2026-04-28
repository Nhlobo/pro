import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { consultantId, managerEmail } = body;

    const escapeHtml = (value: unknown) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const sendWarning = async (warning: {
      consultantId: string;
      consultantName: string;
      userId?: string | null;
      userEmail?: string | null;
      currentAppts: number;
      strikeCount: number;
      strikeType: string;
      existingStrikes?: any[];
      payoutMonth?: number;
      payoutYear?: number;
    }) => {
      let resolvedEmail = warning.userEmail || null;

      if (!resolvedEmail && warning.userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', warning.userId)
          .maybeSingle();
        resolvedEmail = profile?.email || null;
      }

      if (!resolvedEmail && warning.userId) {
        const { data: authUser } = await supabase.auth.admin.getUserById(warning.userId);
        resolvedEmail = authUser?.user?.email || null;
      }

      if (warning.userId) {
        await supabase.from('notifications').insert({
          user_id: warning.userId,
          title: 'Performance Warning',
          message: `Your qualifying deals (${warning.currentAppts}) are below the target of 6 for the 25th–24th payout period. A ${warning.strikeType} warning has been issued.`,
          type: 'warning',
          category: 'performance',
        });
      }

      const strikeInfo = (warning.existingStrikes || []).map((s: any) =>
        `• ${s.type} warning — issued ${s.issued_date}, expires ${s.expiry_date}`
      ).join('\n');
      const nextConsequence = warning.strikeCount === 1 ? 'Written Warning' : warning.strikeCount === 2 ? 'Dismissal' : 'Final';
      const payoutLabel = warning.payoutMonth && warning.payoutYear
        ? ` for ${new Date(warning.payoutYear, warning.payoutMonth - 1).toLocaleString('en-ZA', { month: 'long', year: 'numeric' })}`
        : '';

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
          <div style="background: #0f766e; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 22px;">Performance Warning Notice</h1>
          </div>
          <div style="padding: 20px;">
            <p>Dear ${escapeHtml(warning.consultantName)},</p>
            <p>Your qualifying closed deals${escapeHtml(payoutLabel)} are <strong>${warning.currentAppts}</strong>, below the required target of <strong>6 deals</strong>.</p>
            <p>The commission/strike period runs from the <strong>25th to the 24th</strong> of each payout month.</p>
            <p>A <strong>${escapeHtml(warning.strikeType)} warning</strong> has been issued (Strike ${warning.strikeCount}/3).</p>
            ${strikeInfo ? `<p><strong>Current Strike Record:</strong></p><pre style="white-space: pre-wrap; background: #f3f4f6; padding: 12px; border-radius: 6px;">${escapeHtml(strikeInfo)}</pre>` : ''}
            <p><strong>Next consequence if target is not met:</strong> ${escapeHtml(nextConsequence)}</p>
            <p>Please take immediate steps to improve your performance.</p>
          </div>
        </div>
      `;

      const recipients = [resolvedEmail].filter(Boolean) as string[];
      if (managerEmail) recipients.push(managerEmail);

      if (recipients.length === 0) {
        console.warn(`No user email found for consultant ${warning.consultantId}`);
        return { sent: false, email: null };
      }

      const result = await sendEmail({
        from: "Medico-Legal Pro <noreply@kamedico-legal.co.za>",
        to: recipients,
        subject: `Performance Warning: ${warning.consultantName} — Strike ${warning.strikeCount}/3`,
        html: emailHtml,
      });

      if (!result.success) throw new Error(result.error || 'Failed to send warning email');
      return { sent: true, email: resolvedEmail };
    };

    if (consultantId) {
      return new Response(JSON.stringify({ error: "Manual warning sends are disabled; strikes are issued by the monthly 25th process." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    {
      const { data: warnings, error } = await supabase.rpc('issue_monthly_sales_strikes', {
        p_run_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' }),
      });

      if (error) throw error;

      const sent = [];
      for (const warning of warnings || []) {
        if (!warning.issued) continue;
        sent.push(await sendWarning({
          consultantId: warning.consultant_id,
          consultantName: warning.consultant_name,
          userId: warning.user_id,
          userEmail: warning.user_email,
          currentAppts: Number(warning.current_appts || 0),
          strikeCount: Number(warning.strike_count || 1),
          strikeType: warning.strike_type,
          payoutMonth: warning.payout_month,
          payoutYear: warning.payout_year,
        }));
      }

      return new Response(JSON.stringify({ success: true, issued: sent.length, sent }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  } catch (error: any) {
    console.error("Performance warning error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
