import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Shield, Briefcase, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';

const PortalSwitcher: React.FC = () => {
  const { isAdmin, isReferringAttorney, userRole } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const portals = [
    {
      id: 'admin',
      label: 'Admin',
      icon: Shield,
      path: '/admin',
      visible: isAdmin() || userRole === 'employee' || userRole === 'sales_consultant',
    },
    {
      id: 'attorney',
      label: 'Attorney',
      icon: Briefcase,
      path: '/attorney-portal',
      visible: isReferringAttorney(),
    },
    {
      id: 'expert',
      label: 'Expert',
      icon: Stethoscope,
      path: '/expert-portal',
      visible: false, // Future: userRole === 'expert'
    },
  ].filter(p => p.visible);

  if (portals.length <= 1) return null;

  const activePortal = portals.find(p => location.pathname.startsWith(p.path));

  return (
    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
      {portals.map((portal) => {
        const isActive = activePortal?.id === portal.id;
        return (
          <Button
            key={portal.id}
            variant="ghost"
            size="sm"
            onClick={() => navigate(portal.path)}
            className={cn(
              "gap-1.5 text-xs font-medium transition-all",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <portal.icon className="h-3.5 w-3.5" />
            {portal.label}
          </Button>
        );
      })}
    </div>
  );
};

export default PortalSwitcher;
