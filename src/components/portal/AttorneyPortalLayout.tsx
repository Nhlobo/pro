import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import PortalSwitcher from './PortalSwitcher';
import { NotificationCenter } from '@/components/NotificationCenter';
import { BRAND_TEAL } from '@/components/admin/ui/AdminUI';
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
  ChevronLeft,
  Menu,
  Scale,
} from 'lucide-react';
import TourLauncher from '@/components/tour/TourLauncher';
import RouteFirstVisitTour from '@/components/tour/RouteFirstVisitTour';
import { ATTORNEY_TOUR, ATTORNEY_TOUR_KEY } from '@/config/tours';
import { ATTORNEY_PAGE_TOURS } from '@/config/pageTours';
import BrandedPageLoader from '@/components/BrandedPageLoader';

const logoSrc = '/lovable-uploads/7401e32a-2457-4a00-9d60-c1ff9fcfc4fc.png';

interface AttorneyPortalLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

/** Grouped, not a flat list — a system has sections; a menu has a pile of links. */
const navigationSections: NavSection[] = [
  {
    label: 'Overview',
    items: [{ title: 'Dashboard', href: '/attorney-portal', icon: LayoutDashboard }],
  },
  {
    label: 'Caseload',
    items: [
      { title: 'My Cases', href: '/attorney-portal/cases', icon: Briefcase },
      { title: 'Case Status', href: '/attorney-portal/case-status', icon: Activity },
      { title: 'Appointments', href: '/attorney-portal/appointments', icon: Calendar },
      { title: 'Reports', href: '/attorney-portal/reports', icon: FileText },
    ],
  },
  {
    label: 'Accounts',
    items: [
      { title: 'AOD & Payments', href: '/attorney-portal/payments', icon: CreditCard },
      { title: 'Agreements', href: '/attorney-portal/agreements', icon: FileSignature },
    ],
  },
  {
    label: 'Support',
    items: [
      { title: 'Notifications', href: '/attorney-portal/notifications', icon: Bell },
      { title: 'Support', href: '/attorney-portal/support', icon: HeadsetIcon },
    ],
  },
];

const PAGE_TITLE_BY_PATH: Record<string, string> = navigationSections
  .flatMap((s) => s.items)
  .reduce((acc, item) => ({ ...acc, [item.href]: item.title }), {} as Record<string, string>);

function resolvePageTitle(pathname: string): string {
  if (PAGE_TITLE_BY_PATH[pathname]) return PAGE_TITLE_BY_PATH[pathname];
  const match = Object.keys(PAGE_TITLE_BY_PATH)
    .filter((href) => href !== '/attorney-portal' && pathname.startsWith(href + '/'))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_TITLE_BY_PATH[match] : 'Attorney Portal';
}

const SIDEBAR_BG = '#0A0F17';

/**
 * Attorney Portal shell — enterprise console, not a marketing shell.
 *
 * One flat, systematic language throughout: a solid dark workspace rail
 * (sectioned, not a pile of pill links), a quiet bordered header instead of
 * a decorative gradient banner, and zero rounding beyond what the design
 * tokens already define (`--radius: 0`). Referring attorneys should feel
 * like they're inside the same disciplined system staff use — a tool with
 * structure, not a set of floating cards.
 */
