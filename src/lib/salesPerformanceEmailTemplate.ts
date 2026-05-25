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

const pick = <T,>(arr: T[], seed?: number): T => {
  if (typeof seed === "number") return arr[seed % arr.length];
  return arr[Math.floor(Math.random() * arr.length)];
};

export interface SalesPerfCopyOverrides {
  headerTitle?: string;
  headerTagline?: string;
  greetingIntro?: string;
  managerNoteHeading?: string;
  footerNote?: string;
  congrats?: string;
  comment?: string;
}

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
  headerTitle?: string;
  headerTagline?: string;
  greetingIntro?: string;
  managerNoteHeading?: string;
  footerNote?: string;
}

// ── Dynamic coaching language ────────────────────────────────────────────────
// Coaching text varies by performance tier and role so the system never sounds
// predictable. Use generateCoachingText() to pull a fresh variant.

type Role = "consultant" | "non_consultant";
type Tier = "exceptional" | "on_target" | "slight_miss" | "significant_miss" | "critical_miss";

export function classifyPerformance(deals: number, target: number): Tier {
  if (target <= 0) return "on_target";
  const ratio = deals / target;
  if (ratio >= 1.25) return "exceptional";
  if (ratio >= 1) return "on_target";
  if (ratio >= 0.7) return "slight_miss";
  if (ratio >= 0.4) return "significant_miss";
  return "critical_miss";
}

const COACHING_BANK: Record<Role, Record<Tier, { weekly: string[]; monthly: string[] }>> = {
  consultant: {
    exceptional: {
      weekly: [
        "Phenomenal week — you've set a new bar. Keep your discovery calls tight and protect your follow-up window; next week, aim to convert one stretch lead you'd usually park.",
        "You're operating at elite tempo. Document the two moves that worked best this week and share them in Monday's stand-up so the team can mirror them.",
        "Outstanding output. Use this momentum to deepen relationships with your top 3 referrers — a single warm intro now is worth two cold pulls next week.",
      ],
      monthly: [
        "An exceptional month. Lock in your playbook by writing a short post-mortem on your highest-value deal — we'll feature it in next month's sales huddle.",
        "Top-tier performance. Spend an hour this week refining your discovery script; small upgrades compound quickly at your level.",
        "You've outpaced the team. Use the next month to mentor one peer through a live deal — your hands-on coaching is now part of your KPI uplift.",
      ],
    },
    on_target: {
      weekly: [
        "Solid week — target met. Next week, push for one extra closure by trimming your lead-response time to under 30 minutes.",
        "Consistent delivery. Pick the single weakest stage in your pipeline and run one experiment to lift it.",
        "Target hit cleanly. Build a small buffer next week so you're not chasing the line on Friday.",
      ],
      monthly: [
        "On target for the month. Plan one structural improvement (cadence, CRM hygiene, or referral asks) to repeat the result with less effort next month.",
        "Reliable month. Identify your three best-converting lead sources and double down for the next 30 days.",
      ],
    },
    slight_miss: {
      weekly: [
        "Just shy of target. Block 90 minutes early Monday for pipeline triage and prioritise the two warmest leads first.",
        "Close, not closed. Review the deals that stalled — one short follow-up call this week may pull them over the line.",
        "Marginal miss. Tighten your daily activity log and book a 15-min check-in with your Sales Manager mid-week to course-correct.",
      ],
      monthly: [
        "Narrow miss this month. Map out a weekly milestone plan with your Sales Manager — small weekly wins are the fastest way back to target.",
        "Just under the line. Audit your last 5 lost deals for a common objection and prepare a sharper response.",
      ],
    },
    significant_miss: {
      weekly: [
        "Below target. Book a coaching session this week, rebuild your top-of-funnel with 10 fresh prospects by Wednesday, and report progress on Friday.",
        "Performance is off pace. Restart with the basics: daily call quotas, written next-steps after every meeting, and a same-day Sales Manager debrief on any lost deal.",
        "Notable shortfall. Pair up with a top performer for shadowing this week — observation, not theory, is the fastest fix.",
      ],
      monthly: [
        "The month came in below target. A focused 30-day improvement plan will be agreed with your Sales Manager covering activity, conversion, and pipeline depth.",
        "Significant gap to target. Daily standups will be introduced for the next 2 weeks until the trend reverses.",
      ],
    },
    critical_miss: {
      weekly: [
        "Critical shortfall. A formal performance review is being scheduled. Please clear your calendar for a structured coaching block and prepare your pipeline for a full audit.",
        "Output is well below expectation. Another missed week will trigger formal strike action — please escalate any blockers to your Sales Manager today.",
        "Urgent intervention required. We will pair you with a senior consultant for the next two weeks; daily activity reporting becomes mandatory.",
      ],
      monthly: [
        "The month is critically below target. A formal performance improvement plan (PIP) will be initiated with measurable weekly checkpoints.",
        "This level of monthly performance is unsustainable. A PIP and structured coaching will commence immediately, with weekly written reviews.",
      ],
    },
  },
  non_consultant: {
    exceptional: {
      weekly: [
        "Excellent contribution this week — well above your support target. Keep documenting what worked; your insights help the wider sales team scale.",
        "Outstanding output for a non-consultant role. Use the momentum to take ownership of one cross-functional handoff that often stalls deals.",
      ],
      monthly: [
        "Exceptional month outside the core sales seat. Consider leading a 15-minute knowledge share next month — your perspective adds value.",
      ],
    },
    on_target: {
      weekly: [
        "Target met for the week. Next week, look for one process improvement that reduces friction for the closing team.",
        "Consistent week. Keep your turnaround times tight and flag any recurring blockers early.",
      ],
      monthly: [
        "On target for the month. Identify one repeatable workflow you can hand off or document to free up time for higher-impact work.",
      ],
    },
    slight_miss: {
      weekly: [
        "Slight miss this week. Re-balance your priorities Monday morning and surface any blockers in the team check-in.",
        "Just below the line. A short planning session with your manager should reset the week.",
      ],
      monthly: [
        "Narrow monthly miss. Agree two small weekly habits with your manager to bring the trend back up.",
      ],
    },
    significant_miss: {
      weekly: [
        "Below target this week. Please meet your manager to review workload, capacity, and any unblockers needed.",
        "Notable miss. Daily check-ins for the next week will help identify whether the issue is capacity, clarity, or process.",
      ],
      monthly: [
        "Significant monthly gap. A 30-day support plan will be agreed to restore expected output.",
      ],
    },
    critical_miss: {
      weekly: [
        "Critical shortfall — please raise blockers immediately and expect a formal review meeting this week.",
      ],
      monthly: [
        "The monthly result is critically below expectation; a formal improvement plan will be initiated.",
      ],
    },
  },
};

