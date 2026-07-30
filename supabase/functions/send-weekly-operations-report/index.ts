import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@4.0.0";

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}
interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Self-contained email sender (inlined so this file has zero relative imports
// and can be pasted directly into the Supabase Dashboard function editor).
async function sendEmail(options: EmailOptions): Promise<EmailResponse> {
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("Missing Resend API key");
      return { success: false, error: "Resend API key is not configured" };
    }
    const resend = new Resend(resendApiKey);
    const fromEmail = options.from || "Kutlwano & Associate <noreply@kamedico-legal.co.za>";
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: recipients,
      subject: options.subject,
      html: options.html,
      reply_to: "info@kamedico-legal.co.za",
      headers: {
        "List-Unsubscribe": `<mailto:info@kamedico-legal.co.za?subject=Unsubscribe>`,
        "X-Entity-Ref-ID": crypto.randomUUID(),
      },
    });

    if (error) {
      console.error("Resend API error:", error);
      return { success: false, error: `Resend API error: ${error.message}` };
    }

    return { success: true, messageId: data?.id || "" };
  } catch (error: any) {
    console.error("Resend email error:", error);
    return { success: false, error: error.message || "Failed to send email via Resend" };
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (v: unknown) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const ZAR = (n: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(n) || 0);

// SAST helpers (kept identical to send-sales-performance-report for consistency)
const sastToday = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Johannesburg" }));
const fmtDate = (d: Date) => d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
const fmtDateTime = (d: Date) => d.toLocaleString("en-ZA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const isoDate = (d: Date) => {
  const yr = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, "0"), dy = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${dy}`;
};

function getWeeklyRange(ref: Date) {
  // Previous Monday–Sunday relative to ref
  const d = new Date(ref);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diffToMonday = ((day + 6) % 7); // days since Monday
  const thisMonday = new Date(d); thisMonday.setDate(d.getDate() - diffToMonday); thisMonday.setHours(0, 0, 0, 0);
  const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday = new Date(thisMonday); lastSunday.setDate(thisMonday.getDate() - 1); lastSunday.setHours(23, 59, 59, 999);
  return { start: lastMonday, end: lastSunday };
}

function getMonthlyRange(ref: Date) {
  // Previous calendar month relative to ref
  const start = new Date(ref.getFullYear(), ref.getMonth() - 1, 1, 0, 0, 0, 0);
  const end = new Date(ref.getFullYear(), ref.getMonth(), 0, 23, 59, 59, 999);
  return { start, end };
}

function getQuarterlyRange(ref: Date) {
  // Previous calendar quarter relative to ref
  const currentQuarter = Math.floor(ref.getMonth() / 3);
  const start = new Date(ref.getFullYear(), (currentQuarter - 1) * 3, 1, 0, 0, 0, 0);
  const end = new Date(ref.getFullYear(), currentQuarter * 3, 0, 23, 59, 59, 999);
  return { start, end };
}

function getYearlyRange(ref: Date) {
  // Previous calendar year relative to ref
  const start = new Date(ref.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
  const end = new Date(ref.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
  return { start, end };
}

type PeriodType = "weekly" | "monthly" | "quarterly" | "yearly";

function getRangeForPeriod(periodType: PeriodType, ref: Date) {
  switch (periodType) {
    case "monthly": return getMonthlyRange(ref);
    case "quarterly": return getQuarterlyRange(ref);
    case "yearly": return getYearlyRange(ref);
    case "weekly":
    default: return getWeeklyRange(ref);
  }
}

// Used by the daily cron ticks below to gate monthly/quarterly/yearly sends —
// those crons fire every day and only actually generate a report on the last
// day of the relevant period (mirrors the pattern in send-sales-performance-report).
function isLastDayOfMonth(d: Date) {
  const t = new Date(d); t.setDate(t.getDate() + 1);
  return t.getMonth() !== d.getMonth();
}
function isLastDayOfQuarter(d: Date) {
  return isLastDayOfMonth(d) && [2, 5, 8, 11].includes(d.getMonth());
}
function isLastDayOfYear(d: Date) {
  return d.getMonth() === 11 && d.getDate() === 31;
}

interface PaymentRow {
  id: string;
  payment_date: string;
  payment_amount: number;
  payment_notes: string | null;
  expert_name: string;
  claimant_name: string;
}

interface BookingRow {
  id: string;
  created_at: string;
  appointment_date: string;
  claimant_name: string;
  expert_name: string;
  referring_attorney: string;
  case_status: string;
  service_fee: number | null;
}

function buildHtml(opts: {
  periodStart: Date;
  periodEnd: Date;
  payments: PaymentRow[];
  paymentsTotal: number;
  bookings: BookingRow[];
}) {
  const dateRange = `${fmtDate(opts.periodStart)} – ${fmtDate(opts.periodEnd)}`;

  const paymentRows = opts.payments.map(p => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(fmtDate(new Date(p.payment_date)))}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(p.expert_name)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(p.claimant_name)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#0f766e;">${escapeHtml(ZAR(p.payment_amount))}</td>
    </tr>`).join("");

  const bookingRows = opts.bookings.map(b => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(fmtDate(new Date(b.created_at)))}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(b.claimant_name)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(b.expert_name)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(b.referring_attorney)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(fmtDate(new Date(b.appointment_date)))}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-transform:capitalize;">${escapeHtml(b.case_status)}</td>
    </tr>`).join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#1f2937;background:#ffffff;">
    <div style="background-color:#12a99a;background-image:linear-gradient(135deg,#0a95eb,#18bfa0);color:#ffffff;padding:22px 24px;text-align:center;">
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 10px;border-collapse:collapse;">
        <tr>
          <td style="text-align:center;vertical-align:middle;">
            <img src="https://kamedico-legal.lovable.app/lovable-uploads/7401e32a-2457-4a00-9d60-c1ff9fcfc4fc.png" width="40" height="40" alt="Kutlwano &amp; Associate" style="display:block;width:40px;height:40px;object-fit:contain;border:0;outline:none;" />
          </td>
        </tr>
      </table>
      <h1 style="margin:0;font-size:20px;font-weight:700;letter-spacing:0.01em;">Medico-Legal Pro</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#ffffff;opacity:0.9;">Weekly Operations Summary Report</p>
    </div>

    <div style="padding:24px;">
      <p style="margin:0 0 18px;color:#4b5563;font-size:14px;">Automated summary for <strong>${escapeHtml(dateRange)}</strong>, covering expert payments made and assessments booked this week. This report is retained for record-keeping and audit trail purposes.</p>

      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:22px;">
        <tr>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;width:33%;text-align:center;">
            <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Payments Made</p>
            <p style="margin:6px 0 0;font-size:26px;font-weight:700;color:#0f766e;">${opts.payments.length}</p>
          </td>
          <td style="width:8px;"></td>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;width:33%;text-align:center;">
            <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Total Paid</p>
            <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#0f172a;">${escapeHtml(ZAR(opts.paymentsTotal))}</p>
          </td>
          <td style="width:8px;"></td>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;width:33%;text-align:center;">
            <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Assessments Booked</p>
            <p style="margin:6px 0 0;font-size:26px;font-weight:700;color:#0f172a;">${opts.bookings.length}</p>
          </td>
        </tr>
      </table>

      <h3 style="margin:0 0 8px;font-size:14px;color:#0f172a;">Payments Made to Experts</h3>
      ${opts.payments.length ? `
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:22px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px 10px;text-align:left;font-weight:600;">Date</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;">Expert</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;">Claimant</th>
            <th style="padding:8px 10px;text-align:right;font-weight:600;">Amount</th>
          </tr>
        </thead>
        <tbody>${paymentRows}</tbody>
      </table>` : `<p style="margin:0 0 22px;font-size:13px;color:#6b7280;font-style:italic;">No expert payments were recorded this week.</p>`}

      <h3 style="margin:0 0 8px;font-size:14px;color:#0f172a;">Assessments Booked</h3>
      ${opts.bookings.length ? `
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:10px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px 10px;text-align:left;font-weight:600;">Booked On</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;">Claimant</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;">Expert</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;">Referring Attorney</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;">Assessment Date</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600;">Status</th>
          </tr>
        </thead>
        <tbody>${bookingRows}</tbody>
      </table>` : `<p style="margin:0 0 10px;font-size:13px;color:#6b7280;font-style:italic;">No new assessments were booked this week.</p>`}

      <p style="margin:18px 0 0;font-size:12px;color:#6b7280;">This is an automated weekly report generated for record-keeping. For queries, contact your System Administrator.</p>
    </div>

    <div style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:14px;text-align:center;color:#6b7280;font-size:11px;">
      © ${new Date().getFullYear()} Medico-Legal Pro &nbsp;•&nbsp; Weekly Operations Summary &nbsp;•&nbsp; Generated ${fmtDateTime(sastToday())}
    </div>
  </div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const { preview = false, generated_by = null } = body;

    const VALID_PERIOD_TYPES = ["weekly", "monthly", "quarterly", "yearly"] as const;
    if (body.period_type !== undefined && !VALID_PERIOD_TYPES.includes(body.period_type)) {
      return new Response(
        JSON.stringify({ error: `Invalid period_type "${body.period_type}". Must be one of: ${VALID_PERIOD_TYPES.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const periodType: PeriodType = body.period_type ?? "weekly";
    const { only_if_month_end = false, only_if_quarter_end = false, only_if_year_end = false } = body;

    const today = sastToday();

    // Daily cron ticks for monthly/quarterly/yearly call in every day and only
    // actually generate the report once the period has genuinely closed —
    // this is a no-op response the rest of the day, not an error.
    if (periodType === "monthly" && only_if_month_end && !isLastDayOfMonth(today)) {
      return new Response(JSON.stringify({ skipped: true, reason: "not last day of month" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (periodType === "quarterly" && only_if_quarter_end && !isLastDayOfQuarter(today)) {
      return new Response(JSON.stringify({ skipped: true, reason: "not last day of quarter" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (periodType === "yearly" && only_if_year_end && !isLastDayOfYear(today)) {
      return new Response(JSON.stringify({ skipped: true, reason: "not last day of year" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { start, end } = getRangeForPeriod(periodType, today);

    // ---- Payments made to experts this week ----
    const { data: paymentsRaw, error: payErr } = await supabase
      .from("expert_payments")
      .select("id, payment_date, payment_amount, payment_notes, expert_id, appointment_id")
      .gte("payment_date", start.toISOString())
      .lte("payment_date", end.toISOString())
      .order("payment_date", { ascending: true });
    if (payErr) throw payErr;

    const expertIds = Array.from(new Set((paymentsRaw || []).map((p: any) => p.expert_id).filter(Boolean)));
    const appointmentIds = Array.from(new Set((paymentsRaw || []).map((p: any) => p.appointment_id).filter(Boolean)));

    const { data: expertsForPayments } = expertIds.length
      ? await supabase.from("medical_experts").select("id, first_name, last_name").in("id", expertIds)
      : { data: [] as any[] };
    const { data: appointmentsForPayments } = appointmentIds.length
      ? await supabase.from("appointments").select("id, claimant_id").in("id", appointmentIds)
      : { data: [] as any[] };

    const claimantIdsFromPayments = Array.from(new Set((appointmentsForPayments || []).map((a: any) => a.claimant_id).filter(Boolean)));
    const { data: claimantsForPayments } = claimantIdsFromPayments.length
      ? await supabase.from("claimants").select("id, first_name, last_name").in("id", claimantIdsFromPayments)
      : { data: [] as any[] };

    const expertNameById = new Map((expertsForPayments || []).map((e: any) => [e.id, `${e.first_name || ""} ${e.last_name || ""}`.trim()]));
    const appointmentClaimantById = new Map((appointmentsForPayments || []).map((a: any) => [a.id, a.claimant_id]));
    const claimantNameById = new Map((claimantsForPayments || []).map((c: any) => [c.id, `${c.first_name || ""} ${c.last_name || ""}`.trim()]));

    const payments: PaymentRow[] = (paymentsRaw || []).map((p: any) => {
      const claimantId = appointmentClaimantById.get(p.appointment_id);
      return {
        id: p.id,
        payment_date: p.payment_date,
        payment_amount: Number(p.payment_amount) || 0,
        payment_notes: p.payment_notes,
        expert_name: expertNameById.get(p.expert_id) || "Unknown Expert",
        claimant_name: claimantNameById.get(claimantId) || "Unknown Claimant",
      };
    });
    const paymentsTotal = payments.reduce((s, p) => s + p.payment_amount, 0);

    // ---- Assessments booked this week (new appointments created in the period) ----
    const { data: bookingsRaw, error: bookErr } = await supabase
      .from("appointments")
      .select("id, created_at, appointment_date, claimant_id, expert_id, referring_attorney, referring_attorney_id, case_status, service_fee")
      .is("deleted_at", null)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: true });
    if (bookErr) throw bookErr;

    const bookingExpertIds = Array.from(new Set((bookingsRaw || []).map((b: any) => b.expert_id).filter(Boolean)));
    const bookingClaimantIds = Array.from(new Set((bookingsRaw || []).map((b: any) => b.claimant_id).filter(Boolean)));
    const bookingRAIds = Array.from(new Set((bookingsRaw || []).map((b: any) => b.referring_attorney_id).filter(Boolean)));

    const { data: expertsForBookings } = bookingExpertIds.length
      ? await supabase.from("medical_experts").select("id, first_name, last_name, province").in("id", bookingExpertIds)
      : { data: [] as any[] };
    const { data: claimantsForBookings } = bookingClaimantIds.length
      ? await supabase.from("claimants").select("id, first_name, last_name").in("id", bookingClaimantIds)
      : { data: [] as any[] };
    // Province comes from the referring attorney/firm, not from the appointment
    // itself — appointments don't carry their own province column.
    const { data: attorneysForBookings } = bookingRAIds.length
      ? await supabase.from("referring_attorneys").select("id, province").in("id", bookingRAIds)
      : { data: [] as any[] };

    const expertNameByIdB = new Map((expertsForBookings || []).map((e: any) => [e.id, `${e.first_name || ""} ${e.last_name || ""}`.trim()]));
    const expertProvinceById = new Map((expertsForBookings || []).map((e: any) => [e.id, e.province || null]));
    const claimantNameByIdB = new Map((claimantsForBookings || []).map((c: any) => [c.id, `${c.first_name || ""} ${c.last_name || ""}`.trim()]));
    const attorneyProvinceById = new Map((attorneysForBookings || []).map((a: any) => [a.id, a.province || null]));

    const bookings: BookingRow[] = (bookingsRaw || []).map((b: any) => ({
      id: b.id,
      created_at: b.created_at,
      appointment_date: b.appointment_date,
      claimant_name: claimantNameByIdB.get(b.claimant_id) || "Unknown Claimant",
      expert_name: expertNameByIdB.get(b.expert_id) || "Unknown Expert",
      referring_attorney: b.referring_attorney || "—",
      case_status: b.case_status || "scheduled",
      service_fee: b.service_fee,
    }));

    // ---- Deals (assessments booked) closed by province, grouped via the referring attorney's province ----
    const provinceDealsClosed: Record<string, number> = {};
    for (const b of (bookingsRaw || [])) {
      const province = attorneyProvinceById.get(b.referring_attorney_id) || "Unspecified";
      provinceDealsClosed[province] = (provinceDealsClosed[province] || 0) + 1;
    }

    // ---- Most-booked expert this period ----
    const bookingCountByExpert: Record<string, number> = {};
    for (const b of (bookingsRaw || [])) {
      if (!b.expert_id) continue;
      bookingCountByExpert[b.expert_id] = (bookingCountByExpert[b.expert_id] || 0) + 1;
    }
    let topExpertId: string | null = null;
    let topExpertBookingsCount = 0;
    for (const [expertId, count] of Object.entries(bookingCountByExpert)) {
      if (count > topExpertBookingsCount) { topExpertId = expertId; topExpertBookingsCount = count; }
    }
    const topExpertName = topExpertId ? (expertNameByIdB.get(topExpertId) || null) : null;
    const topExpertProvince = topExpertId ? (expertProvinceById.get(topExpertId) || null) : null;

    // ---- Expert reports submitted in the period ----
    const { count: submittedReportsCount, error: reportsErr } = await supabase
      .from("expert_reports")
      .select("id", { count: "exact", head: true })
      .not("report_submitted_date", "is", null)
      .gte("report_submitted_date", start.toISOString())
      .lte("report_submitted_date", end.toISOString());
    if (reportsErr) console.warn("Could not count submitted expert reports:", reportsErr);

    const html = buildHtml({ periodStart: start, periodEnd: end, payments, paymentsTotal, bookings });

    // ---- Resolve recipients: admin/finance/director role emails, plus optional overrides ----
    const recipientEmails = new Set<string>();
    const envOverride = Deno.env.get("WEEKLY_REPORT_RECIPIENT_EMAILS");
    if (envOverride) envOverride.split(",").map(e => e.trim().toLowerCase()).filter(Boolean).forEach(e => recipientEmails.add(e));

    try {
      const { data: setting } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "weekly_operations_report_recipients")
        .maybeSingle();
      const v: any = setting?.setting_value;
      const list: string[] = Array.isArray(v) ? v : (Array.isArray(v?.emails) ? v.emails : []);
      list.map(e => String(e).trim().toLowerCase()).filter(Boolean).forEach(e => recipientEmails.add(e));
    } catch (e) {
      console.warn("Could not load system_settings recipient override:", e);
    }

    if (recipientEmails.size === 0) {
      try {
        const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["admin", "finance", "director"]);
        const ids = Array.from(new Set((roles || []).map((r: any) => r.user_id).filter(Boolean)));
        if (ids.length) {
          const { data: profs } = await supabase.from("profiles").select("email").in("id", ids);
          (profs || []).forEach((p: any) => { if (p?.email) recipientEmails.add(String(p.email).trim().toLowerCase()); });
        }
      } catch (e) {
        console.warn("Could not resolve admin/finance/director emails:", e);
      }
    }

    const recipients = Array.from(recipientEmails);

    let deliveryStatus = "pending";
    let deliveryError: string | null = null;
    let sentAt: string | null = null;

    const periodLabel = `${periodType[0].toUpperCase()}${periodType.slice(1)}`;

    if (!preview) {
      if (!recipients.length) {
        deliveryStatus = "skipped";
        deliveryError = "No recipients found (no admin/finance/director emails on file and no override configured)";
      } else {
        const subject = `${periodLabel} Operations Summary — ${fmtDate(start)} to ${fmtDate(end)}`;
        const res = await sendEmail({ from: "Medico-Legal Pro <noreply@kamedico-legal.co.za>", to: recipients, subject, html });
        deliveryStatus = res.success ? "sent" : "failed";
        deliveryError = res.success ? null : (res.error || "Unknown send failure");
        if (res.success) sentAt = new Date().toISOString();
      }

      await supabase.from("weekly_operations_reports").insert({
        period_type: periodType,
        period_start: isoDate(start),
        period_end: isoDate(end),
        payments_count: payments.length,
        payments_total: paymentsTotal,
        assessments_booked_count: bookings.length,
        submitted_reports_count: submittedReportsCount ?? 0,
        province_deals_closed: provinceDealsClosed,
        top_expert_name: topExpertName,
        top_expert_province: topExpertProvince,
        top_expert_bookings_count: topExpertBookingsCount,
        is_combined: true,
        generated_for_role: null,
        recipients,
        report_html: html,
        delivery_status: deliveryStatus,
        delivery_error: deliveryError,
        sent_at: sentAt,
        generated_by,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      period: { start: isoDate(start), end: isoDate(end) },
      payments_count: payments.length,
      payments_total: paymentsTotal,
      assessments_booked_count: bookings.length,
      recipients,
      delivery_status: deliveryStatus,
      delivery_error: deliveryError,
      html: preview ? html : undefined,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("send-weekly-operations-report error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
