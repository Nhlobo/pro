import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import PortalSwitcher from './PortalSwitcher';
import { StaffNotificationBell } from '@/components/StaffNotificationBell';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Stethoscope,
  MapPin,
  Scale,
  FileText,
  FolderLock,
  Calendar,
  BarChart3,
  ShieldCheck,
  HeadsetIcon,
  LogOut,
  User,
  ChevronLeft,
  Menu,
  ChevronDown,
  Settings,
  Building2,
  Mail
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const logoSrc = '/lovable-uploads/7401e32a-2457-4a00-9d60-c1ff9fcfc4fc.png';

interface AdminPortalLayoutProps {
  children: React.ReactNode;
}

import { ADMIN_MODULES, ADMIN_MODULE_GROUP_ORDER, type AdminModuleGroup } from '@/config/adminModules';
import { useFunctionPermissionIndexCheck } from '@/hooks/useFunctionPermissionIndexCheck';
import { useModuleAccess } from '@/hooks/useModuleAccess';

const PAGE_TITLE_BY_PATH: Record<string, string> = ADMIN_MODULES.reduce(
  (acc, m) => ({ ...acc, [m.href]: m.title }),
  {} as Record<string, string>
);

function resolvePageTitle(pathname: string): string {
  if (PAGE_TITLE_BY_PATH[pathname]) return PAGE_TITLE_BY_PATH[pathname];
  // Longest-prefix match for nested routes
  const match = Object.keys(PAGE_TITLE_BY_PATH)
    .filter((href) => href !== '/admin' && pathname.startsWith(href + '/'))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_TITLE_BY_PATH[match] : 'Admin';
}

import SalesConsultantDeleteGuard from './SalesConsultantDeleteGuard';
import InternalChatWidget from '@/components/internalChat/InternalChatWidget';
import BrandedPageLoader from '@/components/BrandedPageLoader';

