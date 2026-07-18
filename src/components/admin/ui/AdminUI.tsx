// src/components/admin/ui/AdminUI.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { LucideIcon } from 'lucide-react';

/**
 * Shared Admin Portal design system.
 *
 * A single, consistent visual language for every page inside the Admin
 * Portal: flat black/white surfaces, hairline borders, and the brand teal
 * used sparingly for emphasis (active states, key numbers, icons).
 *
 * This file only affects presentation — it renders whatever data/handlers
 * are passed in, so pages keep 100% of their existing logic.
 */

export const BRAND_TEAL = '#00BAAD';

/* ------------------------------------------------------------------ */
/* Page shell                                                         */
/* ------------------------------------------------------------------ */

export const AdminPage: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => <div className={cn('space-y-4 md:space-y-6', className)}>{children}</div>;

/** Eyebrow + bold heading, matching the Operations Dashboard / auth pattern. */
export const AdminHeader: React.FC<{
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}> = ({ eyebrow, title, description, icon: Icon, actions }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-center gap-3">
      {Icon && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/5">
          <Icon className="h-5 w-5" style={{ color: BRAND_TEAL }} />
        </div>
      )}
      <div className="min-w-0">
        {eyebrow && (
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: BRAND_TEAL }}
          >
            {eyebrow}
          </div>
        )}
        <h1 className="truncate text-xl font-bold text-black md:text-2xl">{title}</h1>
        {description && <p className="text-xs text-slate-500 md:text-sm">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

/* ------------------------------------------------------------------ */
/* Cards / sections                                                    */
/* ------------------------------------------------------------------ */

/** Flat, hairline-bordered card — the base surface for all admin content. */
export const AdminCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn('rounded-none border border-black/10 bg-white shadow-none', className)}
    {...props}
  />
);

export const AdminCardHeader: React.FC<{
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, description, icon: Icon, actions, className }) => (
  <div
    className={cn(
      'flex flex-col gap-2 border-b border-black/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
      className
    )}
  >
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-sm font-semibold text-black">
        {Icon && <Icon className="h-4 w-4 shrink-0" style={{ color: BRAND_TEAL }} />}
        <span className="truncate">{title}</span>
      </div>
      {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const AdminCardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn('p-4', className)} {...props} />;

/* ------------------------------------------------------------------ */
/* KPI / stat tiles                                                    */
/* ------------------------------------------------------------------ */

export const AdminStatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: React.ReactNode;
  loading?: boolean;
}> = ({ label, value, icon: Icon, hint, loading }) => (
  <AdminCard className="transition-colors hover:border-black/25">
    <div className="px-3 pb-3 pt-3 md:px-4">
      <div className="mb-2 flex items-center justify-between">
        {Icon && (
          <div className="rounded-full bg-black/5 p-1.5 md:p-2">
            <Icon className="h-4 w-4" style={{ color: BRAND_TEAL }} />
          </div>
        )}
      </div>
      <p className="text-xl font-bold tabular-nums text-black md:text-2xl">
        {loading ? '–' : value}
      </p>
      <p className="text-[11px] leading-tight text-slate-500">{label}</p>
      {hint && <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p>}
    </div>
  </AdminCard>
);

/* ------------------------------------------------------------------ */
/* Badges / pills                                                      */
/* ------------------------------------------------------------------ */

type PillTone = 'neutral' | 'teal' | 'success' | 'warning' | 'destructive';

const PILL_TONE_CLASSES: Record<PillTone, string> = {
  neutral: 'border-black/15 text-black',
  teal: 'border-[#00BAAD]/40 text-[#00BAAD]',
  success: 'border-success/40 text-success',
  warning: 'border-warning/40 text-warning',
  destructive: 'border-destructive/40 text-destructive',
};

export const AdminPill: React.FC<{
  children: React.ReactNode;
  tone?: PillTone;
  className?: string;
}> = ({ children, tone = 'neutral', className }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-none border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
      PILL_TONE_CLASSES[tone],
      className
    )}
  >
    {children}
  </span>
);