export const AttorneyPortalLayout: React.FC<AttorneyPortalLayoutProps> = ({ children }) => {
  const location = useLocation();
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

  const initial = (user?.email || 'A').charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#F4F5F7]">
      <RouteFirstVisitTour routes={ATTORNEY_PAGE_TOURS} />

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — solid, sectioned workspace rail */}
      <aside
        data-tour="attorney-sidebar"
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen flex-col overflow-hidden text-white transition-all duration-200',
          sidebarCollapsed ? 'w-16' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0'
        )}
        style={{ background: SIDEBAR_BG }}
      >
        <div className="flex h-full min-h-0 flex-col">
          {/* Wordmark */}
          <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3">
            {!sidebarCollapsed && (
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-white/15 bg-white/[0.04]">
                  <img src={logoSrc} alt="" className="h-full w-full object-contain" />
                </div>
                <div className="min-w-0 leading-none">
                  <div className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                    Attorney Portal
                  </div>
                  <div className="truncate text-[10px] text-white/40">Medico-Legal Pro</div>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="mx-auto flex h-7 w-7 shrink-0 items-center justify-center border border-white/15 bg-white/[0.04]">
                <img src={logoSrc} alt="" className="h-full w-full object-contain" />
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
                'h-7 w-7 shrink-0 rounded-none text-white/60 hover:bg-white/10 hover:text-white',
                sidebarCollapsed && 'hidden'
              )}
              aria-label="Toggle sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* Sectioned navigation */}
          <ScrollArea className="min-h-0 flex-1">
            <nav className="px-2 py-3">
              {navigationSections.map((section, sIdx) => (
                <div key={section.label} className={cn(sIdx > 0 && 'mt-4')}>
                  {!sidebarCollapsed && (
                    <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
                      {section.label}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            'flex items-center gap-2.5 border-l-2 py-2 pl-2.5 pr-2 text-[13px] font-medium transition-colors',
                            isActive
                              ? 'border-[#00BAAD] bg-white/[0.06] text-white'
                              : 'border-transparent text-white/55 hover:bg-white/[0.04] hover:text-white/90',
                            sidebarCollapsed && 'justify-center px-0'
                          )}
                          title={sidebarCollapsed ? item.title : undefined}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!sidebarCollapsed && <span className="truncate">{item.title}</span>}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </ScrollArea>

          {/* Identity / session */}
          <div className="shrink-0 border-t border-white/10 p-2">
            <div
              className={cn(
                'flex items-center gap-2.5 px-2 py-2',
                sidebarCollapsed && 'justify-center px-0'
              )}
            >
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center text-[11px] font-bold text-[#0A0F17]"
                style={{ backgroundColor: BRAND_TEAL }}
                aria-hidden="true"
              >
                {initial}
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0 flex-1 overflow-hidden leading-tight">
                  <p className="truncate text-[12px] font-medium text-white">{user?.email}</p>
                  <p className="truncate text-[10px] uppercase tracking-wide text-white/40">Referring Attorney</p>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'mt-1 w-full justify-start gap-2.5 rounded-none px-2 text-[13px] font-medium text-white/55 hover:bg-white/[0.06] hover:text-white',
                sidebarCollapsed && 'justify-center px-0'
              )}
              onClick={() => signOut()}
              title={sidebarCollapsed ? 'Sign Out' : undefined}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>Sign Out</span>}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        id="main-content"
        className={cn(
          'flex-1 min-w-0 transition-all duration-200',
          'ml-0',
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        )}
      >
        <a href="#main-content" className="skip-link">Skip to main content</a>

        {/* Header — a quiet system bar, not a banner */}
        <header className="sticky top-0 z-30 border-b border-black/10 bg-white">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3 py-2.5 sm:px-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-none border border-black/10 text-black hover:bg-black/5 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={mobileOpen}
                aria-controls="attorney-mobile-sidebar"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <Scale className="hidden h-4 w-4 shrink-0 text-slate-300 sm:block" aria-hidden="true" />
              <div className="min-w-0">
                <div className="hidden items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 sm:flex">
                  <span>Medico-Legal Pro</span>
                  <span aria-hidden="true">/</span>
                  <span style={{ color: BRAND_TEAL }}>Attorney Portal</span>
                </div>
                <h1
                  className="truncate text-[15px] font-bold leading-tight text-black sm:text-lg"
                  title={resolvePageTitle(location.pathname)}
                >
                  {resolvePageTitle(location.pathname)}
                </h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <div className="hidden sm:block">
                <TourLauncher steps={ATTORNEY_TOUR} storageKey={ATTORNEY_TOUR_KEY} compact />
              </div>
              <div className="hidden md:block"><PortalSwitcher /></div>
              <div className="h-5 w-px bg-black/10" aria-hidden="true" />
              <NotificationCenter />
            </div>
          </div>
        </header>

        <div className="min-w-0 mx-auto w-full max-w-7xl p-3 sm:p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
};

export default AttorneyPortalLayout;
