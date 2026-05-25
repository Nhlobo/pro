import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (v: unknown) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const isSalesConsultantRole = (position?: string | null, userType?: string | null) => {
  const raw = `${position || ""} ${userType || ""}`.toLowerCase();
  const compact = raw.replace(/[^a-z0-9]+/g, "");
  if (/\bnon\b/.test(raw) && /\bconsultants?\b/.test(raw)) return false;
  if (compact.includes("nonconsultant") || compact.includes("nonsalesconsultant")) return false;
  return /\bsales\b/.test(raw) && /\bconsultants?\b/.test(raw) || compact.includes("salesconsultant");
};

// SAST helpers
const sastToday = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Johannesburg" }));
const fmtDate = (d: Date) => d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
const isoDate = (d: Date) => {
  const yr = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, "0"), dy = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${dy}`;
};

function getWeeklyRange(ref: Date) {
  // Previous Monday–Sunday relative to ref
  const d = new Date(ref);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diffToMonday = ((day + 6) % 7); // days since Monday
  const thisMonday = new Date(d); thisMonday.setDate(d.getDate() - diffToMonday); thisMonday.setHours(0,0,0,0);
  const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday = new Date(thisMonday); lastSunday.setDate(thisMonday.getDate() - 1); lastSunday.setHours(23,59,59,999);
  return { start: lastMonday, end: lastSunday };
}
function getMonthlyRange(ref: Date) {
  // Whole current month (the cron runs on its last day)
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}
function isLastDayOfMonth(d: Date) {
  const t = new Date(d); t.setDate(t.getDate() + 1);
  return t.getMonth() !== d.getMonth();
}

function strikeRisk(strikes: number, deals: number, target: number, daysRemaining: number, periodType: string) {
  if (strikes >= 2) return "high";
  const ratio = target > 0 ? deals / target : 1;
  if (periodType === "monthly") {
    if (ratio >= 1) return "none";
    if (ratio < 0.3 && daysRemaining <= 5) return "high";
    if (ratio < 0.5) return strikes >= 1 ? "high" : "medium";
    if (ratio < 0.8) return "low";
    return "none";
  } else {
    if (ratio >= 1) return "none";
    if (ratio < 0.3) return strikes >= 1 ? "high" : "medium";
    if (ratio < 0.7) return "low";
    return "none";
  }
}

function autoComment(periodType: string, deals: number, target: number, risk: string, isSales: boolean) {
  const targetWord = isSales ? "sales consultant" : "non-sales consultant";
  if (periodType === "weekly") {
    if (deals >= target) {
      return `Excellent execution this week — you closed ${deals} of ${target} scheduled assessments. Expectation for the new week: maintain consistency, secure ${target}+ deals again, and prioritise quality bookings that progress to assessment.`;
    }
    const gap = target - deals;
    if (risk === "high") {
      return `Urgent attention required. You closed ${deals} of ${target} this week. Next week's expectation: book at least ${target + Math.max(1, gap)} qualifying assessments to recover ground and avoid a strike at month-end. Focus on follow-ups from your warm pipeline and re-pitch dormant attorneys.`;
    }
    if (risk === "medium") {
      return `Behind pace. You closed ${deals} of ${target}. Next week's expectation: reach ${target + gap} deals to close the gap. Add 5 extra outreach touches per day and convert at least 2 interested attorneys to bookings.`;
    }
    if (risk === "low") {
      return `Slightly below target (${deals}/${target}). Next week's expectation: hit the full ${target} deals consistently and convert one more pipeline opportunity to lock the month.`;
    }
    return `Steady week (${deals}/${target}). Keep your weekly target at ${target} and aim for one stretch deal to build buffer.`;
  } else {
    const requiredMonthly = target;
    if (deals >= requiredMonthly) {
      return `Outstanding month — ${deals} qualifying deals against your ${requiredMonthly} target. Expectation for the new month as a ${targetWord}: replicate this performance, target ${requiredMonthly}+ deals in the 24th–25th window, and grow your attributed referring attorney base by 2.`;
    }
    if (risk === "high") {
      return `Critical: ${deals}/${requiredMonthly} deals. A strike has been or will be issued this cycle. Expectation for the new month: deliver a minimum of ${requiredMonthly} qualifying scheduled assessments. Re-engage every pitched attorney from last month, prioritise re-pitch with promos, and submit a daily activity plan to your manager.`;
    }
    if (risk === "medium") {
      return `Below target (${deals}/${requiredMonthly}). Expectation for the new month: ${requiredMonthly} qualifying deals minimum. Front-load week 1 with intensive outreach, secure 2 deals per week, and convert interested attorneys promptly.`;
    }
    return `Close to target (${deals}/${requiredMonthly}). Expectation for the new month: clear ${requiredMonthly} deals and aim for one stretch deal to build commission buffer.`;
  }
}

