import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Building2, LogOut, User } from "lucide-react";
import { NotificationCenter } from "@/components/NotificationCenter";
import ReferringAttorneyDashboard from "@/components/ReferringAttorneyDashboard";
import CompanyFooter from "@/components/CompanyFooter";
import type { User as AuthUser } from "@supabase/supabase-js";
import type { UserProfile } from "@/hooks/useUserProfile";
import { getUserDisplayName, getUserRoleLabel } from "./userDisplay";

interface Props {
  user: AuthUser | null;
  profile: UserProfile | null;
  onSignOut: () => void;
}

const AttorneyDashboardView = ({ user, profile, onSignOut }: Props) => (
  <div className="min-h-screen bg-gradient-to-br from-background via-accent-soft to-muted">
    <Helmet>
      <title>Attorney Dashboard - Medico-Legal Assessment System</title>
      <meta name="description" content="Attorney dashboard for managing appointments and viewing reports" />
    </Helmet>

    <header className="bg-card/80 backdrop-blur-sm shadow-elegant border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-glow">
              <span className="text-primary-foreground font-bold text-lg">K&A</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Attorney Portal</p>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <div className="bg-gradient-card rounded-xl px-6 py-3 shadow-soft border border-border/50">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-kutlwano-blue/10 rounded-lg flex items-center justify-center">
                  {profile?.law_firm ? (
                    <Building2 className="h-4 w-4 text-kutlwano-blue" />
                  ) : (
                    <User className="h-4 w-4 text-kutlwano-blue" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Welcome, {getUserDisplayName(user, profile)}</p>
                  <p className="text-xs text-muted-foreground">{getUserRoleLabel(profile)}</p>
                </div>
              </div>
            </div>

            <NotificationCenter />

            <Button
              variant="outline"
              size="sm"
              onClick={onSignOut}
              className="flex items-center gap-2 border-destructive/20 hover:bg-destructive/10 hover:border-destructive/30 transition-all duration-300"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>

    <div className="container mx-auto px-4 py-8">
      <ReferringAttorneyDashboard />
    </div>
    <CompanyFooter />
  </div>
);

export default AttorneyDashboardView;