export const AdminPortalLayout: React.FC<AdminPortalLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { isAdmin, isSalesConsultant, userRole, loading } = usePermissions();
  const {
    loading: moduleAccessLoading,
    canAccessModule,
    canAccessPath,
    accessibleModules,
    homeModule,
    homeHref,
  } = useModuleAccess();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Admin-only schema verification — alerts if function_permissions unique
  // indexes would re-introduce NULL-conflict duplicate-row behaviour.
  useFunctionPermissionIndexCheck(!loading && userRole === 'admin');

  // Close the mobile drawer whenever the route changes
  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Single source of truth for "can this user be here": the same grant
  // check (useModuleAccess -> @/lib/moduleAccess) that decides what shows
  // up in the sidebar below. A user who isn't provisioned for the current
  // page at all (no matching role) or who's had the admin-configured
  // permission for it revoked is sent to their own home base — not a
  // hand-maintained list of routes that can quietly drift out of sync
  // with what Manage Permissions actually grants.
  const accessReady = !loading && !moduleAccessLoading;
  const hasAccess = accessReady && canAccessPath(location.pathname);

  React.useEffect(() => {
    if (!accessReady) return;
    if (hasAccess) return;
    navigate(homeHref, { replace: true });
  }, [accessReady, hasAccess, homeHref, navigate]);

  if (loading || moduleAccessLoading) {
    return <BrandedPageLoader message="Loading…" />;
  }

  // Don't render the page underneath while we're redirecting away from it
  // — otherwise a restricted screen (and whatever data it fetches) would
  // flash on screen for a frame before the effect above kicks in.
  if (!hasAccess) {
    return <BrandedPageLoader message="Loading…" />;
  }

  const visibleGroups = ADMIN_MODULE_GROUP_ORDER.map((group: AdminModuleGroup) => ({
    label: group,
    items: accessibleModules
      .filter((m) => m.group === group)
      .map((m) => ({ title: m.title, href: m.href, icon: m.icon })),
  })).filter((g) => g.items.length > 0);

  const roleLabel =
    userRole === 'sales_consultant' ? 'Sales Consultant'
    : userRole === 'employee' ? 'Company Employee'
    : userRole === 'finance' ? 'Finance'
    : userRole === 'director' ? 'Director'
    : 'Administrator';

  // Header title next to the logo — was hardcoded to "Admin Portal" for
  // every role, so finance/director/sales staff saw a label that didn't
  // match who they actually are. Now reflects the signed-in role, same
  // as the roleLabel shown under their email below.
  const portalTitle =
    userRole === 'sales_consultant' ? 'Sales Portal'
    : userRole === 'employee' ? 'Employee Portal'
    : userRole === 'finance' ? 'Finance Portal'
    : userRole === 'director' ? 'Director Portal'
    : 'Admin Portal';

  return (
    <div className="flex min-h-screen bg-background">
      {isSalesConsultant() && <SalesConsultantDeleteGuard />}

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
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col overflow-hidden gradient-nav text-white shadow-xl transition-all duration-300",
          // Width
          sidebarCollapsed ? "w-16" : "w-64",
          // Mobile: slide in/out; Desktop: always visible
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0"
        )}
      >
        {/* Ambient glow accents to match the auth brand panel */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex h-full min-h-0 flex-col">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-white/15 px-4">
            {!sidebarCollapsed && (
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 p-1 ring-2 ring-white/30">
                  <img src={logoSrc} alt="Kutlwano & Associate" className="h-full w-full object-contain" />
                </div>
                <span className="truncate font-semibold text-sm">{portalTitle}</span>
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
              className={cn(
                "h-8 w-8 shrink-0 text-white/90 hover:bg-white/15 hover:text-white",
                sidebarCollapsed && "mx-auto"
              )}
              aria-label="Toggle sidebar"
            >
              {sidebarCollapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          {/* Navigation */}
          <ScrollArea className="min-h-0 flex-1 py-2">
            {visibleGroups.map((group) => (
              <Collapsible key={group.label} defaultOpen className="mb-1 px-2">
                {!sidebarCollapsed && (
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/60 hover:text-white/85">
                    <span className="truncate">{group.label}</span>
                    <ChevronDown className="h-3 w-3 shrink-0" />
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
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                            isActive
                              ? "bg-white text-[#0F7A9C] shadow-sm"
                              : "text-white/80 hover:bg-white/15 hover:text-white",
                            sidebarCollapsed && "justify-center px-2"
                          )}
                          title={sidebarCollapsed ? item.title : undefined}
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          {!sidebarCollapsed && <span className="truncate">{item.title}</span>}
                        </Link>
                      );
                    })}
                  </nav>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </ScrollArea>

          {/* User section */}
          <div className="shrink-0 border-t border-white/15 p-3">
            <div className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
              sidebarCollapsed && "justify-center px-2"
            )}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">
                <User className="h-4 w-4" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="truncate text-xs font-medium">{user?.email}</p>
                  <p className="truncate text-[10px] text-white/70">{roleLabel}</p>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size={sidebarCollapsed ? "icon" : "default"}
              className={cn(
                "mt-1 w-full text-white/80 hover:bg-white/15 hover:text-white",
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

        {/* Top bar — the same branded teal/blue gradient on every admin page,
            Operations Dashboard included, so the whole portal shares one
            header instead of Operations Dashboard having its own separate,
            search-bar version. */}
        <header className="sticky top-0 z-30 gradient-nav text-white shadow-md">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-3 py-3 sm:gap-3 sm:px-4 sm:py-4 lg:px-6">
            {/* Row 1: eyebrow + right actions (back, notifications) */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/85 sm:text-xs sm:tracking-[0.28em]">
                  Medico-Legal Pro
                </div>
                <h1
                  className="mt-0.5 break-words font-bold leading-tight text-white
                             text-[clamp(1.15rem,5.5vw,2rem)] sm:text-[clamp(1.4rem,3.5vw,2.25rem)]"
                  title={resolvePageTitle(location.pathname)}
                >
                  {resolvePageTitle(location.pathname)}
                </h1>
              </div>

              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                {/* Targets this user's actual home base — Operations
                    Dashboard for admin/employee, but their own landing
                    module (Sales Dashboard, Finance & Payments, …) for
                    roles that can't reach /admin at all. Hidden on that
                    home page itself, since "back to X" makes no sense
                    while already on X. */}
                {homeModule && location.pathname !== homeHref && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(homeHref)}
                    className="shrink-0 gap-1 border border-white/30 bg-white/10 px-2 text-white hover:bg-white/20 hover:text-white sm:px-3"
                    aria-label={`Back to ${homeModule.title}`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden text-xs font-semibold uppercase tracking-wide sm:inline">
                      {homeModule.title}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide sm:hidden">Back</span>
                  </Button>
                )}
                <div className="hidden md:block"><PortalSwitcher /></div>
                <StaffNotificationBell />
              </div>
            </div>

            {/* Row 2: bottom-left hamburger (opens sidebar drawer on mobile/tablet) */}
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 border border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={mobileOpen}
                aria-controls="admin-mobile-sidebar"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="hidden lg:block" />
              <div className="h-0.5 flex-1 rounded-full bg-white/15" />
            </div>
          </div>
        </header>


        <div className="min-w-0 p-3 sm:p-4 lg:p-6">{children}</div>
      </main>
      <InternalChatWidget />
    </div>
  );
};

export default AdminPortalLayout;
