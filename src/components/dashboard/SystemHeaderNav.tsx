import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import {
  LayoutDashboard,
  Calendar,
  BarChart3,
  FileSearch,
  FileText,
  CalendarPlus,
} from "lucide-react";

/**
 * The persistent system header + quick-nav strip used on the main
 * Operations Dashboard (Index). Sub-pages reached from the dashboard's
 * menu tiles (Scheduled Assessments, Assessment Reports & Statistics, …)
 * previously rendered as dead-end full pages with only their own local
 * header and no way back except the browser Back button — this restores
 * the same branded header and lets people jump straight to a sibling
 * section instead.
 *
 * Self-contained: wires up its own user/profile/sign-out so any page can
 * just drop in `<SystemHeaderNav />` with no props required.
 */

const NAV_LINKS: Array<{ to: string; label: string; icon: typeof LayoutDashboard }> = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/scheduled-assessment", label: "Scheduled Assessments", icon: Calendar },
  { to: "/assessment-reports-statistics", label: "Assessment Statistics", icon: BarChart3 },
  { to: "/report-tracking", label: "Report Tracking", icon: FileSearch },
  { to: "/sample-reports", label: "Sample Reports", icon: FileText },
  { to: "/new-appointment", label: "New Appointment", icon: CalendarPlus },
];

const SystemHeaderNav = () => {
  const { user, signOut } = useAuth();
  const { profile } = useUserProfile(user ?? null);
  const location = useLocation();

  return (
    <>
      <DashboardHeader
        user={user ?? null}
        profile={profile}
        onRefresh={() => window.location.reload()}
        refreshing={false}
        onSignOut={signOut}
      />

      <nav className="border-b bg-card/60 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="-mx-4 flex items-stretch gap-1 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
            {NAV_LINKS.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to || location.pathname.startsWith(`${to}/`);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-kutlwano-teal text-kutlwano-teal"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
};

export default SystemHeaderNav;
