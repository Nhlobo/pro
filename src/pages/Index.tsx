import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import ProtectedRoute from "@/components/ProtectedRoute";
import PermissionGuard from "@/components/PermissionGuard";
import ReferringAttorneyDashboard from "@/components/ReferringAttorneyDashboard";
import { useAppointmentNotifications } from "@/hooks/useAppointmentNotifications";
import { NotificationBadge } from "@/components/NotificationBadge";
import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Calendar, 
  FileText, 
  UserCheck, 
  Stethoscope, 
  BarChart3,
  Settings,
  Target,
  Upload,
  LogOut,
  ChevronDown,
  User,
  Building2,
  Clock,
  TrendingUp
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import CompanyFooter from "@/components/CompanyFooter";

const Index = () => {
  const { user, signOut } = useAuth();
  const { isReferringAttorney, isAdmin, loading } = usePermissions();
  
  // Set up real-time appointment notifications
  useAppointmentNotifications();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalClaimants: 0,
    totalAppointments: 0,
    pendingReports: 0,
    completedAssessments: 0
  });

  const [userProfile, setUserProfile] = useState<{
    first_name?: string;
    last_name?: string;
    position?: string;
    user_type?: string;
    law_firm?: {
      name: string;
      contact_person: string;
    };
  } | null>(null);

  // Fetch user profile and law firm data
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select(`
            first_name,
            last_name,
            position,
            user_type,
            law_firms:law_firm_id (
              name,
              contact_person
            )
          `)
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user profile:', error);
          return;
        }

        setUserProfile({
          first_name: profile.first_name,
          last_name: profile.last_name,
          position: profile.position,
          user_type: profile.user_type,
          law_firm: profile.law_firms
        });
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, [user]);

  // Get display name
  const getUserDisplayName = () => {
    if (userProfile?.first_name && userProfile?.last_name) {
      return `${userProfile.first_name} ${userProfile.last_name}`;
    }
    if (userProfile?.first_name) {
      return userProfile.first_name;
    }
    if (user?.user_metadata?.first_name) {
      return user.user_metadata.first_name;
    }
    return user?.email?.split('@')[0] || 'User';
  };

  // Get user organization/role display
  const getUserRole = () => {
    if (userProfile?.law_firm?.name) {
      return userProfile.law_firm.name;
    }
    if (userProfile?.position) {
      return userProfile.position;
    }
    if (isAdmin()) {
      return "System Administrator";
    }
    return userProfile?.user_type || "Internal User";
  };

  // If user is a referring attorney, show restricted dashboard
  if (!loading && isReferringAttorney()) {
    return (
      <ProtectedRoute>
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
                    <span className="text-primary-foreground font-bold text-lg">MN</span>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                      MediLegal Nexus
                    </h1>
                    <p className="text-sm text-muted-foreground">Attorney Portal</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6">
                  {/* Enhanced Welcome Section */}
                  <div className="bg-gradient-card rounded-xl px-6 py-3 shadow-soft border border-border/50">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-kutlwano-blue/10 rounded-lg flex items-center justify-center">
                        {userProfile?.law_firm ? <Building2 className="h-4 w-4 text-kutlwano-blue" /> : <User className="h-4 w-4 text-kutlwano-blue" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Welcome, {getUserDisplayName()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getUserRole()}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <NotificationBadge />
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={signOut}
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
      </ProtectedRoute>
    );
  }

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      
      try {
        // Fetch claimants count
        const { count: claimantsCount } = await supabase
          .from('claimants')
          .select('*', { count: 'exact', head: true });

        // Fetch appointments count
        const { count: appointmentsCount } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true });

        // Fetch pending reports count
        const { count: pendingCount } = await supabase
          .from('expert_reports')
          .select('*', { count: 'exact', head: true })
          .eq('report_status', 'pending');

        // Fetch completed assessments count
        const { count: completedCount } = await supabase
          .from('expert_reports')
          .select('*', { count: 'exact', head: true })
          .eq('report_status', 'completed');

        setStats({
          totalClaimants: claimantsCount || 0,
          totalAppointments: appointmentsCount || 0,
          pendingReports: pendingCount || 0,
          completedAssessments: completedCount || 0
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, [user]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-background via-accent-soft to-muted">
        <Helmet>
          <title>Dashboard - Medico-Legal Assessment System</title>
          <meta name="description" content="Comprehensive medico-legal assessment management system for attorneys, medical experts, and case tracking." />
        </Helmet>

        <header className="bg-card/80 backdrop-blur-sm shadow-elegant border-b border-border/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-20">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-glow">
                  <span className="text-primary-foreground font-bold text-lg">MN</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                    MediLegal Nexus
                  </h1>
                  <p className="text-sm text-muted-foreground">Management Platform</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-6">
                {/* Enhanced Welcome Section with User Info */}
                <div className="bg-gradient-card rounded-xl px-6 py-3 shadow-soft border border-border/50">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-kutlwano-blue/10 rounded-lg flex items-center justify-center">
                      {userProfile?.law_firm ? <Building2 className="h-4 w-4 text-kutlwano-blue" /> : <User className="h-4 w-4 text-kutlwano-blue" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Welcome, {getUserDisplayName()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getUserRole()}
                      </p>
                    </div>
                  </div>
                </div>
                
                <NotificationBadge />
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={signOut}
                  className="flex items-center gap-2 border-destructive/20 hover:bg-destructive/10 hover:border-destructive/30 transition-all duration-300"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8 space-y-8">
          {/* Welcome Section */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center space-x-2 bg-gradient-card px-4 py-2 rounded-full border border-border/50">
              <Clock className="h-4 w-4 text-kutlwano-blue" />
              <span className="text-sm text-muted-foreground">
                Last updated: {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </div>
            <h2 className="text-4xl font-bold text-foreground">
              System Overview
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Comprehensive medico-legal assessment management dashboard with real-time insights
            </p>
            <div className="w-24 h-1 bg-gradient-primary mx-auto rounded-full"></div>
          </div>

          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Total Claimants</CardTitle>
                <div className="p-2 bg-kutlwano-blue/10 rounded-lg group-hover:bg-kutlwano-blue/20 transition-colors duration-300">
                  <Users className="h-5 w-5 text-kutlwano-blue" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-kutlwano-blue mb-1">{stats.totalClaimants}</div>
                <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  <span>All active cases</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Appointments</CardTitle>
                <div className="p-2 bg-kutlwano-teal/10 rounded-lg group-hover:bg-kutlwano-teal/20 transition-colors duration-300">
                  <Calendar className="h-5 w-5 text-kutlwano-teal" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-kutlwano-teal mb-1">{stats.totalAppointments}</div>
                <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  <span>Scheduled assessments</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Pending Reports</CardTitle>
                <div className="p-2 bg-warning/10 rounded-lg group-hover:bg-warning/20 transition-colors duration-300">
                  <FileText className="h-5 w-5 text-warning" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-warning mb-1">{stats.pendingReports}</div>
                <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Awaiting completion</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Completed</CardTitle>
                <div className="p-2 bg-success/10 rounded-lg group-hover:bg-success/20 transition-colors duration-300">
                  <BarChart3 className="h-5 w-5 text-success" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success mb-1">{stats.completedAssessments}</div>
                <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  <span>Reports delivered</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Core Function Dropdown Menus */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
            
            {/* Claimant Management Dropdown */}
            <PermissionGuard permission="manage_claimants">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-card border-border/50 hover:bg-kutlwano-blue/10 hover:border-kutlwano-blue/30 transition-all duration-300 hover:scale-105">
                    <Users className="h-6 w-6 text-kutlwano-blue" />
                    <span className="text-sm font-medium text-foreground">Claimant Management</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
                  <DropdownMenuItem asChild>
                    <Link to="/claimant" className="flex items-center w-full hover:bg-kutlwano-blue/10">
                      Add New Claimant
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/claimant-list" className="flex items-center w-full hover:bg-kutlwano-blue/10">
                      View All Claimants
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/claimant-reports" className="flex items-center w-full hover:bg-kutlwano-blue/10">
                      Claimant Reports
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </PermissionGuard>

            {/* Attorney Management Dropdown */}
            <PermissionGuard permission="manage_attorneys">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-card border-border/50 hover:bg-kutlwano-teal/10 hover:border-kutlwano-teal/30 transition-all duration-300 hover:scale-105">
                    <UserCheck className="h-6 w-6 text-kutlwano-teal" />
                    <span className="text-sm font-medium text-foreground">Attorney Management</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
                  <DropdownMenuItem asChild>
                    <Link to="/referring-attorney" className="flex items-center w-full hover:bg-kutlwano-teal/10">
                      Add Attorney
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/referring-attorney-list" className="flex items-center w-full hover:bg-kutlwano-teal/10">
                      View Attorneys
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/referring-attorney-report" className="flex items-center w-full hover:bg-kutlwano-teal/10">
                      Attorney Report
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </PermissionGuard>

            {/* Medical Experts Dropdown */}
            <PermissionGuard permission="manage_experts">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-card border-border/50 hover:bg-kutlwano-blue/10 hover:border-kutlwano-blue/30 transition-all duration-300 hover:scale-105">
                    <Stethoscope className="h-6 w-6 text-kutlwano-blue" />
                    <span className="text-sm font-medium text-foreground">Medical Experts</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
                  <DropdownMenuItem asChild>
                    <Link to="/medical-expert" className="flex items-center w-full hover:bg-kutlwano-blue/10">
                      Add Expert
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/medical-expert-directory" className="flex items-center w-full hover:bg-kutlwano-blue/10">
                      Expert Directory
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/expert-reports" className="flex items-center w-full hover:bg-kutlwano-blue/10">
                      Expert Reports
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </PermissionGuard>

            {/* Assessment Schedule Dropdown */}
            <PermissionGuard permission="manage_appointments">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-card border-border/50 hover:bg-kutlwano-teal/10 hover:border-kutlwano-teal/30 transition-all duration-300 hover:scale-105">
                    <Calendar className="h-6 w-6 text-kutlwano-teal" />
                    <span className="text-sm font-medium text-foreground">Assessment Schedule</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
                  <DropdownMenuItem asChild>
                    <Link to="/appointment-request" className="flex items-center w-full hover:bg-kutlwano-teal/10">
                      Request Appointment
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/appointment-request-dashboard" className="flex items-center w-full hover:bg-kutlwano-teal/10">
                      Request Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/appointment-schedule" className="flex items-center w-full hover:bg-kutlwano-teal/10">
                      View Schedule
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/new-appointment" className="flex items-center w-full hover:bg-kutlwano-teal/10">
                      New Appointment
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/scheduled-assessment" className="flex items-center w-full hover:bg-kutlwano-teal/10">
                      Scheduled Assessments
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </PermissionGuard>

            {/* Document Management Dropdown */}
            <PermissionGuard permission="manage_documents">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-card border-border/50 hover:bg-kutlwano-blue/10 hover:border-kutlwano-blue/30 transition-all duration-300 hover:scale-105">
                    <Upload className="h-6 w-6 text-kutlwano-blue" />
                    <span className="text-sm font-medium text-foreground">Document Management</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
                  <DropdownMenuItem asChild>
                    <Link to="/document-uploading" className="flex items-center w-full hover:bg-kutlwano-blue/10">
                      Upload Documents
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/sample-reports" className="flex items-center w-full hover:bg-kutlwano-blue/10">
                      Sample Reports
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </PermissionGuard>

            {/* Lead Management Dropdown */}
            <PermissionGuard permission="manage_leads">
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-card border-border/50 hover:bg-kutlwano-teal/10 hover:border-kutlwano-teal/30 transition-all duration-300 hover:scale-105">
                  <Target className="h-6 w-6 text-kutlwano-teal" />
                  <span className="text-sm font-medium text-foreground">Lead Management</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
                <DropdownMenuItem asChild>
                  <Link to="/lead-generator" className="flex items-center w-full hover:bg-kutlwano-teal/10">
                    Lead Generator
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/lead-history" className="flex items-center w-full hover:bg-kutlwano-teal/10">
                    Lead History
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/crm" className="flex items-center w-full hover:bg-kutlwano-teal/10">
                    Attorney CRM
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
              </DropdownMenu>
            </PermissionGuard>

            {/* CRM - Attorney Management */}
            <PermissionGuard permission="manage_leads">
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-card border-border/50 hover:bg-kutlwano-blue/10 hover:border-kutlwano-blue/30 transition-all duration-300 hover:scale-105">
                  <Building2 className="h-6 w-6 text-kutlwano-blue" />
                  <span className="text-sm font-medium text-foreground">Attorney CRM</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
                <DropdownMenuItem asChild>
                  <Link to="/crm" className="flex items-center w-full hover:bg-kutlwano-blue/10">
                    CRM Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/crm/attorney/new" className="flex items-center w-full hover:bg-kutlwano-blue/10">
                    Add New Attorney
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
              </DropdownMenu>
            </PermissionGuard>
          </div>

          {/* Reports & System Management */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            
            {/* Reports & Analytics Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-20 flex items-center justify-center gap-3 bg-gradient-card border-border/50 hover:bg-kutlwano-blue/10 hover:border-kutlwano-blue/30 transition-all duration-300 hover:scale-105 w-full">
                  <BarChart3 className="h-6 w-6 text-kutlwano-blue" />
                  <span className="text-lg font-medium text-foreground">Reports & Analytics</span>
                  <ChevronDown className="h-5 w-5 ml-auto text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
                <DropdownMenuItem asChild>
                  <Link to="/report-tracking" className="flex items-center w-full hover:bg-kutlwano-blue/10">
                    Report Tracking
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/assessment-reports-statistics" className="flex items-center w-full hover:bg-kutlwano-blue/10">
                    Assessment Statistics
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Management Dropdown */}
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-20 flex items-center justify-center gap-3 bg-gradient-card border-border/50 hover:bg-kutlwano-teal/10 hover:border-kutlwano-teal/30 transition-all duration-300 hover:scale-105 w-full">
                    <Settings className="h-6 w-6 text-kutlwano-teal" />
                    <span className="text-lg font-medium text-foreground">User Management</span>
                    <ChevronDown className="h-5 w-5 ml-auto text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
                  <DropdownMenuItem asChild>
                    <Link to="/user-management" className="flex items-center w-full hover:bg-kutlwano-teal/10">
                      User Management
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/edit-requests" className="flex items-center w-full hover:bg-kutlwano-teal/10">
                      Edit Requests
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/audit-trail" className="flex items-center w-full hover:bg-kutlwano-teal/10">
                      Audit Trail
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <CompanyFooter />
      </div>
    </ProtectedRoute>
  );
};

export default Index;