/* ------------------------------------------------------------------ */
/* Empty / loading states                                              */
/* ------------------------------------------------------------------ */

export const AdminEmptyState: React.FC<{
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
    {Icon && (
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-black/5">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
    )}
    <p className="text-sm font-medium text-black">{title}</p>
    {description && <p className="max-w-sm text-xs text-slate-500">{description}</p>}
    {action}
  </div>
);

export const AdminLoadingState: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center px-4 py-12 text-sm text-slate-500">
    <span
      className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/15 border-t-[#00BAAD]"
      aria-hidden="true"
    />
    {label}
  </div>
);

/* ------------------------------------------------------------------ */
/* Tab navigation — the primary "module switcher" pattern used on      */
/* every multi-panel admin screen (Appointment Engine, System Control, */
/* Email History, Sales Performance). One definition, one feel.       */
/* ------------------------------------------------------------------ */

/**
 * Wraps a `<TabsList>` with the enterprise chrome: hairline border, flat
 * white surface, horizontal scroll with edge fade on small screens (so it
 * reads as "more to scroll" instead of an abrupt cut-off), and an optional
 * sticky mode so long pages keep the module switcher on-screen while the
 * person scrolls through a tab's content — this is what keeps deep pages
 * fast to navigate instead of forcing a scroll-up round trip every time.
 */
export const AdminTabList: React.FC<{
  children: React.ReactNode;
  className?: string;
  /** Pins the bar under the sticky app header while its content scrolls. */
  sticky?: boolean;
  /** Lay out triggers as an even grid on ≥sm instead of left-aligned flow. */
  columns?: number;
}> = ({ children, className, sticky, columns }) => (
  <div
    className={cn(
      '-mx-3 overflow-x-auto px-3 sm:mx-0 sm:overflow-visible sm:px-0',
      sticky && 'sticky top-0 z-20 -mt-px bg-white/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/80'
    )}
  >
    <TabsList
      className={cn(
        'flex h-auto w-max min-w-full items-stretch gap-1 rounded-none border border-black/10 bg-white p-1 sm:w-full',
        columns && `sm:grid sm:w-full sm:min-w-0`,
        className
      )}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {children}
    </TabsList>
  </div>
);

/**
 * A single tab trigger with the shared active/inactive treatment: flat
 * black fill + white text when active, quiet slate text otherwise, a short
 * color transition instead of an abrupt swap, generous touch target height
 * (44px) for fast, confident tapping on tablets and phones, and an optional
 * count badge (e.g. "3 unattended") that inverts to stay legible on the
 * active black background.
 */
export const AdminTabTrigger: React.FC<{
  value: string;
  label: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  /** Center the icon/label group — used when the tab list is a grid. */
  center?: boolean;
  className?: string;
}> = ({ value, label, icon: Icon, badge, center, className }) => (
  <TabsTrigger
    value={value}
    className={cn(
      'group relative flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-none px-3 py-2 text-xs font-medium text-slate-500 transition-colors duration-150 hover:text-black data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-none sm:text-sm',
      center && 'sm:justify-center',
      className
    )}
  >
    {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
    <span className="truncate">{label}</span>
    {badge !== undefined && badge !== null && badge !== 0 && (
      <span
        className="ml-0.5 flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white transition-colors duration-150 group-data-[state=active]:bg-white group-data-[state=active]:text-black"
        style={{ backgroundColor: BRAND_TEAL }}
      >
        {badge}
      </span>
    )}
  </TabsTrigger>
);

/* ------------------------------------------------------------------ */
/* Section divider label (used to break up long pages instead of      */
/* cramming everything into one screen)                               */
/* ------------------------------------------------------------------ */

export const AdminSectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-3">
    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
      {children}
    </span>
    <span className="h-px flex-1 bg-black/10" />
  </div>
);
