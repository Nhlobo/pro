import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import PortalSwitcher from './PortalSwitcher';
import { NotificationCenter } from '@/components/NotificationCenter';
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
  Menu,
} from 'lucide-react';
import BrandedPageLoader from '@/components/BrandedPageLoader';

const logoSrc = '/lovable-uploads/7401e32a-2457-4a00-9d60-c1ff9fcfc4fc.png';

interface AttorneyPortalLayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  { title: 'Dashboard', href: '/attorney-portal', icon: LayoutDashboard },
  { title: 'My Cases', href: '/attorney-portal/cases', icon: Briefcase },
  { title: 'View Case Status', href: '/attorney-portal/case-status', icon: Activity },
  { title: 'Appointments', href: '/attorney-portal/appointments', icon: Calendar },
  { title: 'Reports', href: '/attorney-portal/reports', icon: FileText },
  { title: 'AOD & Payments', href: '/attorney-portal/payments', icon: CreditCard },
  { title: 'Agreements', href: '/attorney-portal/agreements', icon: FileSignature },
  { title: 'Profile', href: '/attorney-portal/profile', icon: User },
  { title: 'Notifications', href: '/attorney-portal/notifications', icon: Bell },
  { title: 'Support', href: '/attorney-portal/support', icon: HeadsetIcon },
];

const PAGE_TITLE_BY_PATH: Record<string, string> = navigationItems.reduce(
  (acc, item) => ({ ...acc, [item.href]: item.title }),
  {} as Record<string, string>,
);

function resolvePageTitle(pathname: string): string {
  if (PAGE_TITLE_BY_PATH[pathname]) return PAGE_TITLE_BY_PATH[pathname];
  const match = Object.keys(PAGE_TITLE_BY_PATH)
    .filter((href) => href !== '/attorney-portal' && pathname.startsWith(href + '/'))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_TITLE_BY_PATH[match] : 'Attorney Portal';
}

/**
 * Attorney Portal shell.
 *
 * Rebuilt to share the exact same responsive shell as AdminPortalLayout
 * (mobile drawer sidebar, sticky branded header, skip-link, lg: breakpoint
 * offsets) instead of its own one-off fixed-sidebar layout, which had no
 * mobile handling at all — on a narrow viewport the fixed 256px sidebar
 * and the main content's unconditional ml-64 fought each other, which is
 * what "not responsive / overlapping" was. Referring attorneys should feel
 * like they're in the same real platform staff use, not a separate,
 * lower-effort build.
 *
 * Theme: wrapped in `attorney-portal-theme`, which scopes a set of
 * `--portal-*` CSS variables (see index.css) used throughout this file
 * instead of hardcoded white/green utilities. That keeps the soft
 * white→green gradient's text dark-on-light for contrast, and keeps the
 * whole theme isolated to this layout — it never touches
 * AdminPortalLayout, ExpertPortalLayout, or any shared/global styles.
 */
export const AttorneyPortalLayout: React.FC<AttorneyPortalLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { loading } = usePermissions();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (loading) {
    return <BrandedPageLoader message="Loading…" />;
  }

  return (
    <div className="attorney-portal-theme flex min-h-screen bg-background">
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
          "fixed left-0 top-0 z-40 flex h-screen flex-col overflow-hidden gradient-nav-attorney text-[hsl(var(--portal-fg))] shadow-xl transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0"
        )}
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[hsl(var(--portal-decor)/0.18)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[hsl(var(--portal-decor)/0.18)] blur-3xl" />

        <div className="relative flex h-full min-h-0 flex-col">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-[hsl(var(--portal-border)/0.35)] px-4">
            {!sidebarCollapsed && (
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--portal-overlay)/0.16)] p-1 ring-2 ring-[hsl(var(--portal-border)/0.4)]">
                  <img src={logoSrc} alt="Kutlwano & Associate" className="h-full w-full object-contain" />
                </div>
                <span className="truncate font-semibold text-sm">Attorney Portal</span>
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
                "h-8 w-8 shrink-0 text-[hsl(var(--portal-fg-muted))] hover:bg-[hsl(var(--portal-overlay)/0.16)] hover:text-[hsl(var(--portal-fg))]",
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
                        ? "bg-[hsl(var(--portal-active-bg))] text-[hsl(var(--portal-active-fg))] shadow-sm"
                        : "text-[hsl(var(--portal-fg-muted))] hover:bg-[hsl(var(--portal-overlay)/0.16)] hover:text-[hsl(var(--portal-fg))]",
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
          <div className="shrink-0 border-t border-[hsl(var(--portal-border)/0.35)] p-3">
            <div className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
              sidebarCollapsed && "justify-center px-2"
            )}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--portal-overlay)/0.16)]">
                <User className="h-4 w-4" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="truncate text-xs font-medium">{user?.email}</p>
                  <p className="truncate text-[10px] text-[hsl(var(--portal-fg-muted))]">Referring Attorney</p>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size={sidebarCollapsed ? "icon" : "default"}
              className={cn(
                "mt-1 w-full text-[hsl(var(--portal-fg-muted))] hover:bg-[hsl(var(--portal-overlay)/0.16)] hover:text-[hsl(var(--portal-fg))]",
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
        <header className="sticky top-0 z-30 gradient-nav-attorney text-[hsl(var(--portal-fg))] shadow-md">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-3 py-3 sm:gap-3 sm:px-4 sm:py-4 lg:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--portal-fg-muted))] sm:text-xs sm:tracking-[0.28em]">
                  Medico-Legal Pro
                </div>
                <h1
                  className="mt-0.5 break-words font-bold leading-tight text-[hsl(var(--portal-fg))]
                             text-[clamp(1.15rem,5.5vw,2rem)] sm:text-[clamp(1.4rem,3.5vw,2.25rem)]"
                  title={resolvePageTitle(location.pathname)}
                >
                  {resolvePageTitle(location.pathname)}
                </h1>
              </div>

              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                {/* Same sticky "back to dashboard" control shape as the
                    internal Operations Dashboard header — same
                    border/sizing, just on this portal's own
                    gradient-nav-attorney (green) background and pointed at
                    the Attorney Portal's own dashboard. Hidden on the
                    dashboard itself, same as the internal one. */}
                {location.pathname !== '/attorney-portal' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/attorney-portal')}
                    className="shrink-0 gap-1 border border-[hsl(var(--portal-border)/0.45)] bg-[hsl(var(--portal-overlay)/0.14)] px-2 text-[hsl(var(--portal-fg))] hover:bg-[hsl(var(--portal-overlay)/0.24)] hover:text-[hsl(var(--portal-fg))] sm:px-3"
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
                className="h-9 w-9 shrink-0 border border-[hsl(var(--portal-border)/0.4)] bg-[hsl(var(--portal-overlay)/0.14)] text-[hsl(var(--portal-fg))] hover:bg-[hsl(var(--portal-overlay)/0.24)] hover:text-[hsl(var(--portal-fg))] lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={mobileOpen}
                aria-controls="attorney-mobile-sidebar"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="hidden lg:block" />
              <div className="h-0.5 flex-1 rounded-full bg-[hsl(var(--portal-border)/0.3)]" />
            </div>
          </div>
        </header>

        <div className="min-w-0 mx-auto w-full max-w-7xl p-3 sm:p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
};

export default AttorneyPortalLayout;
