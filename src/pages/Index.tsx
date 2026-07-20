import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAppointmentNotifications } from "@/hooks/useAppointmentNotifications";
import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Target, Users } from "lucide-react";
import CompanyFooter from "@/components/CompanyFooter";
import SalesConsultantStats from "@/components/SalesConsultantStats";
import DashboardStatsGrid from "@/components/dashboard/DashboardStatsGrid";
import RecentActivityCard from "@/components/dashboard/RecentActivityCard";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import WelcomeSection from "@/components/dashboard/WelcomeSection";
import DashboardMenus from "@/components/dashboard/DashboardMenus";
import QuickActionsCard from "@/components/dashboard/QuickActionsCard";
import WorkflowAlertsCard from "@/components/dashboard/WorkflowAlertsCard";
import HelpSupportCard from "@/components/dashboard/HelpSupportCard";
import AttorneyDashboardView from "@/components/dashboard/AttorneyDashboardView";
import { toast } from "sonner";
import BrandedPageLoader from "@/components/BrandedPageLoader";

const Index = () => {
  const { user, signOut } = useAuth();
  const { isReferringAttorney, isAdmin, isSalesConsultant, isMedicalExpert, loading, roleResolutionFailed, refetch } = usePermissions();
  const { stats, loading: statsLoading, refetchStats } = useDashboardStats();
  const { profile: userProfile, error: profileError } = useUserProfile(user ?? null);
  const [refreshing, setRefreshing] = useState(false);

  useAppointmentNotifications();
  const navigate = useNavigate();

  // Calculate role flags once
  const admin = isAdmin();
  const referringAttorney = isReferringAttorney();
  const salesConsultant = isSalesConsultant();
  const medicalExpert = isMedicalExpert();

  useEffect(() => {
    if (profileError) toast.error(`Could not load your profile: ${profileError}`);
  }, [profileError]);

  // Redirect admin/employee users to the new admin portal
  useEffect(() => {
    if (!loading && admin && !referringAttorney) {
      navigate("/admin", { replace: true });
    }
  }, [loading, admin, referringAttorney, navigate]);

  // Medical experts have their own portal — previously this role had no
  // redirect here at all, so a medical expert who ever landed on /dashboard
  // directly (bookmark, race on first login, etc.) would fall through to
  // the generic placeholder dashboard below instead of their real portal.
  useEffect(() => {
    if (!loading && medicalExpert) {
      navigate("/expert-portal", { replace: true });
    }
  }, [loading, medicalExpert, navigate]);

  // Every account here is provisioned by an administrator, so a role that
  // still fails to resolve after usePermissions' internal retries is a real
  // problem, not a normal state — surface it loudly instead of quietly
  // rendering the generic dashboard shell, which is what made this look like
  // a "hidden"/unexplained screen to staff.
  useEffect(() => {
    if (!loading && roleResolutionFailed) {
      toast.error("We couldn't confirm your account's access level. Contact your administrator if this continues.");
    }
  }, [loading, roleResolutionFailed]);

  const handleRefresh = async () => {
    if (refreshing) return;
    try {
      setRefreshing(true);
      await refetchStats();
    } catch (error: any) {
      console.error("Error refreshing dashboard stats:", error);
      toast.error(`Refresh failed: ${error?.message ?? "Unknown error"}`);
    } finally {
      setRefreshing(false);
    }
  };

  // Still figuring out the user's role — show a loader, not a guess.
  // (Permissions are now shared app-wide via PermissionsProvider, so this
  // will already be resolved by the time ProtectedRoute — which wraps this
  // page in App.tsx — has finished its own check. This is just a safety net
  // for the rare case this state is still settling.)
  if (loading) {
    return <BrandedPageLoader message="Loading…" />;
  }

  // If user is a referring attorney, show restricted dashboard
  if (referringAttorney) {
    return <AttorneyDashboardView user={user ?? null} profile={userProfile} onSignOut={signOut} />;
  }

  // Admins are being redirected to /admin by the effect above — show a
  // loader instead of the generic dashboard while that navigation happens,
  // so it never has a chance to flash on screen first.
  if (admin) {
    return <BrandedPageLoader message="Loading…" />;
  }

  // Same treatment for medical experts — being redirected to /expert-portal
  // by the effect above, so show a loader rather than the generic dashboard.
  if (medicalExpert) {
    return <BrandedPageLoader message="Loading…" />;
  }

  // Role genuinely couldn't be resolved even after retries. Every account in
  // this system is created by an administrator with a role attached, so this
  // means something is actually wrong with this account's setup — show that
  // plainly instead of the full dashboard shell (with its menus, stats, and
  // quick actions) which implied this was a normal, working screen.
  if (roleResolutionFailed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Helmet>
          <title>Account Setup Required - Medico-Legal Assessment System</title>
        </Helmet>
        <Card className="max-w-md w-full bg-gradient-card border-border/50 shadow-soft">
          <CardHeader>
            <CardTitle>We couldn't confirm your access level</CardTitle>
            <CardDescription className="mt-2">
              Your account is signed in, but no role is currently assigned to it. This should not happen for an
              account added by an administrator — please contact your system administrator so they can check your
              role in User Management, or try refreshing below.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => refetch()} className="gap-2">
              Try again
            </Button>
            <Button variant="outline" onClick={() => signOut()}>
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-background">
        <Helmet>
          <title>Dashboard - Medico-Legal Assessment System</title>
          <meta name="description" content="Comprehensive medico-legal assessment management system for attorneys, medical experts, and case tracking." />
        </Helmet>

        <DashboardHeader
          user={user ?? null}
          profile={userProfile}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onSignOut={signOut}
        />

        <div className="content-section">
          <div className="container mx-auto px-4 py-8 space-y-8">
            <WelcomeSection onRefresh={handleRefresh} refreshing={refreshing} />

            {salesConsultant && userProfile?.first_name && (
              <Card className="bg-gradient-card border-border/50 shadow-soft">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Target className="h-5 w-5 text-primary" />
                        Welcome back, {userProfile.first_name}!
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Your personal sales performance — Deals Closed are pulled live from Scheduled Assessment
                        Appointments and stay in sync with the Sales Dashboard and Attorney Pitchlog.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => navigate("/sales-dashboard")} className="gap-1">
                        <BarChart3 className="h-4 w-4" /> My Sales Dashboard
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate("/attorney-pitchlog")} className="gap-1">
                        <Users className="h-4 w-4" /> Attorney Pitchlog
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <SalesConsultantStats firstName={userProfile.first_name} lastName={userProfile.last_name} />
                </CardContent>
              </Card>
            )}

            {!salesConsultant && <DashboardStatsGrid stats={stats} loading={statsLoading} />}

            <DashboardMenus />

            {!salesConsultant && (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <WorkflowAlertsCard />
                <QuickActionsCard />
                <RecentActivityCard />
                <HelpSupportCard />
              </div>
            )}
          </div>
        </div>

        <CompanyFooter />
      </div>
  );
};

export default Index;
