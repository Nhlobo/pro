import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Building2, Calendar, LogOut, RefreshCw, Search, User } from "lucide-react";
import { NotificationCenter } from "@/components/NotificationCenter";
import type { User as AuthUser } from "@supabase/supabase-js";
import type { UserProfile } from "@/hooks/useUserProfile";
import { getUserDisplayName, getUserRoleLabel } from "./userDisplay";

interface Props {
  user: AuthUser | null;
  profile: UserProfile | null;
  onRefresh: () => void;
  refreshing: boolean;
  onSignOut: () => void;
}

const DashboardHeader = ({ user, profile, onRefresh, refreshing, onSignOut }: Props) => {
  const navigate = useNavigate();
  return (
    <div className="header-section">
      <header className="bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal backdrop-blur-sm shadow-elegant border-b border-kutlwano-blue/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shadow-glow backdrop-blur-sm border border-white/20">
                <span className="text-white font-bold text-lg">K&A</span>
              </div>
              <div>
                <p className="text-sm text-white/80">Management Platform</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
                <input
                  type="text"
                  placeholder="Quick search..."
                  className="pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 w-64 text-sm backdrop-blur-sm"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  onClick={() => navigate("/appointment-request")}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Book Appointment
                </Button>
              </div>

              <div className="bg-white/10 rounded-xl px-6 py-3 shadow-soft border border-white/20 backdrop-blur-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    {profile?.law_firm ? (
                      <Building2 className="h-4 w-4 text-white" />
                    ) : (
                      <User className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{getUserDisplayName(user, profile)}</p>
                    <p className="text-xs text-white/70">{getUserRoleLabel(profile)}</p>
                  </div>
                </div>
              </div>

              <NotificationCenter />

              <Button
                size="sm"
                variant="outline"
                onClick={onRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border-white/20"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>

              <Button
                size="sm"
                onClick={onSignOut}
                className="flex items-center gap-2 bg-white text-kutlwano-blue hover:bg-white/90 font-semibold shadow-md hover:shadow-lg transition-all duration-300"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
};

export default DashboardHeader;
