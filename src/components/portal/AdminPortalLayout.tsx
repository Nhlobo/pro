import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import PortalSwitcher from './PortalSwitcher';
import { NotificationCenter } from '@/components/NotificationCenter';
import TourLauncher from '@/components/tour/TourLauncher';
import RouteFirstVisitTour from '@/components/tour/RouteFirstVisitTour';
import { ADMIN_TOUR, ADMIN_TOUR_KEY } from '@/config/tours';
import { ADMIN_PAGE_TOURS } from '@/config/pageTours';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Stethoscope,
  MapPin,
  Scale,
  FileText,
  FolderLock,
  DollarSign,
  Calendar,
  BarChart3,
  ShieldCheck,
  HeadsetIcon,
  LogOut,
  User,
  ChevronLeft,
  Menu,
  Search,
  ChevronDown,
  Settings,
  Building2,
  Mail,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface AdminPortalLayoutProps {
  children: React.ReactNode;
}

// Roles allowed per nav item. `undefined` = admin/employee only (default).
type NavItem = { title: string; href: string; icon: any; roles?: string[] };
type NavGroup = { label: string; items: NavItem[] };

import { getNavigationGroups } from '@/config/adminModules';
import { useFunctionPermissionIndexCheck } from '@/hooks/useFunctionPermissionIndexCheck';

const navigationGroups: NavGroup[] = getNavigationGroups();

import SalesConsultantDeleteGuard from './SalesConsultantDeleteGuard';

export const AdminPortalLayout: React.FC<AdminPortalLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { isAdmin, isSalesConsultant, userRole, loading } = usePermissions();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Admin-only schema verification — alerts if function_permissions unique
  // indexes would re-introduce NULL-conflict duplicate-row behaviour.
  useFunctionPermissionIndexCheck(!loading && userRole === 'admin');

  // Close the mobile drawer whenever the route changes
  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Routes a sales_consultant is allowed to view inside the admin portal
  const SC_ALLOWED = ['/admin/appointments', '/admin/finance', '/admin/attorney-crm', '/admin/heatmap', '/admin/my-profile'];
  const isAllowedForSC = SC_ALLOWED.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'));

  // Routes restricted to administrators only — company employees cannot access
  const ADMIN_ONLY_ROUTES = ['/admin/analytics', '/admin/iam', '/admin/system-control'];
  const isAdminOnlyRoute = ADMIN_ONLY_ROUTES.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'));

  React.useEffect(() => {
    if (loading) return;
    if (userRole === 'admin') return;
    if (userRole === 'employee') {
      if (isAdminOnlyRoute) {
        navigate('/admin', { replace: true });
      }
      return;
    }
    if (isSalesConsultant()) {
      if (!isAllowedForSC) {
        navigate('/admin/appointments', { replace: true });
      }
      return;
    }
    navigate('/dashboard');
  }, [loading, userRole, isSalesConsultant, isAllowedForSC, isAdminOnlyRoute, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.roles) return isAdmin(); // admin/employee only
        return item.roles.includes(userRole || '');
      }),
    }))
    .filter((g) => g.items.length > 0);

  const roleLabel =
    userRole === 'sales_consultant' ? 'Sales Consultant'
    : userRole === 'employee' ? 'Company Employee'
    : 'Administrator';

  return (
    <div className="flex min-h-screen bg-background">
      {isSalesConsultant() && <SalesConsultantDeleteGuard />}
      <RouteFirstVisitTour routes={ADMIN_PAGE_TOURS} />


      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        data-tour="admin-sidebar"
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300",
          // Width
          sidebarCollapsed ? "w-16" : "w-64",
          // Mobile: slide in/out; Desktop: always visible
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
                  <span className="text-sidebar-primary-foreground font-bold text-sm">K&A</span>
                </div>
                <span className="font-semibold text-sm">Admin Portal</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                // On mobile, the same control closes the drawer
                if (window.innerWidth < 1024) {
                  setMobileOpen(false);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
              className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
              aria-label="Toggle sidebar"
            >
              {sidebarCollapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-2">
            {visibleGroups.map((group) => (
              <Collapsible key={group.label} defaultOpen className="px-2 mb-1">
                {!sidebarCollapsed && (
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-semibold hover:text-sidebar-foreground/70">
                    {group.label}
                    <ChevronDown className="h-3 w-3" />
                  </CollapsibleTrigger>
                )}
                <CollapsibleContent>
                  <nav className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                            sidebarCollapsed && "justify-center px-2"
                          )}
                          title={sidebarCollapsed ? item.title : undefined}
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          {!sidebarCollapsed && <span>{item.title}</span>}
                        </Link>
                      );
                    })}
                  </nav>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </ScrollArea>

          {/* User section */}
          <div className="border-t border-sidebar-border p-3">
            <div className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
              sidebarCollapsed && "justify-center px-2"
            )}>
              <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4" />
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-medium truncate">{user?.email}</p>
                  <p className="text-[10px] text-sidebar-foreground/60">{roleLabel}</p>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size={sidebarCollapsed ? "icon" : "default"}
              className={cn(
                "w-full mt-1 text-sidebar-foreground/70 hover:text-destructive hover:bg-sidebar-accent/50",
                sidebarCollapsed && "px-2"
              )}
              onClick={() => signOut()}
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
        id="main-content"
        className={cn(
          "flex-1 min-w-0 transition-all duration-300",
          // Mobile: full width (sidebar is drawer). Desktop: offset by sidebar width.
          "ml-0",
          sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
        )}
      >
        {/* Skip to content link — visible on keyboard focus */}
        <a href="#main-content" className="skip-link">Skip to main content</a>

        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-3 sm:px-4 lg:px-6 gap-2 sm:gap-4">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-11 w-11 shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="admin-mobile-sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1 min-w-0">
            <div className="relative w-full max-w-sm" data-tour="global-search">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <label htmlFor="admin-global-search" className="sr-only">Search</label>
              <input
                id="admin-global-search"
                type="search"
                placeholder="Search…"
                className="w-full pl-9 pr-3 h-10 text-sm bg-muted/50 border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
            </div>
          </div>
          <div className="hidden sm:block">
            <TourLauncher steps={ADMIN_TOUR} storageKey={ADMIN_TOUR_KEY} compact />
          </div>
          <div data-tour="portal-switcher" className="hidden md:block"><PortalSwitcher /></div>
          <div data-tour="notifications"><NotificationCenter /></div>
        </header>

        <div className="p-3 sm:p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
};

export default AdminPortalLayout;
