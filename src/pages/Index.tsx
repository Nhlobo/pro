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
  Upload
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CompanyFooter from "@/components/CompanyFooter";

const Index = () => {
  const { user } = useAuth();
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
          <ReferringAttorneyDashboard />
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
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Manage your medico-legal assessments and reports</p>
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

          {/* Management Sections */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Claimant Management */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Claimant Management
                </CardTitle>
                <CardDescription>
                  Add, edit, and manage claimant information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild className="w-full">
                  <Link to="/claimant">Add New Claimant</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/claimant-list">View All Claimants</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/claimant-reports">Claimant Reports</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Attorney Management */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-primary" />
                  Attorney Management
                </CardTitle>
                <CardDescription>
                  Manage referring attorneys and their details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild className="w-full">
                  <Link to="/referring-attorney">Add Attorney</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/referring-attorney-list">View Attorneys</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/referring-attorney-report">Attorney Report</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Medical Experts */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-primary" />
                  Medical Experts
                </CardTitle>
                <CardDescription>
                  Manage medical expert directory and reports
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild className="w-full">
                  <Link to="/medical-expert">Add Expert</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/medical-expert-directory">Expert Directory</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/expert-reports">Expert Reports</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Assessment & Scheduling */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Assessment Schedule
                </CardTitle>
                <CardDescription>
                  Schedule and manage assessment appointments
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild className="w-full">
                  <Link to="/appointment-request">Request Appointment</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/appointment-request-dashboard">Request Dashboard</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/appointment-schedule">View Schedule</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/new-appointment">New Appointment</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/scheduled-assessment">Scheduled Assessments</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Document Management */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  Document Management
                </CardTitle>
                <CardDescription>
                  Upload and manage case documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild className="w-full">
                  <Link to="/document-uploading">Upload Documents</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/sample-reports">Sample Reports</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Lead Management */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Lead Management
                </CardTitle>
                <CardDescription>
                  Generate and track potential clients
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild className="w-full">
                  <Link to="/lead-generator">Lead Generator</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/lead-history">Lead History</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Reports & Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Reports & Analytics
                </CardTitle>
                <CardDescription>
                  View comprehensive reports and statistics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild className="w-full">
                  <Link to="/report-tracking">Report Tracking</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/assessment-reports-statistics">Assessment Statistics</Link>
                </Button>
              </CardContent>
            </Card>

            {/* User Management */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  User Management
                </CardTitle>
                <CardDescription>
                  Manage users and system administration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild className="w-full">
                  <Link to="/user-management">User Management</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/edit-requests">Edit Requests</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/audit-trail">Audit Trail</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <CompanyFooter />
      </div>
    </ProtectedRoute>
  );
};

export default Index;
