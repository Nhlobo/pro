import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, LogOut } from "lucide-react";
import { StaffNotificationBell } from "@/components/StaffNotificationBell";

interface DashboardStickyHeaderProps {
  /** Page title — mirrors resolvePageTitle()'s output in AdminPortalLayout. */
  title: string;
  /** Optional short line under the title (rare — most admin pages don't use one). */
  subtitle?: string;
  /** Where the "back" pill goes. Defaults to the sales/staff dashboard these
   *  pages are all reached from via DashboardMenus. */
  backHref?: string;
  /** Label on the back pill (full width) / "Back" (mobile). */
  backLabel?: string;
  /** Hide the back pill entirely — for the dashboard page itself, where
   *  "back to Dashboard" while already on it doesn't make sense (same
   *  rule AdminPortalLayout's header follows for each role's home page). */
  showBack?: boolean;
  /** Extra controls rendered next to the notification bell — e.g. a page's
   *  own primary action button or DraftStatusIndicator. Kept optional so
   *  pages that don't need one don't have to pass an empty fragment. */
  actions?: React.ReactNode;
  /** Renders a "Sign Out" pill when provided. Only needed on pages that
   *  aren't inside the Admin Portal sidebar shell (which has its own
   *  sign-out control) — e.g. the staff dashboard itself. */
  onSignOut?: () => void;
}

/**
 * The same branded sticky header every Admin Portal page shares
 * (see AdminPortalLayout.tsx's <header>), reused as a standalone
 * component for the handful of staff pages that live outside the
 * Admin Portal sidebar shell (reached from DashboardMenus on the
 * staff dashboard) but should still look and feel like the rest of
 * the system rather than keeping their own one-off `<header
 * className="border-b">` styling.
 *
 * Deliberately NOT a copy of AdminPortalLayout itself — no sidebar,
 * no hamburger/drawer row, no PortalSwitcher (that switches between
 * portal *shells*, which these pages aren't part of). Just the same
 * gradient-nav sticky bar, eyebrow, title, back pill, and staff
 * notification bell.
 */
export const DashboardStickyHeader: React.FC<DashboardStickyHeaderProps> = ({
  title,
  subtitle,
  backHref = "/dashboard",
  backLabel = "Dashboard",
  actions,
  onSignOut,
  showBack = true,
}) => {
  return (
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
              title={title}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 max-w-2xl text-xs text-white/80 sm:text-sm">{subtitle}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {actions}
            {showBack && (
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="shrink-0 gap-1 border border-white/30 bg-white/10 px-2 text-white hover:bg-white/20 hover:text-white sm:px-3"
              >
                <Link to={backHref} aria-label={`Back to ${backLabel}`}>
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden text-xs font-semibold uppercase tracking-wide sm:inline">
                    {backLabel}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide sm:hidden">Back</span>
                </Link>
              </Button>
            )}
            <StaffNotificationBell />
            {onSignOut && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSignOut}
                className="shrink-0 gap-1 border border-white/30 bg-white/10 px-2 text-white hover:bg-white/20 hover:text-white sm:px-3"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden text-xs font-semibold uppercase tracking-wide sm:inline">Sign Out</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardStickyHeader;
