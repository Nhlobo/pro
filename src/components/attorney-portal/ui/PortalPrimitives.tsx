import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ChevronRight, LucideIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Shared building blocks for the redesigned Attorney Portal.
 *
 * Rules this file encodes (so every page that adopts it looks and behaves
 * the same way, instead of each page inventing its own card/spacing):
 *  - One page-level heading pattern (`PortalPageHeader`).
 *  - One content-container width/gutter rhythm — pages should not add their
 *    own outer max-width; that lives in `AttorneyPortalLayout`.
 *  - One KPI tile shape (`StatTile`) — border-led, not shadow-led, so a grid
 *    of 8 of them reads as one systematic instrument panel, not 8 separate
 *    "cards" competing for attention.
 *  - One section wrapper (`PortalSection`) with a consistent header row.
 *  - One compact list-row shape (`QuickLinkRow`) for secondary navigation,
 *    replacing ad-hoc full-size cards for what is really a linked list.
 *
 * Everything here reads existing design tokens (bg-card, border-border,
 * text-muted-foreground, the brand + semantic colors already defined in
 * index.css) rather than inventing new colors, so it matches the system
 * without being a re-skin of the old gradient/shadow-heavy cards.
 */

export type PortalTone =
  | 'primary'
  | 'info'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'teal'
  | 'purple'
  | 'neutral';

const TONE_TEXT: Record<PortalTone, string> = {
  primary: 'text-primary',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  teal: 'text-kutlwano-teal',
  purple: 'text-kutlwano-purple',
  neutral: 'text-foreground',
};

const TONE_BORDER: Record<PortalTone, string> = {
  primary: 'border-l-primary',
  info: 'border-l-info',
  success: 'border-l-success',
  warning: 'border-l-warning',
  destructive: 'border-l-destructive',
  teal: 'border-l-kutlwano-teal',
  purple: 'border-l-kutlwano-purple',
  neutral: 'border-l-border',
};

const TONE_BG: Record<PortalTone, string> = {
  primary: 'bg-primary/10',
  info: 'bg-info/10',
  success: 'bg-success/10',
  warning: 'bg-warning/10',
  destructive: 'bg-destructive/10',
  teal: 'bg-kutlwano-teal/10',
  purple: 'bg-kutlwano-purple/10',
  neutral: 'bg-muted',
};

/* -------------------------------------------------------------------- */
/* Page header                                                          */
/* -------------------------------------------------------------------- */

interface PortalPageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export const PortalPageHeader: React.FC<PortalPageHeaderProps> = ({
  eyebrow,
  title,
  description,
  actions,
}) => (
  <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {eyebrow && (
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {eyebrow}
        </div>
      )}
      <h1 className="mt-0.5 text-2xl font-bold leading-tight text-foreground sm:text-[1.75rem]">
        {title}
      </h1>
      {description && (
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      )}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

/* -------------------------------------------------------------------- */
/* Refresh / sync indicator — small, reusable, so every page can show   */
/* live-data status the same way instead of a bespoke spinner each time */
/* -------------------------------------------------------------------- */

interface SyncStatusProps {
  loading?: boolean;
  onRefresh?: () => void;
  label?: string;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ loading, onRefresh, label = 'Live data' }) => (
  <div className="flex items-center gap-2 text-xs text-muted-foreground">
    <span className="flex items-center gap-1.5">
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          loading ? 'bg-warning animate-pulse' : 'bg-success'
        )}
        aria-hidden="true"
      />
      {loading ? 'Syncing…' : label}
    </span>
    {onRefresh && (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
/* KPI stat tile                                                        */
/* -------------------------------------------------------------------- */

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  description?: string;
  tone?: PortalTone;
  loading?: boolean;
  href?: string;
}

export const StatTile: React.FC<StatTileProps> = ({
  icon: Icon,
  label,
  value,
  description,
  tone = 'primary',
  loading,
  href,
}) => {
  const content = (
    <div
      className={cn(
        'group relative flex h-full flex-col justify-between border border-border border-l-2 bg-card px-4 py-3.5 transition-colors',
        TONE_BORDER[tone],
        href && 'hover:bg-muted/40'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center', TONE_BG[tone])}>
          <Icon className={cn('h-3.5 w-3.5', TONE_TEXT[tone])} />
        </div>
      </div>
      <div className="mt-2">
        <div className={cn('text-2xl font-bold leading-none tabular-nums', TONE_TEXT[tone])}>
          {loading ? <span className="inline-block h-6 w-12 animate-pulse rounded-sm bg-muted" /> : value}
        </div>
        {description && (
          <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link to={href} className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {content}
      </Link>
    );
  }
  return content;
};

/* -------------------------------------------------------------------- */
/* Section wrapper                                                      */
/* -------------------------------------------------------------------- */

interface PortalSectionProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  tone?: PortalTone;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const PortalSection: React.FC<PortalSectionProps> = ({
  icon: Icon,
  title,
  description,
  actions,
  tone = 'primary',
  children,
  className,
  noPadding,
}) => (
  <section className={cn('flex h-full flex-col border border-border bg-card', className)}>
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        {Icon && (
          <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center', TONE_BG[tone])}>
            <Icon className={cn('h-4 w-4', TONE_TEXT[tone])} />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
    <div className={cn('flex-1 min-h-0', !noPadding && 'p-4 sm:p-5')}>{children}</div>
  </section>
);

/* -------------------------------------------------------------------- */
/* Compact quick-link row (for lists of secondary destinations)         */
/* -------------------------------------------------------------------- */

interface QuickLinkRowProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  href: string;
  tone?: PortalTone;
  badge?: React.ReactNode;
}

export const QuickLinkRow: React.FC<QuickLinkRowProps> = ({
  icon: Icon,
  title,
  subtitle,
  href,
  tone = 'primary',
  badge,
}) => (
  <Link
    to={href}
    className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 transition-colors hover:bg-muted/40 sm:px-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
  >
    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center', TONE_BG[tone])}>
      <Icon className={cn('h-4 w-4', TONE_TEXT[tone])} />
    </div>
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-medium text-foreground">{title}</div>
      <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
    </div>
    {badge}
    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
  </Link>
);

/* -------------------------------------------------------------------- */
/* Inline alert strip (for "actions needed" style callouts)             */
/* -------------------------------------------------------------------- */

interface AlertStripProps {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: Extract<PortalTone, 'warning' | 'destructive' | 'info'>;
  action?: React.ReactNode;
}

export const AlertStrip: React.FC<AlertStripProps> = ({
  icon: Icon,
  title,
  description,
  tone = 'warning',
  action,
}) => (
  <div className={cn('flex flex-col gap-3 border border-l-2 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between', TONE_BORDER[tone])}>
    <div className="flex items-start gap-3">
      <div className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center', TONE_BG[tone])}>
        <Icon className={cn('h-4 w-4', TONE_TEXT[tone])} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
    {action && <div className="shrink-0 pl-10 sm:pl-0">{action}</div>}
  </div>
);
