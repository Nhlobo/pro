import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { AdminPage, AdminPill, BRAND_TEAL } from '@/components/admin/ui/AdminUI';
import {
  Calendar, FileText, Clock, Users, AlertTriangle, CheckCircle2, FileSignature,
  ChevronUp, ChevronDown, type LucideIcon,
} from 'lucide-react';

const logoSrc = '/lovable-uploads/7401e32a-2457-4a00-9d60-c1ff9fcfc4fc.png';

// Same three status colors the old live-map pins used — kept identical so
// "green/amber/red" still means the same thing everywhere in the portal.
const STATUS_COLORS = {
  resolved: '#1E9E4A', // green
  pending: '#E2A030',  // amber
  failed: '#DC3545',   // red
} as const;
type StatusKey = keyof typeof STATUS_COLORS;
const STATUS_ORDER: StatusKey[] = ['resolved', 'pending', 'failed'];

const CASE_TYPE_COLORS = [
  BRAND_TEAL,
  'hsl(var(--kutlwano-blue))',
  'hsl(var(--kutlwano-purple))',
  'hsl(var(--kutlwano-gold))',
  'hsl(var(--info))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
];

const currentYear = new Date().getFullYear();
const lastYear = currentYear - 1;

/**
 * The mark in the corner of the home page — tilts in 3D toward the cursor.
 * A small "this system is alive" cue on the one page every other screen
 * in the portal returns to. The map below now carries the main branding
 * (logo + live clock on its own floating card), so this stays a quiet
 * header accent rather than duplicating that.
 */
const LiveMark: React.FC = () => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setTilt({
      x: Math.max(-10, Math.min(10, (cy - e.clientY) / 4)),
      y: Math.max(-10, Math.min(10, (e.clientX - cx) / 4)),
    });
  };

  return (
    <div
      ref={wrapRef}
      onMouseMove={handleMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      style={{ perspective: '400px' }}
      className="h-10 w-10 shrink-0"
    >
      <div
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transition: 'transform 150ms ease-out' }}
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-md border border-black/10 bg-white shadow-sm"
      >
        <img src={logoSrc} alt="Kutlwano & Associate" className="h-full w-full object-contain p-1" />
      </div>
    </div>
  );
};

/**
 * Same "this is live" clock treatment used across the portal (pulsing teal
 * dot + monospace time), just re-themed in white for use over the dark
 * gradient hero below instead of a light card.
 */
function useLiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/**
 * The dashboard's new middle section — the same full-bleed teal→blue
 * gradient brand panel used on the left half of the Auth screen ("We touch
 * a file. We change lives."), brought over wholesale in place of the old
 * live map. Desktop/large-screen only (hidden lg:flex, exactly like the
 * Auth aside) since it's a wide two-column-shaped hero, not something that
 * folds down cleanly onto a phone screen.
 */
const OperationsHeroPanel: React.FC<{
  statPills: StatPillData[];
  loading: boolean;
  statusCounts: StatusCounts;
  total: number;
}> = ({ statPills, loading, statusCounts, total }) => {
  const now = useLiveClock();
  const time = now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const date = now.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="relative hidden min-h-[70vh] flex-1 -mx-3 flex-col justify-between overflow-hidden gradient-nav p-10 text-white sm:-mx-4 lg:-mx-6 lg:flex">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

      {/* Red/amber/green file-pin wallpaper — same glyph and colors the
          live map used to plot per province, now just a scattered backdrop
          whose green/amber/red mix tracks the real resolved/pending/failed
          totals instead of literal coordinates. */}
      <FilePinBackground counts={statusCounts} total={total} target={34} />

      <div className="relative z-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-white/15 p-2 ring-2 ring-white/30 backdrop-blur">
            <img src={logoSrc} alt="Kutlwano & Associate" className="h-12 w-12 object-contain" />
          </div>
          <div>
            <div className="text-lg font-bold tracking-wide">Medico-Legal Pro</div>
            <div className="text-xs text-white/80">Kutlwano &amp; Associate</div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <p className="text-xs text-white/70">{date}</p>
          <div className="flex items-center gap-2 border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            <Clock className="h-3.5 w-3.5 text-white/70" />
            <span className="font-mono text-sm font-semibold tabular-nums">{time}</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 space-y-4">
        <h1 className="text-4xl font-bold leading-tight xl:text-5xl">
          We touch a file.<br />We change lives.
        </h1>
        <p className="max-w-md text-sm text-white/85 xl:text-base">
          Every case above is a person waiting on an answer — operations keeps that promise moving, province by province, file by file.
        </p>
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/15 pt-4 text-xs text-white/80">
        {statPills.map((stat) => {
          const Icon = stat.icon;
          return (
            <span key={stat.label} className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 text-white/70" />
              <span className="font-bold tabular-nums text-white">{loading ? '–' : stat.value}</span>
              {stat.label}
            </span>
          );
        })}
        <span className="ml-auto text-white/60">© {now.getFullYear()} Kutlwano &amp; Associate (Pty) Ltd</span>
      </div>
    </div>
  );
};

