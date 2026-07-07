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

const COLOR_CLASSES: Record<HeaderColor, string> = {
  orange: 'bg-orange-100 text-orange-600',
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  purple: 'bg-purple-100 text-purple-600',
  red: 'bg-red-100 text-red-600',
  teal: 'bg-teal-100 text-teal-600',
  yellow: 'bg-yellow-100 text-yellow-700',
  pink: 'bg-pink-100 text-pink-600',
  gray: 'bg-gray-100 text-gray-600',
};

const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  title,
  description,
  icon: Icon,
  color = 'blue',
  actions,
}) => {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${COLOR_CLASSES[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
};

export default AdminPageHeader;