function congratulationsFor(deals: number, target: number, isSales: boolean) {
  if (target === 0 || deals < target) return null;
  const role = isSales ? "Sales Consultant" : "Non-Sales Consultant";
  if (deals >= target * 1.5) {
    return `🏆 Outstanding performance, ${role}! You exceeded your target by ${Math.round(((deals - target) / target) * 100)}%. Thank you for the dedication and results — you set the benchmark for the team.`;
  }
  return `🎯 Target achieved, ${role}! ${deals} of ${target} deals closed. Thank you for delivering — keep the momentum going.`;
}

function buildHtml(opts: {
  consultantName: string;
  firstName: string;
  periodType: string;
  periodStart: Date;
  periodEnd: Date;
  deals: number;
  target: number;
  targetMet: boolean;
  strikes: number;
  risk: string;
  comment: string;
  congrats: string | null;
  previousDeals?: number;
  weeklyBreakdown?: Array<{ start: Date; end: Date; deals: number; target: number }>;
}) {
  const riskColours: Record<string, { bg: string; fg: string; label: string }> = {
    none:   { bg: "#dcfce7", fg: "#166534", label: "On Track" },
    low:    { bg: "#fef3c7", fg: "#854d0e", label: "Low Risk" },
    medium: { bg: "#fed7aa", fg: "#9a3412", label: "Medium Risk — Warning" },
    high:   { bg: "#fecaca", fg: "#991b1b", label: "High Risk — Strike Likely" },
  };
  const r = riskColours[opts.risk] || riskColours.none;
  const periodLabel = opts.periodType === "weekly" ? "Weekly" : "Monthly";
  const dateRange = `${fmtDate(opts.periodStart)} – ${fmtDate(opts.periodEnd)}`;
  const pct = opts.target > 0 ? Math.min(100, Math.round((opts.deals / opts.target) * 100)) : 0;

  const weeklyRows = (opts.weeklyBreakdown || []).map((w, i) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">Week ${i + 1}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${fmtDate(w.start)} – ${fmtDate(w.end)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${w.deals}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:${w.deals >= w.target ? "#166534" : "#9a3412"};font-weight:600;">${w.deals >= w.target ? "✓" : "✗"}</td>
    </tr>`).join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#1f2937;background:#ffffff;">
    <div style="background:#0f766e;color:#ffffff;padding:24px;text-align:center;">
      <h1 style="margin:0;font-size:22px;font-weight:700;">Medico-Legal Pro</h1>
      <p style="margin:6px 0 0;font-size:14px;opacity:0.9;">${periodLabel} Sales Performance Report</p>
    </div>

    <div style="padding:24px;">
      <p style="margin:0 0 6px;font-size:15px;">Hi <strong>${escapeHtml(opts.firstName || opts.consultantName)}</strong>,</p>
      <p style="margin:0 0 18px;color:#4b5563;font-size:14px;">Here is your personal ${opts.periodType} performance summary for <strong>${escapeHtml(dateRange)}</strong>.</p>

      ${opts.congrats ? `
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:14px 16px;margin-bottom:18px;">
        <p style="margin:0;color:#065f46;font-size:14px;font-weight:600;">${escapeHtml(opts.congrats)}</p>
      </div>` : ""}

      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:18px;">
        <tr>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;width:33%;text-align:center;">
            <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Deals Closed</p>
            <p style="margin:6px 0 0;font-size:28px;font-weight:700;color:#0f766e;">${opts.deals}</p>
          </td>
          <td style="width:8px;"></td>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;width:33%;text-align:center;">
            <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Target</p>
            <p style="margin:6px 0 0;font-size:28px;font-weight:700;color:#1f2937;">${opts.target}</p>
          </td>
          <td style="width:8px;"></td>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;width:33%;text-align:center;">
            <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Achievement</p>
            <p style="margin:6px 0 0;font-size:28px;font-weight:700;color:${opts.targetMet ? "#166534" : "#9a3412"};">${pct}%</p>
          </td>
        </tr>
      </table>

      <div style="margin-bottom:18px;">
        <div style="height:10px;background:#e5e7eb;border-radius:6px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${opts.targetMet ? "#16a34a" : pct >= 50 ? "#f59e0b" : "#dc2626"};"></div>
        </div>
      </div>

      <div style="background:${r.bg};border-radius:8px;padding:14px 16px;margin-bottom:18px;">
        <p style="margin:0;font-size:13px;font-weight:700;color:${r.fg};">Strike Status: ${escapeHtml(r.label)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:${r.fg};">Current active strikes: <strong>${opts.strikes}/3</strong>${opts.previousDeals !== undefined ? ` &nbsp;•&nbsp; Previous period: <strong>${opts.previousDeals}</strong> deals` : ""}</p>
      </div>

      ${opts.weeklyBreakdown && opts.weeklyBreakdown.length ? `
      <h3 style="margin:0 0 8px;font-size:14px;color:#0f172a;">Weekly Breakdown</h3>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px 10px;text-align:left;font-weight:600;">Week</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;">Range</th>
            <th style="padding:8px 10px;text-align:right;font-weight:600;">Deals</th>
            <th style="padding:8px 10px;text-align:right;font-weight:600;">Met</th>
          </tr>
        </thead>
        <tbody>${weeklyRows}</tbody>
      </table>` : ""}

      <h3 style="margin:0 0 8px;font-size:14px;color:#0f172a;">Manager's Note &amp; Expectations</h3>
      <div style="background:#f8fafc;border-left:4px solid #0f766e;padding:12px 14px;border-radius:4px;margin-bottom:18px;">
        <p style="margin:0;font-size:13px;color:#1f2937;line-height:1.6;">${escapeHtml(opts.comment)}</p>
      </div>

      <p style="margin:18px 0 0;font-size:12px;color:#6b7280;">This is an automated performance report. For queries, contact your Sales Manager.</p>
    </div>

    <div style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:14px;text-align:center;color:#6b7280;font-size:11px;">
      © ${new Date().getFullYear()} Medico-Legal Pro &nbsp;•&nbsp; Sales Performance &nbsp;•&nbsp; Generated ${fmtDate(sastToday())}
    </div>
  </div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const { period_type = "weekly", preview = false, consultant_id, only_if_month_end = false, sample_to } = body;

    if (!["weekly", "monthly"].includes(period_type)) {
      return new Response(JSON.stringify({ error: "period_type must be weekly or monthly" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const today = sastToday();
    if (period_type === "monthly" && only_if_month_end && !isLastDayOfMonth(today)) {
      return new Response(JSON.stringify({ skipped: true, reason: "not last day of month" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { start, end } = period_type === "weekly" ? getWeeklyRange(today) : getMonthlyRange(today);

    // Load consultants
    let consultantsQuery = supabase.from("sales_consultants").select("id, name, user_id, type, is_active").eq("is_active", true);
    if (consultant_id) consultantsQuery = consultantsQuery.eq("id", consultant_id);
    const { data: consultants, error: cErr } = await consultantsQuery;
    if (cErr) throw cErr;

    const results: any[] = [];

    for (const c of consultants || []) {
      // Profile lookup
      let email: string | null = null;
      let position: string | null = null;
      let userType: string | null = null;
      let firstName = (c.name || "").split(" ")[0];
      if (c.user_id) {
        const { data: p } = await supabase.from("profiles").select("email, first_name, position, user_type").eq("id", c.user_id).maybeSingle();
        email = p?.email || null;
        position = p?.position || null;
        userType = p?.user_type || null;
        if (p?.first_name) firstName = p.first_name;
        if (!email) {
          const { data: au } = await supabase.auth.admin.getUserById(c.user_id);
          email = au?.user?.email || null;
        }
      }

      const isSales = isSalesConsultantRole(position, userType);
      const monthlyTarget = isSales ? 7 : 2;
      const weeklyTarget = Math.max(1, Math.ceil(monthlyTarget / 4));
      const target = period_type === "weekly" ? weeklyTarget : monthlyTarget;

      // Deals: appointments attributed to this consultant in the period
      const { data: apps } = await supabase
        .from("appointments")
        .select("id, appointment_date")
        .is("deleted_at", null)
        .eq("sales_consultant_id", c.id)
        .gte("appointment_date", start.toISOString())
        .lte("appointment_date", end.toISOString());
      const deals = (apps || []).length;
      const targetMet = deals >= target;

      // Active strikes
      const { data: strikes } = await supabase
        .from("consultant_strikes")
        .select("id, expired")
        .eq("consultant_id", c.id)
        .eq("expired", false);
      const strikeCount = (strikes || []).length;

      // Previous period deals
      const prevStart = new Date(start); const prevEnd = new Date(end);
      const span = end.getTime() - start.getTime();
      prevStart.setTime(start.getTime() - span - 1);
      prevEnd.setTime(start.getTime() - 1);
      const { data: prevApps } = await supabase
        .from("appointments")
        .select("id")
        .is("deleted_at", null)
        .eq("sales_consultant_id", c.id)
        .gte("appointment_date", prevStart.toISOString())
        .lte("appointment_date", prevEnd.toISOString());
      const prevDeals = (prevApps || []).length;

      // Weekly breakdown for monthly reports
      let weeklyBreakdown: any[] | undefined;
      if (period_type === "monthly") {
        weeklyBreakdown = [];
        const ws = new Date(start);
        let idx = 0;
        while (ws <= end && idx < 6) {
          const we = new Date(ws); we.setDate(ws.getDate() + 6); we.setHours(23,59,59,999);
          if (we > end) we.setTime(end.getTime());
          const { data: wApps } = await supabase
            .from("appointments")
            .select("id")
            .is("deleted_at", null)
            .eq("sales_consultant_id", c.id)
            .gte("appointment_date", ws.toISOString())
            .lte("appointment_date", we.toISOString());
          weeklyBreakdown.push({ start: new Date(ws), end: new Date(we), deals: (wApps || []).length, target: weeklyTarget });
          ws.setDate(ws.getDate() + 7);
          idx++;
        }
      }

      const daysRemaining = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000));
      const risk = strikeRisk(strikeCount, deals, target, daysRemaining, period_type);
      const comment = autoComment(period_type, deals, target, risk, isSales);
      const congrats = congratulationsFor(deals, target, isSales);

      const html = buildHtml({
        consultantName: c.name,
        firstName,
        periodType: period_type,
        periodStart: start,
        periodEnd: end,
        deals, target, targetMet,
        strikes: strikeCount,
        risk, comment, congrats,
        previousDeals: prevDeals,
        weeklyBreakdown,
      });

      let deliveryStatus = "pending";
      let deliveryError: string | null = null;
      let sentAt: string | null = null;

      if (!preview) {
        if (!email) {
          deliveryStatus = "skipped";
          deliveryError = "No email on file";
        } else {
          const subject = `${period_type === "weekly" ? "Weekly" : "Monthly"} Performance Report — ${fmtDate(start)} to ${fmtDate(end)}`;
          const res = await sendEmail({
            from: "Medico-Legal Pro <noreply@kamedico-legal.co.za>",
            to: [email],
            subject,
            html,
          });
          if (res.success) {
            deliveryStatus = "sent";
            sentAt = new Date().toISOString();
          } else {
            deliveryStatus = "failed";
            deliveryError = res.error || "Unknown send failure";
          }
        }

        await supabase.from("sales_performance_reports").insert({
          consultant_id: c.id,
          user_id: c.user_id,
          consultant_name: c.name,
          email,
          period_type,
          period_start: isoDate(start),
          period_end: isoDate(end),
          deals_closed: deals,
          target,
          target_met: targetMet,
          strike_risk_level: risk,
          current_strikes: strikeCount,
          auto_comment: comment,
          congratulations: congrats,
          report_html: html,
          delivery_status: deliveryStatus,
          delivery_error: deliveryError,
          sent_at: sentAt,
        });
      }

      results.push({
        consultant_id: c.id, consultant_name: c.name, email, deals, target, targetMet,
        risk, strikes: strikeCount, deliveryStatus, html: preview ? html : undefined,
        comment, congrats,
      });
    }

    return new Response(JSON.stringify({ success: true, period: { type: period_type, start: isoDate(start), end: isoDate(end) }, count: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-sales-performance-report error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