/**
 * The case-file pin glyph from the old live map (rounded map-pin silhouette
 * with a small document icon inside) — same shape, just freed from Leaflet
 * so it can be dropped in as plain background art instead of a real marker.
 */
const FilePinGlyph: React.FC<{ color: string }> = ({ color }) => (
  <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill={color} />
    <circle cx="14" cy="13" r="9" fill="white" />
    <path d="M10.5 8.7h5l2 2v9.1a0.8 0.8 0 0 1-0.8 0.8h-6.4a0.8 0.8 0 0 1-0.8-0.8V9.5a0.8 0.8 0 0 1 0.8-0.8z" fill="none" stroke={color} strokeWidth="1.1" />
    <path d="M15.5 8.7v2h2" fill="none" stroke={color} strokeWidth="1.1" />
    <line x1="11.6" y1="14.2" x2="16.4" y2="14.2" stroke={color} strokeWidth="1" />
    <line x1="11.6" y1="16.3" x2="16.4" y2="16.3" stroke={color} strokeWidth="1" />
    <line x1="11.6" y1="18.4" x2="14.8" y2="18.4" stroke={color} strokeWidth="1" />
  </svg>
);

/** Small deterministic PRNG (mulberry32) so the scatter looks random but
 * never reshuffles/flickers between renders of the same pin index. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface StatusCounts { resolved: number; pending: number; failed: number }

/**
 * Wallpaper of file pins scattered behind the hero content — this is the
 * "style with logic" part: it isn't a random decoration, the *mix* of
 * green/amber/red on screen is driven by the real resolved/pending/failed
 * totals, same as the KPI strip that used to float on top of the live map.
 * Faint + pointer-events-none so it reads as texture, not a second map.
 */
const FilePinBackground: React.FC<{ counts: StatusCounts; total: number; target?: number }> = ({ counts, total, target = 30 }) => {
  const pins = useMemo(() => {
    const TARGET = target; // roughly how many glyphs fill the panel at a readable density
    const sum = counts.resolved + counts.pending + counts.failed;
    // While stats are still loading (sum === 0) fall back to an even split
    // so the panel isn't blank — as soon as real data lands this reflows
    // to the true proportions.
    const ratios = sum > 0
      ? { resolved: counts.resolved / sum, pending: counts.pending / sum, failed: counts.failed / sum }
      : { resolved: 1 / 3, pending: 1 / 3, failed: 1 / 3 };

    const perStatus = STATUS_ORDER.map((key) => ({
      key,
      count: ratios[key] > 0 ? Math.max(1, Math.round(ratios[key] * TARGET)) : 0,
    }));

    const list: { key: StatusKey; x: number; y: number; size: number; rotate: number; opacity: number }[] = [];
    perStatus.forEach(({ key, count }) => {
      for (let i = 0; i < count; i++) {
        list.push({ key, x: 0, y: 0, size: 0, rotate: 0, opacity: 0 });
      }
    });

    // Seeded shuffle + placement — stable across re-renders, changes only
    // when the underlying totals actually change (see the dependency array).
    const rand = mulberry32(list.length * 7919 + total);
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list.map((pin, i) => {
      const r = mulberry32(i * 104729 + total);
      return {
        ...pin,
        x: r() * 100,
        y: r() * 100,
        size: 22 + r() * 30,
        rotate: r() * 24 - 12,
        opacity: 0.18 + r() * 0.22,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts.resolved, counts.pending, counts.failed, total, target]);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {pins.map((pin, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: `${pin.x}%`,
            top: `${pin.y}%`,
            width: pin.size,
            transform: `translate(-50%, -50%) rotate(${pin.rotate}deg)`,
            opacity: pin.opacity,
          }}
        >
          <FilePinGlyph color={STATUS_COLORS[pin.key]} />
        </div>
      ))}
    </div>
  );
};

