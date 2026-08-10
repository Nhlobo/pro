import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BRAND_TEAL } from '@/components/admin/ui/AdminUI';

/**
 * Shared building blocks for the redesigned Attorney Portal.
 *
 * This is the Attorney Portal's version of `admin/ui/AdminUI.tsx` — same
 * design system, not a new one: flat black/white surfaces, hairline
 * `border-black/10`, sharp corners (no rounding), and a single teal accent
 * (`BRAND_TEAL`, imported from AdminUI so the two portals literally share
 * one color constant). Color beyond that is semantic only — success/
 * warning/destructive are used for real state (overdue, ready, at risk),
 * never as decoration or category coding. That mirrors exactly how
 * AdminStatCard / AdminOperationsDashboard already behave; this file just
 * gives the Attorney Portal the same primitives so its pages don't drift
 * from that system the way the first pass did.
 */

/* -------------------------------------------------------------------- */
/* Page shell / header                                                  */
/* -------------------------------------------------------------------- */

export const PortalPage: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => <div className={cn('space-y-4 md:space-y-6', className)}>{children}</div>;

interface PortalHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

export const PortalHeader: React.FC<PortalHeaderProps> = ({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
}) => (
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

/* -------------------------------------------------------------------- */
/* Sync / refresh indicator                                             */
/* -------------------------------------------------------------------- */

interface SyncStatusProps {
  loading?: boolean;
  onRefresh?: () => void;
  label?: string;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ loading, onRefresh, label = 'Live data' }) => (
  <div className="flex items-center gap-2 text-xs text-slate-500">
    <span className="flex items-center gap-1.5">
      <span
        className={cn('h-1.5 w-1.5 rounded-full', loading ? 'bg-amber-500 animate-pulse' : 'bg-success')}
        aria-hidden="true"
      />
      {loading ? 'Syncing…' : label}
    </span>
    {onRefresh && (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-none text-slate-500 hover:bg-black/5 hover:text-black"
        onClick={onRefresh}
        disabled={loading}
        aria-label="Refresh data"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
      </Button>
    )}
  </div>
);

/* -------------------------------------------------------------------- */
/* Card                                                                  */
/* -------------------------------------------------------------------- */

export const PortalCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn('rounded-none border border-black/10 bg-white shadow-none', className)}
    {...props}
  />
);

export const PortalCardHeader: React.FC<{
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

export const PortalCardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn('p-4', className)} {...props} />;

/* -------------------------------------------------------------------- */
/* KPI stat card — single teal accent, no category color-coding         */
/* -------------------------------------------------------------------- */

interface PortalStatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: React.ReactNode;
  loading?: boolean;
  href?: string;
  /** Only for genuinely urgent/at-risk numbers (e.g. overdue balance). */
  urgent?: boolean;
}

export const PortalStatCard: React.FC<PortalStatCardProps> = ({
  label,
  value,
  icon: Icon,
  hint,
  loading,
  href,
  urgent,
}) => {
  const valueText = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const valueLen = valueText.replace(/\s/g, '').length;
  const valueSizeClass =
    valueLen > 14 ? 'text-base md:text-lg' : valueLen > 10 ? 'text-lg md:text-xl' : 'text-xl md:text-2xl';

  const inner = (
    <div className="min-w-0 px-3 pb-3 pt-3 md:px-4">
      <div className="mb-2 flex items-center justify-between">
        {Icon && (
          <div className="rounded-full bg-black/5 p-1.5 md:p-2">
            <Icon className={cn('h-4 w-4', urgent && 'text-destructive')} style={urgent ? undefined : { color: BRAND_TEAL }} />
          </div>
        )}
      </div>
      <p
        className={cn(
          'font-bold tabular-nums leading-tight break-words [overflow-wrap:anywhere]',
          urgent ? 'text-destructive' : 'text-black',
          valueSizeClass
        )}
        title={valueText || undefined}
      >
        {loading ? '–' : value}
      </p>
      <p className="text-[11px] leading-tight text-slate-500">{label}</p>
      {hint && <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p>}
    </div>
  );

  return (
    <PortalCard
      className={cn(
        'min-w-0 overflow-hidden transition-colors hover:border-black/25',
        href && 'cursor-pointer'
      )}
    >
      {href ? (
        <Link to={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </PortalCard>
  );
};

/* -------------------------------------------------------------------- */
/* Pill (status label — used sparingly, for real status only)           */
/* -------------------------------------------------------------------- */

export type PortalPillTone = 'neutral' | 'teal' | 'success' | 'warning' | 'destructive';

const PILL_TONE_CLASSES: Record<PortalPillTone, string> = {
  neutral: 'border-black/15 text-black',
  teal: 'border-[#00BAAD]/40 text-[#00BAAD]',
  success: 'border-success/40 text-success',
  warning: 'border-warning/40 text-warning',
  destructive: 'border-destructive/40 text-destructive',
};

export const PortalPill: React.FC<{
  children: React.ReactNode;
  tone?: PortalPillTone;
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

/* -------------------------------------------------------------------- */
/* Compact quick-link row (for lists of secondary destinations)         */
/* -------------------------------------------------------------------- */

interface QuickLinkRowProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  href: string;
  badge?: React.ReactNode;
}

export const QuickLinkRow: React.FC<QuickLinkRowProps> = ({ icon: Icon, title, subtitle, href, badge }) => (
  <Link
    to={href}
    className="flex items-center gap-3 border-b border-black/10 px-4 py-3 last:border-b-0 transition-colors hover:bg-black/5 sm:px-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
  >
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/5">
      <Icon className="h-4 w-4" style={{ color: BRAND_TEAL }} />
    </div>
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-medium text-black">{title}</div>
      <div className="truncate text-xs text-slate-500">{subtitle}</div>
    </div>
    {badge}
    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
  </Link>
);

/* -------------------------------------------------------------------- */
/* Alert strip — for "action needed" callouts. Warning/destructive only,*/
/* used because it's true, not as page decoration.                      */
/* -------------------------------------------------------------------- */

interface AlertStripProps {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: 'warning' | 'destructive';
  action?: React.ReactNode;
}

export const AlertStrip: React.FC<AlertStripProps> = ({ icon: Icon, title, description, tone = 'warning', action }) => (
  <div
    className={cn(
      'flex flex-col gap-3 rounded-none border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
      tone === 'destructive' ? 'border-destructive/30' : 'border-warning/30'
    )}
  >
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/5">
        <Icon className={cn('h-4 w-4', tone === 'destructive' ? 'text-destructive' : 'text-warning')} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-black">{title}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
    {action && <div className="shrink-0 pl-10 sm:pl-0">{action}</div>}
  </div>
);

/* -------------------------------------------------------------------- */
/* Empty / loading states                                               */
/* -------------------------------------------------------------------- */

export const PortalEmptyState: React.FC<{
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

export const PortalLoadingState: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center px-4 py-12 text-sm text-slate-500">
    <span
      className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/15 border-t-[#00BAAD]"
      aria-hidden="true"
    />
    {label}
  </div>
);
