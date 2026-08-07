import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useExternalPortalSession } from '@/hooks/externalPortal/useExternalPortalSession';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  Briefcase,
  Activity,
  Calendar,
  FileText,
  CreditCard,
  FileSignature,
  Bell,
  HeadsetIcon,
  LogOut,
  User,
  ChevronLeft,
  Menu
} from 'lucide-react';
import { useState } from 'react';
import TourLauncher from '@/components/tour/TourLauncher';
import RouteFirstVisitTour from '@/components/tour/RouteFirstVisitTour';
import { ATTORNEY_TOUR, ATTORNEY_TOUR_KEY } from '@/config/tours';
import { ATTORNEY_PAGE_TOURS } from '@/config/pageTours';

// NOTE: This portal is authenticated entirely through the External
// Portal Module's own OTP/access-link session (see
// useExternalPortalSession) — these are external referring attorneys,
// not internal Supabase-auth staff. MFARequiredGuard and usePermissions
// were built for the internal app's Supabase-auth users and don't apply
// here; OTP verification is this portal's second factor.

interface AttorneyPortalLayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  {
    title: 'Dashboard',
    href: '/attorney-portal',
    icon: LayoutDashboard,
  },
  {
    title: 'My Cases',
    href: '/attorney-portal/cases',
    icon: Briefcase,
  },
  {
    title: 'View Case Status',
    href: '/attorney-portal/case-status',
    icon: Activity,
  },
  {
    title: 'Appointments',
    href: '/attorney-portal/appointments',
    icon: Calendar,
    unavailable: true,
  },
  {
    title: 'Reports',
    href: '/attorney-portal/reports',
    icon: FileText,
  },
  {
    title: 'AOD & Payments',
    href: '/attorney-portal/payments',
    icon: CreditCard,
    unavailable: true,
  },
  {
    title: 'Agreements',
    href: '/attorney-portal/agreements',
    icon: FileSignature,
    unavailable: true,
  },
  {
    title: 'Notifications',
    href: '/attorney-portal/notifications',
    icon: Bell,
    unavailable: true,
  },
  {
    title: 'Support',
    href: '/attorney-portal/support',
    icon: HeadsetIcon,
  },
];

export const AttorneyPortalLayout: React.FC<AttorneyPortalLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, clearSession } = useExternalPortalSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleSignOut = async () => {
    await clearSession();
    navigate('/external-portal/sign-in', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <RouteFirstVisitTour routes={ATTORNEY_PAGE_TOURS} />
      {/* Sidebar */}
      <aside
        data-tour="attorney-sidebar"
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-border bg-card transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo/Header */}
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-semibold text-foreground">Attorney Portal</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="h-8 w-8"
            >
              {sidebarCollapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 px-3 py-4">
            <nav className="space-y-2">
              {navigationItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      sidebarCollapsed && "justify-center px-2"
                    )}
                    title={sidebarCollapsed ? item.title : undefined}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!sidebarCollapsed && (
                      <span className="flex flex-1 items-center justify-between gap-2">
                        {item.title}
                        {item.unavailable && (
                          <Badge variant="outline" className="text-[10px] font-normal">Soon</Badge>
                        )}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>

          {/* User section */}
          <div className="border-t border-border p-3">
            <div className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
              sidebarCollapsed && "justify-center px-2"
            )}>
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-medium text-foreground truncate">
                    {session?.full_name || session?.email}
                  </p>
                  <p className="text-xs text-muted-foreground">Referring Attorney</p>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size={sidebarCollapsed ? "icon" : "default"}
              className={cn(
                "w-full mt-2 text-muted-foreground hover:text-destructive",
                sidebarCollapsed && "px-2"
              )}
              onClick={handleSignOut}
              title={sidebarCollapsed ? "Sign Out" : undefined}
            >
              <LogOut className="h-4 w-4" />
              {!sidebarCollapsed && <span className="ml-2">Sign Out</span>}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          sidebarCollapsed ? "ml-16" : "ml-64"
        )}
      >
        <div className="p-6 lg:p-8">
          <div className="flex justify-end mb-2">
            <TourLauncher steps={ATTORNEY_TOUR} storageKey={ATTORNEY_TOUR_KEY} />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
};

export default AttorneyPortalLayout;
