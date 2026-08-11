import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import PortalSwitcher from './PortalSwitcher';
import { NotificationCenter } from '@/components/NotificationCenter';
import {
  Stethoscope,
  LayoutDashboard,
  Briefcase,
  Calendar,
  BarChart3,
  User,
  FileText,
  LogOut,
  ChevronLeft,
  Menu,
  HeadsetIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import InternalChatWidget from '@/components/internalChat/InternalChatWidget';
import { useIsExternalPortalUser } from '@/hooks/useIsExternalPortalUser';
import BrandedPageLoader from '@/components/BrandedPageLoader';

const logoSrc = '/lovable-uploads/7401e32a-2457-4a00-9d60-c1ff9fcfc4fc.png';

const navigationItems = [
  { title: 'Dashboard', href: '/expert-portal', icon: LayoutDashboard },
  { title: 'My Cases', href: '/expert-portal/cases', icon: Briefcase },
  { title: 'Schedule', href: '/expert-portal/schedule', icon: Calendar },
  { title: 'Reports', href: '/expert-portal/reports', icon: FileText },
  { title: 'Performance', href: '/expert-portal/performance', icon: BarChart3 },
  { title: 'Profile', href: '/expert-portal/profile', icon: User },
  { title: 'Support', href: '/expert-portal/support', icon: HeadsetIcon },
];

const PAGE_TITLE_BY_PATH: Record<string, string> = navigationItems.reduce(
  (acc, item) => ({ ...acc, [item.href]: item.title }),
  {} as Record<string, string>,
);

function resolvePageTitle(pathname: string): string {
  if (PAGE_TITLE_BY_PATH[pathname]) return PAGE_TITLE_BY_PATH[pathname];
  const match = Object.keys(PAGE_TITLE_BY_PATH)
    .filter((href) => href !== '/expert-portal' && pathname.startsWith(href + '/'))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_TITLE_BY_PATH[match] : 'Expert Portal';
}

/**
 * Expert Portal shell.
 *
 * Rebuilt to share the exact same responsive shell as AdminPortalLayout /
 * AttorneyPortalLayout (mobile drawer sidebar, sticky branded header,
 * skip-link, lg: breakpoint offsets) instead of its own separate top-bar
 * design — previously all three portals looked and behaved differently
 * from one another. Medical experts should feel like they're in the same
 * real platform staff use, not a separate, lower-effort build.
 */
const ExpertPortalLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { loading } = usePermissions();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Internal chat is staff-to-staff communication — a real medical
  // expert logging in via link+OTP has no business seeing that bubble,
  // even though the server already prevents them from using it
  // (get_internal_chat_users only lists admin/employee/etc roles).
  const isExternalUser = useIsExternalPortalUser();

  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (loading) {
    return <BrandedPageLoader message="Loading…" />;
  }

  return (
    <div className="flex min-h-screen bg-background">
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
          sidebarCollapsed ? "w-16" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0"
        )}
      >
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
                <span className="truncate font-semibold text-sm">Expert Portal</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
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
          <ScrollArea className="min-h-0 flex-1 px-2 py-3">
            <nav className="space-y-0.5">
              {navigationItems.map((item) => {
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
          </ScrollArea>

          {/* User section */}
          <div className="shrink-0 border-t border-white/15 p-3">
            <div className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
              sidebarCollapsed && "justify-center px-2"
            )}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">
                <Stethoscope className="h-4 w-4" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="truncate text-xs font-medium">{user?.email}</p>
                  <p className="truncate text-[10px] text-white/70">Medical Expert</p>
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
          "ml-0",
          sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
        )}
      >
        <a href="#main-content" className="skip-link">Skip to main content</a>

        {/* Top bar — same branded gradient header every portal shares */}
        <header className="sticky top-0 z-30 gradient-nav text-white shadow-md">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-3 py-3 sm:gap-3 sm:px-4 sm:py-4 lg:px-6">
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
                {/* Same sticky "back to dashboard" control as the Attorney
                    Portal header — identical gradient-nav teal/blue
                    background, border, and sizing, just pointed at the
                    Expert Portal's own dashboard instead. Hidden on the
                    dashboard itself, same as the attorney one. */}
                {location.pathname !== '/expert-portal' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/expert-portal')}
                    className="shrink-0 gap-1 border border-white/30 bg-white/10 px-2 text-white hover:bg-white/20 hover:text-white sm:px-3"
                    aria-label="Back to Dashboard"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden text-xs font-semibold uppercase tracking-wide sm:inline">
                      Dashboard
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide sm:hidden">Back</span>
                  </Button>
                )}
                <div className="hidden md:block"><PortalSwitcher /></div>
                <NotificationCenter />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 border border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={mobileOpen}
                aria-controls="expert-mobile-sidebar"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="hidden lg:block" />
              <div className="h-0.5 flex-1 rounded-full bg-white/15" />
            </div>
          </div>
        </header>

        <div className="min-w-0 mx-auto w-full max-w-7xl p-3 sm:p-4 lg:p-6">{children}</div>
      </main>
      {!isExternalUser && <InternalChatWidget />}
    </div>
  );
};

export default ExpertPortalLayout;
