// Mirror of supabase/functions/send-sales-performance-report buildHtml,
// used to render in-app email draft previews for admins.

const escapeHtml = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });

export interface SalesPerfTemplateOpts {
  consultantName: string;
  firstName: string;
  periodType: "weekly" | "monthly";
  periodStart: Date;
  periodEnd: Date;
  deals: number;
  target: number;
  targetMet: boolean;
  strikes: number;
  risk: "none" | "low" | "medium" | "high";
  comment: string;
  congrats: string | null;
  previousDeals?: number;
  weeklyBreakdown?: Array<{ start: Date; end: Date; deals: number; target: number }>;
}

export function buildSalesPerformanceEmailHtml(opts: SalesPerfTemplateOpts) {
  const riskColours: Record<string, { bg: string; fg: string; label: string }> = {
    none: { bg: "#dcfce7", fg: "#166534", label: "On Track" },
    low: { bg: "#fef3c7", fg: "#854d0e", label: "Low Risk" },
    medium: { bg: "#fed7aa", fg: "#9a3412", label: "Medium Risk — Warning" },
    high: { bg: "#fecaca", fg: "#991b1b", label: "High Risk — Strike Likely" },
  };
  const r = riskColours[opts.risk] || riskColours.none;
  const periodLabel = opts.periodType === "weekly" ? "Weekly" : "Monthly";
  const dateRange = `${fmtDate(opts.periodStart)} – ${fmtDate(opts.periodEnd)}`;
  const pct = opts.target > 0 ? Math.min(100, Math.round((opts.deals / opts.target) * 100)) : 0;

  const weeklyRows = (opts.weeklyBreakdown || [])
    .map(
      (w, i) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">Week ${i + 1}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${fmtDate(w.start)} – ${fmtDate(w.end)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${w.deals}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:${w.deals >= w.target ? "#166534" : "#9a3412"};font-weight:600;">${w.deals >= w.target ? "✓" : "✗"}</td>
    </tr>`
    )
    .join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#1f2937;background:#ffffff;">
    <div style="background:#0f766e;color:#ffffff;padding:24px;text-align:center;">
      <h1 style="margin:0;font-size:22px;font-weight:700;">Medico-Legal Pro</h1>
      <p style="margin:6px 0 0;font-size:14px;opacity:0.9;">${periodLabel} Sales Performance Report</p>
    </div>

    <div style="padding:24px;">
      <p style="margin:0 0 6px;font-size:15px;">Hi <strong>${escapeHtml(opts.firstName || opts.consultantName)}</strong>,</p>
      <p style="margin:0 0 18px;color:#4b5563;font-size:14px;">Here is your personal ${opts.periodType} performance summary for <strong>${escapeHtml(dateRange)}</strong>.</p>

      ${
        opts.congrats
          ? `
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:14px 16px;margin-bottom:18px;">
        <p style="margin:0;color:#065f46;font-size:14px;font-weight:600;">${escapeHtml(opts.congrats)}</p>
      </div>`
          : ""
      }

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

      ${
        opts.weeklyBreakdown && opts.weeklyBreakdown.length
          ? `
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
      </table>`
          : ""
      }

      <h3 style="margin:0 0 8px;font-size:14px;color:#0f172a;">Manager's Note &amp; Expectations</h3>
      <div style="background:#f8fafc;border-left:4px solid #0f766e;padding:12px 14px;border-radius:4px;margin-bottom:18px;">
        <p style="margin:0;font-size:13px;color:#1f2937;line-height:1.6;">${escapeHtml(opts.comment)}</p>
      </div>

      <p style="margin:18px 0 0;font-size:12px;color:#6b7280;">This is an automated performance report. For queries, contact your Sales Manager.</p>
    </div>

    <div style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:14px;text-align:center;color:#6b7280;font-size:11px;">
      © ${new Date().getFullYear()} Medico-Legal Pro &nbsp;•&nbsp; Sales Performance &nbsp;•&nbsp; Generated ${fmtDate(new Date())}
    </div>
  </div>`;
}

export function getSampleDrafts(periodType: "weekly" | "monthly") {
  const now = new Date();
  const periodEnd = new Date(now);
  const periodStart = new Date(now);
  if (periodType === "weekly") {
    periodStart.setDate(periodEnd.getDate() - 6);
  } else {
    periodStart.setDate(1);
  }

  const weeklyBreakdown =
    periodType === "monthly"
      ? [0, 1, 2, 3].map((i) => {
          const s = new Date(periodStart);
          s.setDate(1 + i * 7);
          const e = new Date(s);
          e.setDate(s.getDate() + 6);
          return { start: s, end: e, deals: 0, target: periodType === "monthly" ? 3 : 2 };
        })
      : undefined;

  const performerTarget = periodType === "weekly" ? 2 : 8;
  const performerDeals = periodType === "weekly" ? 3 : 11;
  const underTarget = periodType === "weekly" ? 2 : 8;
  const underDeals = periodType === "weekly" ? 0 : 2;

  const performerBreakdown = weeklyBreakdown
    ? weeklyBreakdown.map((w, i) => ({ ...w, deals: [3, 2, 3, 3][i] }))
    : undefined;
  const underBreakdown = weeklyBreakdown
    ? weeklyBreakdown.map((w, i) => ({ ...w, deals: [1, 0, 1, 0][i] }))
    : undefined;

  const performer = buildSalesPerformanceEmailHtml({
    consultantName: "Thandi Mokoena",
    firstName: "Thandi",
    periodType,
    periodStart,
    periodEnd,
    deals: performerDeals,
    target: performerTarget,
    targetMet: true,
    strikes: 0,
    risk: "none",
    previousDeals: periodType === "weekly" ? 2 : 9,
    weeklyBreakdown: performerBreakdown,
    congrats:
      periodType === "weekly"
        ? "Outstanding week! You exceeded your target — congratulations on your sustained excellence."
        : "Exceptional month! You smashed your monthly target and remain one of our top performers.",
    comment:
      periodType === "weekly"
        ? "Keep the momentum going next week. Focus on maintaining your high conversion rate on warm leads, and continue sharing your playbook with the wider team."
        : "Truly exceptional consistency this month — every week above target. Continue to mentor newer consultants and keep the pipeline disciplined heading into the next month.",
  });

  const underPerformer = buildSalesPerformanceEmailHtml({
    consultantName: "Sipho Dlamini",
    firstName: "Sipho",
    periodType,
    periodStart,
    periodEnd,
    deals: underDeals,
    target: underTarget,
    targetMet: false,
    strikes: periodType === "weekly" ? 1 : 2,
    risk: periodType === "weekly" ? "medium" : "high",
    previousDeals: periodType === "weekly" ? 1 : 3,
    weeklyBreakdown: underBreakdown,
    congrats: null,
    comment:
      periodType === "weekly"
        ? "You fell short of your weekly target. Please review your pipeline with your Sales Manager on Monday, prioritise follow-ups with hot leads, and book a coaching session this week. Another missed week may trigger a formal strike."
        : "This month's performance is below the agreed monthly target and you are now at high risk of a formal strike. A performance improvement plan will be initiated. Please meet with your Sales Manager this week to agree on weekly milestones, daily activity targets, and additional coaching support.",
  });

  return { performer, underPerformer };
}
