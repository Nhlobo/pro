import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

// One color per admin module — keep this list in sync with the pages using it.
export type AdminHeaderColor =
  | 'teal' | 'blue' | 'indigo' | 'emerald' | 'cyan' | 'sky' | 'violet'
  | 'amber' | 'fuchsia' | 'rose' | 'green' | 'lime' | 'purple'
  | 'orange' | 'red' | 'pink' | 'slate';

const COLOR_STYLES: Record<AdminHeaderColor, { icon: string; iconBg: string; title: string }> = {
  teal:    { icon: 'text-teal-600',    iconBg: 'bg-teal-50',    title: 'text-teal-700' },
  blue:    { icon: 'text-blue-600',    iconBg: 'bg-blue-50',    title: 'text-blue-700' },
  indigo:  { icon: 'text-indigo-600',  iconBg: 'bg-indigo-50',  title: 'text-indigo-700' },
  emerald: { icon: 'text-emerald-600', iconBg: 'bg-emerald-50', title: 'text-emerald-700' },
  cyan:    { icon: 'text-cyan-600',    iconBg: 'bg-cyan-50',    title: 'text-cyan-700' },
  sky:     { icon: 'text-sky-600',     iconBg: 'bg-sky-50',     title: 'text-sky-700' },
  violet:  { icon: 'text-violet-600',  iconBg: 'bg-violet-50',  title: 'text-violet-700' },
  amber:   { icon: 'text-amber-600',   iconBg: 'bg-amber-50',   title: 'text-amber-700' },
  fuchsia: { icon: 'text-fuchsia-600', iconBg: 'bg-fuchsia-50', title: 'text-fuchsia-700' },
  rose:    { icon: 'text-rose-600',    iconBg: 'bg-rose-50',    title: 'text-rose-700' },
  green:   { icon: 'text-green-600',   iconBg: 'bg-green-50',   title: 'text-green-700' },
  lime:    { icon: 'text-lime-600',    iconBg: 'bg-lime-50',    title: 'text-lime-700' },
  purple:  { icon: 'text-purple-600',  iconBg: 'bg-purple-50',  title: 'text-purple-700' },
  orange:  { icon: 'text-orange-600',  iconBg: 'bg-orange-50',  title: 'text-orange-700' },
  red:     { icon: 'text-red-600',     iconBg: 'bg-red-50',     title: 'text-red-700' },
  pink:    { icon: 'text-pink-600',    iconBg: 'bg-pink-50',    title: 'text-pink-700' },
  slate:   { icon: 'text-slate-600',   iconBg: 'bg-slate-50',   title: 'text-slate-700' },
};

interface AdminPageHeaderProps {
  /** Page title, e.g. "Access & Identity Management" */
  title: string;
  /** Short subtitle shown under the title */
  description?: string;
  /** Icon shown in the colored badge next to the title */
  icon: React.ComponentType<{ className?: string }>;
  /** Accent color for this page — pick one per module so staff recognize pages at a glance */
  color: AdminHeaderColor;
  /** Hide the "Back to Dashboard" button — use this on the Operations Dashboard itself */
  hideBackButton?: boolean;
}

/**
 * Shared header for every admin portal page.
 * Keeps title/description layout, icon badge color, and the
 * "Back to Dashboard" button consistent (always same position) across pages.
 */
const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  title,
  description,
  icon: Icon,
  color,
  hideBackButton,
}) => {
  const navigate = useNavigate();
  const styles = COLOR_STYLES[color];

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            styles.iconBg
          )}
        >
          <Icon className={cn('h-5 w-5', styles.icon)} />
        </div>
        <div className="min-w-0">
          <h1 className={cn('truncate text-xl font-bold md:text-2xl', styles.title)}>
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      {!hideBackButton && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/admin')}
          className="shrink-0 gap-1.5"
        >
          <LayoutDashboard className="h-4 w-4" />
          <span className="hidden sm:inline">Back to Dashboard</span>
        </Button>
      )}
    </div>
  );
};

export default AdminPageHeader;
