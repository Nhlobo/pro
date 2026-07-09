import React from 'react';
import type { LucideIcon } from 'lucide-react';

type HeaderColor =
  | 'orange'
  | 'blue'
  | 'green'
  | 'purple'
  | 'red'
  | 'teal'
  | 'yellow'
  | 'pink'
  | 'gray';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  color?: HeaderColor;
  actions?: React.ReactNode;
}

const ACCENT_CLASSES: Record<HeaderColor, string> = {
  orange: 'text-orange-600 bg-orange-50 border-orange-200',
  blue: 'text-sky-600 bg-sky-50 border-sky-200',
  green: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  purple: 'text-violet-600 bg-violet-50 border-violet-200',
  red: 'text-red-600 bg-red-50 border-red-200',
  teal: 'text-[#00BAAD] bg-[#00BAAD]/10 border-[#00BAAD]/25',
  yellow: 'text-amber-700 bg-amber-50 border-amber-200',
  pink: 'text-pink-600 bg-pink-50 border-pink-200',
  gray: 'text-neutral-700 bg-neutral-50 border-neutral-200',
};

const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  title,
  description,
  icon: Icon,
  color = 'teal',
  actions,
}) => {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-black/10 bg-white px-4 py-5 shadow-[0_18px_60px_-45px_rgba(0,0,0,0.55)] sm:px-6">
      <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 -translate-y-1/2 translate-x-1/3 rounded-full bg-[#00BAAD]/10 blur-2xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          {Icon && (
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${ACCENT_CLASSES[color]}`}>
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#00BAAD]">Admin Portal</div>
            <h1 className="mt-1 break-words text-2xl font-black tracking-tight text-black sm:text-3xl">{title}</h1>
            {description && (
              <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </section>
  );
};

export default AdminPageHeader;