const CONGRATS_BANK: Record<Tier, { weekly: string[]; monthly: string[] }> = {
  exceptional: {
    weekly: [
      "Phenomenal week — you didn't just hit target, you flew past it. Take the win.",
      "Standout performance this week. You've earned the bragging rights.",
      "Exceptional output — exactly the kind of week that defines a top performer.",
    ],
    monthly: [
      "An outstanding month — you've set the tone for the rest of the team.",
      "Exceptional month. Your consistency and quality are the gold standard right now.",
      "Top-of-the-board performance for the month. Recognition fully earned.",
    ],
  },
  on_target: {
    weekly: [
      "Target met cleanly. Reliable weeks like this are how careers are built.",
      "Solid hit on target — well done for keeping the discipline up.",
      "Target achieved. Keep stacking these weeks together.",
    ],
    monthly: [
      "Target met for the month. Consistency is the win here.",
      "On-target month — a strong, dependable performance.",
    ],
  },
  slight_miss: { weekly: [], monthly: [] },
  significant_miss: { weekly: [], monthly: [] },
  critical_miss: { weekly: [], monthly: [] },
};

export function generateCoachingText(opts: {
  role: Role;
  deals: number;
  target: number;
  periodType: "weekly" | "monthly";
  seed?: number;
}): { tier: Tier; comment: string; congrats: string | null } {
  const tier = classifyPerformance(opts.deals, opts.target);
  const comment = pick(COACHING_BANK[opts.role][tier][opts.periodType], opts.seed);
  const congratsArr = CONGRATS_BANK[tier][opts.periodType];
  const congrats = congratsArr.length ? pick(congratsArr, opts.seed) : null;
  return { tier, comment, congrats };
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
          return { start: s, end: e, deals: 0, target: 3 };
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

  const perfCoach = generateCoachingText({
    role: "consultant",
    deals: performerDeals,
    target: performerTarget,
    periodType,
  });
  const underCoach = generateCoachingText({
    role: "consultant",
    deals: underDeals,
    target: underTarget,
    periodType,
  });

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
    congrats: perfCoach.congrats,
    comment: perfCoach.comment,
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
    comment: underCoach.comment,
  });

  return { performer, underPerformer };
}