interface StatPillData {
  label: string;
  value: number;
  icon: LucideIcon;
}

/** A slim inline stat, not a card — the strip is the "dashboard chrome", the map is the content. */
const StatPill = React.memo(function StatPill({ stat, loading }: { stat: StatPillData; loading: boolean }) {
  const Icon = stat.icon;
  return (
    <div className="flex items-center gap-2 whitespace-nowrap border-r border-black/10 px-3 py-1.5 last:border-r-0">
      <Icon className="h-3.5 w-3.5" style={{ color: BRAND_TEAL }} />
      <span className="text-sm font-bold tabular-nums text-black">{loading ? '–' : stat.value}</span>
      <span className="text-[11px] text-slate-500">{stat.label}</span>
    </div>
  );
});

interface CaseTypeRowData {
  type: string;
  count: number;
  countLastYear: number;
}

const CaseTypeRow = React.memo(function CaseTypeRow({ ct, maxCount, color }: { ct: CaseTypeRowData; maxCount: number; color: string }) {
  return (
    <div className="space-y-1 py-1.5">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="truncate text-xs font-medium text-black">{ct.type}</span>
        </div>
        <span className="text-xs font-semibold" style={{ color }}>{ct.count}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max((ct.count / maxCount) * 100, 2)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
});

const AdminOperationsDashboard: React.FC = () => {
  const { stats, loading } = useDashboardStats();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const statPills: StatPillData[] = useMemo(() => [
    { label: 'Active cases', value: stats.totalClaimants, icon: Users },
    { label: 'Appointments', value: stats.totalAppointments, icon: Calendar },
    { label: 'Pending', value: stats.pendingReports, icon: Clock },
    { label: 'In progress', value: stats.reportsInProgress, icon: FileText },
    { label: 'Reports out', value: stats.reportsTakenOut, icon: FileSignature },
    { label: 'Completed', value: stats.completedAssessments, icon: CheckCircle2 },
  ], [stats]);

  const maxCaseTypeCount = useMemo(() => {
    if (stats.caseTypeData.length === 0) return 1;
    return Math.max(...stats.caseTypeData.map((c) => c.count)) || 1;
  }, [stats.caseTypeData]);

  // Same resolved/pending/failed totals the old map pins encoded, just
  // summed across every province instead of plotted on one — this is what
  // drives the green/amber/red mix in the hero's pin wallpaper.
  const statusCounts: StatusCounts = useMemo(() => {
    const totals: StatusCounts = { resolved: 0, pending: 0, failed: 0 };
    (stats.provinceStatusData ?? []).forEach((p) => {
      totals.resolved += p.resolved;
      totals.pending += p.pending;
      totals.failed += p.failed;
    });
    return totals;
  }, [stats.provinceStatusData]);

  return (
    // `flex flex-col` (on top of AdminPage's default space-y-4/6 rhythm)
    // plus a viewport-height floor is what makes the map genuinely
    // full-screen: it's a flex-1 child, so it always eats every pixel left
    // over after the header row and (when present) the alert/drawer below —
    // on every screen size, without a single hard-coded height to fight.
    // The 7rem subtracted here is the portal's shared two-row gradient
    // header above this page (it replaced the old fixed 56px search bar) —
    // it's an estimate since that header's real height flexes slightly with
    // content/breakpoint, so this is a floor, not a pixel-perfect match.
    <AdminPage className="flex min-h-[calc(100vh-7rem)] flex-col">
      {/* Header — same eyebrow/title pattern as every other admin page */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <LiveMark />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: BRAND_TEAL }}>
              Operations
            </div>
            <h1 className="truncate text-xl font-bold text-black md:text-2xl">Operations Dashboard</h1>
            <p className="text-xs text-slate-500 md:text-sm">Live case load across every province</p>
          </div>
        </div>
        <div className="flex max-w-full flex-wrap items-center overflow-x-auto rounded-full border border-black/10 bg-white">
          {statPills.map((stat) => (
            <StatPill key={stat.label} stat={stat} loading={loading} />
          ))}
        </div>
      </div>

      {/* Middle section — the Auth page's left brand panel ("We touch a
          file. We change lives."), reused here as the dashboard's hero
          instead of the old live map. Desktop/large-screen only, same as
          on the Auth page. */}
      <OperationsHeroPanel statPills={statPills} loading={loading} statusCounts={statusCounts} total={stats.totalClaimants} />

      {/* Compact stand-in for anything below `lg`, where the wide gradient
          hero above is hidden — keeps the page from going blank on
          tablet/mobile without trying to cram the two-column hero in.
          Carries the same red/amber/green pin wallpaper at a lighter
          density so the two versions still feel like one design. */}
      <div className="relative flex min-h-[40vh] flex-1 flex-col items-center justify-center gap-3 overflow-hidden border border-black/10 bg-white p-8 text-center lg:hidden">
        <FilePinBackground counts={statusCounts} total={stats.totalClaimants} target={14} />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="rounded-full bg-gradient-to-br from-[#00BAAD] to-white p-2 ring-2 ring-[#00BAAD]/40">
            <img src={logoSrc} alt="Kutlwano & Associate" className="h-14 w-14 object-contain" />
          </div>
          <h2 className="text-lg font-bold text-black">We touch a file. We change lives.</h2>
          <p className="max-w-xs text-sm text-slate-500">
            The full operations view is available on desktop and large screens. Use the stats above to track today's case load.
          </p>
        </div>
      </div>

      {/* Overdue alert — flat hairline block, matching the rest of the portal's alert treatment */}
      {stats.overdueReports > 0 && (
        <div className="flex flex-wrap items-center gap-2 border border-warning/30 bg-warning/5 px-4 py-2.5 text-sm text-black">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <span className="flex-1">
            {stats.overdueReports} report{stats.overdueReports !== 1 ? 's' : ''} overdue — pending for more than 30 days
          </span>
          <AdminPill tone="warning">Action required</AdminPill>
        </div>
      )}

      {/* Case type breakdown — tucked into a collapsible drawer instead of a permanent table */}
      <div className="border border-black/10 bg-white">
        <button
          onClick={() => setDrawerOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-black"
        >
          <span>Case type breakdown ({lastYear} vs {currentYear})</span>
          {drawerOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {drawerOpen && (
          <div className="border-t border-black/10 px-4 py-2">
            {stats.caseTypeData.length === 0 ? (
              <p className="py-2 text-sm text-slate-500">No case type data available</p>
            ) : (
              stats.caseTypeData.map((ct, i) => (
                <CaseTypeRow
                  key={ct.type}
                  ct={ct}
                  maxCount={maxCaseTypeCount}
                  color={CASE_TYPE_COLORS[i % CASE_TYPE_COLORS.length]}
                />
              ))
            )}
          </div>
        )}
      </div>
    </AdminPage>
  );
};

export default AdminOperationsDashboard;
