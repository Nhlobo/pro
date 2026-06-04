import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useUserProfile } from "@/hooks/useUserProfile";
import ProtectedRoute from "@/components/ProtectedRoute";
import PermissionGuard from "@/components/PermissionGuard";
import ReferringAttorneyDashboard from "@/components/ReferringAttorneyDashboard";
import { useAppointmentNotifications } from "@/hooks/useAppointmentNotifications";
import { NotificationCenter } from "@/components/NotificationCenter";
import { Helmet } from "react-helmet-async";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Calendar,
  FileText,
  UserCheck,
  Stethoscope,
  BarChart3,
  Settings,
  Upload,
  LogOut,
  ChevronDown,
  User,
  Building2,
  Clock,
  Search,
  FileSignature,
  Zap,
  RefreshCw,
  Target,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CompanyFooter from "@/components/CompanyFooter";
import SalesConsultantStats from "@/components/SalesConsultantStats";
import DashboardStatsGrid from "@/components/dashboard/DashboardStatsGrid";
import RecentActivityCard from "@/components/dashboard/RecentActivityCard";
import { toast } from "sonner";

const Index = () => {
  const { user, signOut } = useAuth();
  const { isReferringAttorney, isAdmin, isSalesConsultant, loading } = usePermissions();
  const { stats, loading: statsLoading, refetchStats } = useDashboardStats();
  const { profile: userProfile, error: profileError } = useUserProfile(user ?? null);
  const [refreshing, setRefreshing] = useState(false);

  useAppointmentNotifications();
  const navigate = useNavigate();

  // Memoised role flags — avoid recomputing on every render and keep a single source of truth
  const roles = useMemo(
    () => ({
      attorney: isReferringAttorney(),
      admin: isAdmin(),
      sales: isSalesConsultant(),
    }),
    [isReferringAttorney, isAdmin, isSalesConsultant]
  );

  // Surface profile load failures to the user instead of swallowing them
  useEffect(() => {
    if (profileError) toast.error(`Could not load your profile: ${profileError}`);
  }, [profileError]);


  // Redirect admin/employee users to the new admin portal
  useEffect(() => {
    if (!loading && isAdmin() && !isReferringAttorney()) {
      navigate('/admin', { replace: true });
    }
  }, [loading, isAdmin, isReferringAttorney, navigate]);

  // userProfile now comes from useUserProfile hook above


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

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchStats();
    setTimeout(() => setRefreshing(false), 800);
  };

  // Get user organization/role display
  const getUserRole = () => {
    if (userProfile?.user_type === 'admin') {
      return "Administrator";
    }
    if (userProfile?.user_type === 'employee') {
      return userProfile?.position || "Company Employee";
    }
    if (userProfile?.user_type === 'referring_attorney' && userProfile?.law_firm?.name) {
      return userProfile.law_firm.name;
    }
    if (userProfile?.position) {
      return userProfile.position;
    }
    return "Internal User";
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
                    <span className="text-primary-foreground font-bold text-lg">K&A</span>
                  </div>
                  <div>
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
                  
                  <NotificationCenter />
                  
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

  return (
    <ProtectedRoute>
      {/* Main Dashboard Container */}
      <div className="min-h-screen bg-background">{/* Uses cream white from design system */}
        <Helmet>
          <title>Dashboard - Medico-Legal Assessment System</title>
          <meta name="description" content="Comprehensive medico-legal assessment management system for attorneys, medical experts, and case tracking." />
        </Helmet>

        {/* Header Section */}
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
                  {/* Quick Search */}
                  <div className="relative hidden md:block">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
                    <input 
                      type="text"
                      placeholder="Quick search..."
                      className="pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 w-64 text-sm backdrop-blur-sm"
                    />
                  </div>
                  
                  {/* Quick Action Buttons */}
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      onClick={() => navigate('/appointment-request')}
                      className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Book Appointment
                    </Button>
                  </div>

                  {/* User Profile Section */}
                  <div className="bg-white/10 rounded-xl px-6 py-3 shadow-soft border border-white/20 backdrop-blur-sm">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                        {userProfile?.law_firm ? <Building2 className="h-4 w-4 text-white" /> : <User className="h-4 w-4 text-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {getUserDisplayName()}
                        </p>
                        <p className="text-xs text-white/70">
                          {getUserRole()}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <NotificationCenter />

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border-white/20"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  
                  <Button
                    size="sm"
                    onClick={signOut}
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

        {/* Main Content Section */}
        <div className="content-section">
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
              <div className="flex items-center justify-center gap-3">
                <h2 className="text-4xl font-bold text-foreground">
                  Medico-Legal System
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Comprehensive medico-legal assessment management dashboard with real-time insights
              </p>
              <div className="w-24 h-1 bg-gradient-primary mx-auto rounded-full"></div>
            </div>

            {/* Sales Consultant Welcome & Performance Dashboard */}
            {isSalesConsultant() && userProfile?.first_name && (
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
                      <Button size="sm" onClick={() => navigate('/sales-dashboard')} className="gap-1">
                        <BarChart3 className="h-4 w-4" /> My Sales Dashboard
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate('/attorney-pitchlog')} className="gap-1">
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

            {/* Enhanced Stats Cards - Hidden for Sales Consultants */}
            {!isSalesConsultant() && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  <CardTitle className="text-sm font-medium text-foreground">Reports In Progress</CardTitle>
                  <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors duration-300">
                    <Clock className="h-5 w-5 text-blue-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-500 mb-1">{stats.reportsInProgress}</div>
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    <span>Currently being prepared</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105 group">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-foreground">Reports Taken Out</CardTitle>
                  <div className="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors duration-300">
                    <FileSignature className="h-5 w-5 text-purple-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-500 mb-1">{stats.reportsTakenOut}</div>
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    <span>Delivered to attorneys</span>
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
                    <span>Reports finalized</span>
                  </div>
                </CardContent>
              </Card>
            </div>
            )}



            {/* Core Function Dropdown Menus - Role-Based Access Control */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
              
              {/* Claimant Management Dropdown - ADMIN/EMPLOYEE ONLY */}
              <PermissionGuard permission="manage_claimants" showAlert={false}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-kutlwano-blue text-white border-kutlwano-blue hover:bg-kutlwano-blue/90 hover:scale-105 transition-all duration-300 shadow-md">
                      <Users className="h-6 w-6 text-white" />
                      <span className="text-sm font-medium">Claimant Management</span>
                      <ChevronDown className="h-4 w-4 text-white/80" />
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
                  </DropdownMenuContent>
                </DropdownMenu>
              </PermissionGuard>

              {/* Attorney Management Dropdown - ADMIN/EMPLOYEE/SALES CONSULTANT */}
              <PermissionGuard permission="manage_attorneys" showAlert={false}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-amber-500 text-white border-amber-500 hover:bg-amber-600 hover:scale-105 transition-all duration-300 shadow-md">
                      <UserCheck className="h-6 w-6 text-white" />
                      <span className="text-sm font-medium">Attorney Management</span>
                      <ChevronDown className="h-4 w-4 text-white/80" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
                    <DropdownMenuItem asChild>
                      <Link to="/referring-attorney" className="flex items-center w-full hover:bg-kutlwano-gold/10">
                        Add New Attorney
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/referring-attorney-list" className="flex items-center w-full hover:bg-kutlwano-gold/10">
                        View All Attorneys
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/referring-attorney-update" className="flex items-center w-full hover:bg-kutlwano-gold/10">
                        Assessment Update
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </PermissionGuard>

              {/* Medical Experts Dropdown - ADMIN/EMPLOYEE ONLY */}
              <PermissionGuard permission="manage_experts" showAlert={false}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-kutlwano-teal text-white border-kutlwano-teal hover:bg-kutlwano-teal/90 hover:scale-105 transition-all duration-300 shadow-md">
                      <Stethoscope className="h-6 w-6 text-white" />
                      <span className="text-sm font-medium">Medical Experts</span>
                      <ChevronDown className="h-4 w-4 text-white/80" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
                    <DropdownMenuItem asChild>
                      <Link to="/medical-expert" className="flex items-center w-full hover:bg-kutlwano-teal/10">
                        Add Medical Expert
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/medical-expert-directory" className="flex items-center w-full hover:bg-kutlwano-teal/10">
                        Expert Directory
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/expert-credit-control" className="flex items-center w-full hover:bg-kutlwano-teal/10">
                        Credit Control
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </PermissionGuard>

              {/* Assessment & Reports Dropdown */}
              <PermissionGuard permission="view_reports" showAlert={false}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600 hover:scale-105 transition-all duration-300 shadow-md">
                    <FileText className="h-6 w-6 text-white" />
                    <span className="text-sm font-medium">Assessment & Reports</span>
                    <ChevronDown className="h-4 w-4 text-white/80" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
                  <DropdownMenuItem asChild>
                    <Link to="/report-tracking" className="flex items-center w-full hover:bg-emerald-500/10">
                      Report Tracking
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/sample-reports" className="flex items-center w-full hover:bg-emerald-500/10">
                      Sample Reports
                    </Link>
                  </DropdownMenuItem>
                  <PermissionGuard permission="admin_only" showAlert={false}>
                    <DropdownMenuItem asChild>
                      <Link to="/assessment-reports-statistics" className="flex items-center w-full hover:bg-emerald-500/10">
                        Assessment Statistics
                      </Link>
                    </DropdownMenuItem>
                  </PermissionGuard>
                </DropdownMenuContent>
              </DropdownMenu>
              </PermissionGuard>

              {/* Appointment Management */}
              <PermissionGuard permission="manage_appointments" showAlert={false}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-violet-500 text-white border-violet-500 hover:bg-violet-600 hover:scale-105 transition-all duration-300 shadow-md">
                    <Calendar className="h-6 w-6 text-white" />
                    <span className="text-sm font-medium">Appointments</span>
                    <ChevronDown className="h-4 w-4 text-white/80" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
                  <DropdownMenuItem asChild>
                    <Link to="/appointment-request-dashboard" className="flex items-center w-full hover:bg-violet-500/10">
                      Request Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/scheduled-assessment" className="flex items-center w-full hover:bg-violet-500/10">
                      Scheduled Assessments
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/new-appointment" className="flex items-center w-full hover:bg-violet-500/10">
                      New Appointment
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/appointment-checklist" className="flex items-center w-full hover:bg-violet-500/10">
                      Appointment Checklist
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </PermissionGuard>

              {/* Document Management */}
              <PermissionGuard permission="manage_documents" showAlert={false}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-orange-500 text-white border-orange-500 hover:bg-orange-600 hover:scale-105 transition-all duration-300 shadow-md">
                    <Upload className="h-6 w-6 text-white" />
                    <span className="text-sm font-medium">Document Management</span>
                    <ChevronDown className="h-4 w-4 text-white/80" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
                  <DropdownMenuItem asChild>
                    <Link to="/document-uploading" className="flex items-center w-full hover:bg-orange-500/10">
                      <Upload className="h-4 w-4 mr-2" />
                      Document Upload
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/document-proofreading" className="flex items-center w-full hover:bg-orange-500/10">
                      <FileText className="h-4 w-4 mr-2" />
                      Document Proofreading
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </PermissionGuard>

              {/* Case Management */}
              <PermissionGuard permission="case_management" showAlert={false}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-blue-500 text-white border-blue-500 hover:bg-blue-600 hover:scale-105 transition-all duration-300 shadow-md">
                    <FileSignature className="h-6 w-6 text-white" />
                    <span className="text-sm font-medium">Case Management</span>
                    <ChevronDown className="h-4 w-4 text-white/80" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
                  <DropdownMenuItem asChild>
                    <Link to="/appointment-request" className="flex items-center w-full hover:bg-blue-500/10">
                      Request Appointment
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/claimant-reports" className="flex items-center w-full hover:bg-blue-500/10">
                      Claimant Progress Report
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/referring-attorney-update" className="flex items-center w-full hover:bg-blue-500/10">
                      Assessment Update
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/aod-management" className="flex items-center w-full hover:bg-blue-500/10">
                      AOD Management
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/debtors-control" className="flex items-center w-full hover:bg-blue-500/10">
                      Debtors Control
                    </Link>
                  </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/case-management-reports" className="flex items-center w-full hover:bg-blue-500/10">
                        Case Reports
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </PermissionGuard>

              {/* Attorney Pitchlog CRM - Standalone */}
              <PermissionGuard permission="attorney_pitchlog" showAlert={false}>
                <Button asChild className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-purple-600 to-indigo-600 text-white hover:opacity-90 hover:scale-105 transition-all duration-300 shadow-md">
                  <Link to="/attorney-pitchlog">
                    <Target className="h-6 w-6 text-white" />
                    <span className="text-sm font-medium">Attorney Pitchlog</span>
                  </Link>
                </Button>
              </PermissionGuard>

              {/* Workflow Automation */}
              <PermissionGuard permission="manage_appointments" showAlert={false}>
                <Button asChild className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-kutlwano-blue to-kutlwano-teal text-white hover:opacity-90 hover:scale-105 transition-all duration-300 shadow-md">
                  <Link to="/workflow-automation">
                    <Zap className="h-6 w-6 text-white" />
                    <span className="text-sm font-medium">Workflow Hub</span>
                  </Link>
                </Button>
              </PermissionGuard>

              {/* Attorney Referral Intelligence */}
              <PermissionGuard permission="view_analytics" showAlert={false}>
                <Button asChild className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-emerald-600 to-teal-600 text-white hover:opacity-90 hover:scale-105 transition-all duration-300 shadow-md">
                  <Link to="/attorney-referral-intelligence">
                    <BarChart3 className="h-6 w-6 text-white" />
                    <span className="text-sm font-medium">Referral Intelligence</span>
                  </Link>
                </Button>
              </PermissionGuard>

              {/* System Administration - ADMIN/EMPLOYEE ONLY (not sales consultants) */}
              <PermissionGuard permission="system_admin" showAlert={false}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-red-500 text-white border-red-500 hover:bg-red-600 hover:scale-105 transition-all duration-300 shadow-md">
                      <Settings className="h-6 w-6 text-white" />
                      <span className="text-sm font-medium">System Admin</span>
                      <ChevronDown className="h-4 w-4 text-white/80" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
                    <DropdownMenuItem asChild>
                      <Link to="/user-management" className="flex items-center w-full hover:bg-red-500/10">
                        User Management
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/edit-requests" className="flex items-center w-full hover:bg-red-500/10">
                        Edit Requests
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/audit-trail" className="flex items-center w-full hover:bg-red-500/10">
                        Audit Trail
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </PermissionGuard>
            </div>

            {/* Enhanced Information Cards - Hidden for Sales Consultants */}
            {!isSalesConsultant() && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {/* Quick Access Card */}
              <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <BarChart3 className="h-5 w-5 text-kutlwano-blue" />
                    Quick Actions
                  </CardTitle>
                  <CardDescription>
                    Most commonly used features for easy access
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <PermissionGuard permission="manage_claimants" fallback={null}>
                      <Button asChild variant="outline" size="sm" className="w-full justify-start">
                        <Link to="/claimant" className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Add New Claimant
                        </Link>
                      </Button>
                    </PermissionGuard>
                    <Button asChild variant="outline" size="sm" className="w-full justify-start">
                      <Link to="/appointment-request" className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Request Assessment
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="w-full justify-start">
                      <Link to="/claimant-reports" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        View Reports
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity Card */}
              <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Clock className="h-5 w-5 text-kutlwano-teal" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>
                    Latest system activity and updates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    {activityLoading ? (
                      <div className="text-muted-foreground text-xs py-2">Loading activity…</div>
                    ) : recentActivity.length === 0 ? (
                      <div className="text-muted-foreground text-xs py-2">No recent activity</div>
                    ) : (
                      recentActivity.map((a) => {
                        const dotClass =
                          a.tone === "success"
                            ? "bg-success"
                            : a.tone === "warning"
                            ? "bg-warning"
                            : a.tone === "info"
                            ? "bg-kutlwano-blue"
                            : "bg-muted-foreground";
                        const when = new Date(a.createdAt).toLocaleString("en-ZA", {
                          timeZone: "Africa/Johannesburg",
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        return (
                          <div key={a.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                            <div className={`w-2 h-2 ${dotClass} rounded-full shrink-0`}></div>
                            <span className="text-muted-foreground flex-1 truncate">{a.label}</span>
                            <span className="text-[10px] text-muted-foreground/70 shrink-0">{when}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Help & Support Card */}
              <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Settings className="h-5 w-5 text-kutlwano-gold" />
                    Help & Support
                  </CardTitle>
                  <CardDescription>
                    System resources and documentation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button asChild variant="outline" size="sm" className="w-full justify-start">
                      <Link to="/sample-reports" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Sample Reports
                      </Link>
                    </Button>
                    <PermissionGuard permission="admin_only" fallback={null}>
                      <Button asChild variant="outline" size="sm" className="w-full justify-start">
                        <Link to="/user-management" className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          User Management
                        </Link>
                      </Button>
                    </PermissionGuard>
                  </div>
                </CardContent>
              </Card>
            </div>
            )}
          </div>
        </div>

        <CompanyFooter />
      </div>
    </ProtectedRoute>
  );
};

export default Index;