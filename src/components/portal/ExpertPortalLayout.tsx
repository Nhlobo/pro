import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import PortalSwitcher from './PortalSwitcher';
import {
  Stethoscope, LayoutDashboard, Briefcase, Calendar, BarChart3, User, FileText, LogOut
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import TourLauncher from '@/components/tour/TourLauncher';
import { EXPERT_TOUR, EXPERT_TOUR_KEY } from '@/config/tours';
import MFARequiredGuard from '@/components/MFARequiredGuard';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/expert-portal', icon: LayoutDashboard },
  { label: 'My Cases', path: '/expert-portal/cases', icon: Briefcase },
  { label: 'Schedule', path: '/expert-portal/schedule', icon: Calendar },
  { label: 'Reports', path: '/expert-portal/reports', icon: FileText },
  { label: 'Performance', path: '/expert-portal/performance', icon: BarChart3 },
  { label: 'Profile', path: '/expert-portal/profile', icon: User },
];

const ExpertPortalLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <MFARequiredGuard roleLabel="Medical Expert">
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              <span className="font-bold text-foreground text-sm">Expert Portal</span>
            </div>
            <PortalSwitcher />
          </div>
          <div className="flex items-center gap-1">
            <TourLauncher steps={EXPERT_TOUR} storageKey={EXPERT_TOUR_KEY} compact />
            <Button variant="ghost" size="sm" onClick={() => signOut()} className="text-muted-foreground">
              <LogOut className="h-4 w-4 mr-1" /> Sign Out
            </Button>
          </div>
        </div>
        {/* Nav */}
        <nav data-tour="expert-nav" className="flex items-center gap-1 px-4 pb-2 overflow-x-auto">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Button
                key={item.path}
                variant="ghost"
                size="sm"
                onClick={() => navigate(item.path)}
                className={cn(
                  "gap-1.5 text-xs font-medium shrink-0",
                  isActive
                    ? "bg-primary/10 text-primary border-b-2 border-primary rounded-b-none"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Button>
            );
          })}
        </nav>
      </header>

      {/* Content */}
      <main className="p-4 md:p-6 max-w-[1400px] mx-auto">
        {children}
      </main>
    </div>
    </MFARequiredGuard>
  );
};

export default ExpertPortalLayout;
