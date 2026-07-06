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
  const { isReferringAttorney, isAdmin, isSalesConsultant, loading } = usePermissions();
  const { stats, loading: statsLoading, refetchStats } = useDashboardStats();
  const { profile: userProfile, error: profileError } = useUserProfile(user ?? null);
  const [refreshing, setRefreshing] = useState(false);

  useAppointmentNotifications();
  const navigate = useNavigate();

  // Calculate role flags once
  const admin = isAdmin();
  const referringAttorney = isReferringAttorney();
  const salesConsultant = isSalesConsultant();

  useEffect(() => {
    if (profileError) toast.error(`Could not load your profile: ${profileError}`);
  }, [profileError]);

  // Redirect admin/employee users to the new admin portal
  useEffect(() => {
    if (!loading && admin && !referringAttorney) {
      navigate("/admin", { replace: true });
    }
  }, [loading, admin, referringAttorney, navigate]);

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
