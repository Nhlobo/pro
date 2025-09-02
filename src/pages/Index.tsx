import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import ProtectedRoute from "@/components/ProtectedRoute";
import ReferringAttorneyDashboard from "@/components/ReferringAttorneyDashboard";
import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  Target,
  Upload,
  LogOut,
  ChevronDown
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
  const { isReferringAttorney, loading } = usePermissions();
  const [stats, setStats] = useState({
    totalClaimants: 0,
    totalAppointments: 0,
    pendingReports: 0,
    completedAssessments: 0
  });

  // If user is a referring attorney, show restricted dashboard
  if (!loading && isReferringAttorney()) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background">
          <Helmet>
            <title>Attorney Dashboard - Medico-Legal Assessment System</title>
            <meta name="description" content="Attorney dashboard for managing appointments and viewing reports" />
          </Helmet>
          <div className="container mx-auto px-4 py-8">
            <div className="mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold mb-2">Attorney Dashboard</h1>
                <p className="text-muted-foreground">Manage your appointments and view reports</p>
              </div>
              <Button onClick={signOut} variant="outline" className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
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
      <div className="min-h-screen bg-background">
        <Helmet>
          <title>Dashboard - Medico-Legal Assessment System</title>
          <meta name="description" content="Comprehensive medico-legal assessment management system for attorneys, medical experts, and case tracking." />
        </Helmet>

        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
              <p className="text-muted-foreground">Manage your medico-legal assessments and reports</p>
            </div>
            <Button onClick={signOut} variant="outline" className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Claimants</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalClaimants}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Appointments</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalAppointments}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Reports</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingReports}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.completedAssessments}</div>
              </CardContent>
            </Card>
          </div>

          {/* Core Function Dropdown Menus */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            
            {/* Claimant Management Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-card hover:bg-accent">
                  <Users className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Claimant Management</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-background">
                <DropdownMenuItem asChild>
                  <Link to="/claimant" className="flex items-center w-full">
                    Add New Claimant
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/claimant-list" className="flex items-center w-full">
                    View All Claimants
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/claimant-reports" className="flex items-center w-full">
                    Claimant Reports
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Attorney Management Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-card hover:bg-accent">
                  <UserCheck className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Attorney Management</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-background">
                <DropdownMenuItem asChild>
                  <Link to="/referring-attorney" className="flex items-center w-full">
                    Add Attorney
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/referring-attorney-list" className="flex items-center w-full">
                    View Attorneys
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/referring-attorney-report" className="flex items-center w-full">
                    Attorney Report
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Medical Experts Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-card hover:bg-accent">
                  <Stethoscope className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Medical Experts</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-background">
                <DropdownMenuItem asChild>
                  <Link to="/medical-expert" className="flex items-center w-full">
                    Add Expert
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/medical-expert-directory" className="flex items-center w-full">
                    Expert Directory
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/expert-reports" className="flex items-center w-full">
                    Expert Reports
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Assessment Schedule Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-card hover:bg-accent">
                  <Calendar className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Assessment Schedule</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-background">
                <DropdownMenuItem asChild>
                  <Link to="/appointment-request" className="flex items-center w-full">
                    Request Appointment
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/appointment-request-dashboard" className="flex items-center w-full">
                    Request Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/appointment-schedule" className="flex items-center w-full">
                    View Schedule
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/new-appointment" className="flex items-center w-full">
                    New Appointment
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/scheduled-assessment" className="flex items-center w-full">
                    Scheduled Assessments
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Document Management Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-card hover:bg-accent">
                  <Upload className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Document Management</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-background">
                <DropdownMenuItem asChild>
                  <Link to="/document-uploading" className="flex items-center w-full">
                    Upload Documents
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/sample-reports" className="flex items-center w-full">
                    Sample Reports
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Lead Management Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-card hover:bg-accent">
                  <Target className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Lead Management</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-background">
                <DropdownMenuItem asChild>
                  <Link to="/lead-generator" className="flex items-center w-full">
                    Lead Generator
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/lead-history" className="flex items-center w-full">
                    Lead History
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Reports & System Management */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            
            {/* Reports & Analytics Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-20 flex items-center justify-center gap-3 bg-card hover:bg-accent w-full">
                  <BarChart3 className="h-6 w-6 text-primary" />
                  <span className="text-lg font-medium">Reports & Analytics</span>
                  <ChevronDown className="h-5 w-5 ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-background">
                <DropdownMenuItem asChild>
                  <Link to="/report-tracking" className="flex items-center w-full">
                    Report Tracking
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/assessment-reports-statistics" className="flex items-center w-full">
                    Assessment Statistics
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Management Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-20 flex items-center justify-center gap-3 bg-card hover:bg-accent w-full">
                  <Settings className="h-6 w-6 text-primary" />
                  <span className="text-lg font-medium">User Management</span>
                  <ChevronDown className="h-5 w-5 ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-background">
                <DropdownMenuItem asChild>
                  <Link to="/user-management" className="flex items-center w-full">
                    User Management
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/edit-requests" className="flex items-center w-full">
                    Edit Requests
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/audit-trail" className="flex items-center w-full">
                    Audit Trail
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <CompanyFooter />
      </div>
    </ProtectedRoute>
  );
};

export default Index;
