// src/components/admin/ui/AdminUI.tsx
import React from 'react';
import { cn } from '@/lib/utils';
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
