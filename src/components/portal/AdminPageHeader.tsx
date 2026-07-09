// src/components/portal/AdminPageHeader.tsx
import React from 'react';
import type { LucideIcon } from 'lucide-react';

const BRAND_TEAL = '#00BAAD';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Retained for backward compatibility with existing call sites; no longer
   *  changes the visual style — every Admin Portal header now shares the
   *  same flat black/white/teal treatment. */
  color?: string;
  actions?: React.ReactNode;
}

const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({ title, description, icon: Icon, actions }) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/5">
            <Icon className="h-5 w-5" style={{ color: BRAND_TEAL }} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-black md:text-2xl">{title}</h1>
          {description && <p className="text-xs text-slate-500 md:text-sm">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
};

export default AdminPageHeader;
