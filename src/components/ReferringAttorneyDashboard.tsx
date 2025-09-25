
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, FileText, Users, Upload, BarChart3, Clock, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const ReferringAttorneyDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    completedReports: 0,
    totalClaimants: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      
      try {
        // Get current user's law firm
        const { data: profile } = await supabase
          .from('profiles')
          .select('law_firm_id')
          .eq('id', user.id)
          .single();

        if (!profile?.law_firm_id) return;

        // Fetch appointment requests count
        const { count: requestsCount } = await supabase
          .from('appointment_requests')
          .select('*', { count: 'exact', head: true })
          .eq('law_firm_id', profile.law_firm_id);

        // Fetch pending requests count
        const { count: pendingCount } = await supabase
          .from('appointment_requests')
          .select('*', { count: 'exact', head: true })
          .eq('law_firm_id', profile.law_firm_id)
          .eq('status', 'pending');

        // Fetch completed reports count
        const { count: completedCount } = await supabase
          .from('expert_reports')
          .select('appointment_id, appointments!inner(law_firm_id)', { count: 'exact', head: true })
          .eq('appointments.law_firm_id', profile.law_firm_id)
          .eq('report_status', 'completed');

        // Fetch claimants count
        const { count: claimantsCount } = await supabase
          .from('claimants')
          .select('*', { count: 'exact', head: true })
          .eq('law_firm_id', profile.law_firm_id);

        setStats({
          totalRequests: requestsCount || 0,
          pendingRequests: pendingCount || 0,
          completedReports: completedCount || 0,
          totalClaimants: claimantsCount || 0
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-attorney-background via-white to-attorney-primary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-3 bg-attorney-gradient bg-clip-text text-transparent">
            Attorney Dashboard
          </h1>
          <p className="text-muted-foreground text-lg">Manage your appointments, view reports, and track case progress</p>
          <div className="w-24 h-1 bg-attorney-gradient mx-auto mt-4 rounded-full"></div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/70 backdrop-blur-sm border-attorney-primary/20 shadow-soft hover:shadow-lg hover:shadow-attorney-primary/10 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <Calendar className="h-4 w-4 text-attorney-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-attorney-primary">{stats.totalRequests}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-attorney-secondary/20 shadow-soft hover:shadow-lg hover:shadow-attorney-secondary/10 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-attorney-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-attorney-secondary">{stats.pendingRequests}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-attorney-accent/20 shadow-soft hover:shadow-lg hover:shadow-attorney-accent/10 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Reports</CardTitle>
              <CheckCircle className="h-4 w-4 text-attorney-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-attorney-accent">{stats.completedReports}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-attorney-primary/20 shadow-soft hover:shadow-lg hover:shadow-attorney-primary/10 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Your Claimants</CardTitle>
              <Users className="h-4 w-4 text-attorney-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-attorney-primary">{stats.totalClaimants}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Functions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Request New Appointment */}
          <Card className="bg-white/80 backdrop-blur-sm border-attorney-primary/30 shadow-soft hover:shadow-lg hover:shadow-attorney-primary/20 transition-all duration-300 hover:scale-105">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-attorney-primary">
                <Calendar className="h-5 w-5" />
                Request Appointment
              </CardTitle>
              <CardDescription>
                Submit new medical expert assessment requests for your claimants
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-attorney-gradient hover:opacity-90">
                <Link to="/appointment-request">
                  New Request
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Request Dashboard */}
          <Card className="bg-white/80 backdrop-blur-sm border-attorney-secondary/30 shadow-soft hover:shadow-lg hover:shadow-attorney-secondary/20 transition-all duration-300 hover:scale-105">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-attorney-secondary">
                <BarChart3 className="h-5 w-5" />
                Request Dashboard
              </CardTitle>
              <CardDescription>
                View and track all your appointment requests and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full border-attorney-secondary/30 hover:bg-attorney-secondary/10">
                <Link to="/appointment-request-dashboard">
                  View Dashboard
                </Link>
              </Button>
            </CardContent>
          </Card>

        {/* Claimant List */}
        <Card className="bg-white/80 backdrop-blur-sm border-attorney-accent/30 shadow-soft hover:shadow-lg hover:shadow-attorney-accent/20 transition-all duration-300 hover:scale-105">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-attorney-accent">
              <Users className="h-5 w-5" />
              Your Claimants
            </CardTitle>
            <CardDescription>
              View and manage your law firm's claimant information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full border-attorney-accent/30 hover:bg-attorney-accent/10">
              <Link to="/claimant-list">
                View Claimants
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Claimant Reports */}
        <Card className="bg-white/80 backdrop-blur-sm border-attorney-primary/30 shadow-soft hover:shadow-lg hover:shadow-attorney-primary/20 transition-all duration-300 hover:scale-105">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-attorney-primary">
              <FileText className="h-5 w-5" />
              Claimant Reports
            </CardTitle>
            <CardDescription>
              Access and download your claimant assessment reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full border-attorney-primary/30 hover:bg-attorney-primary/10">
              <Link to="/claimant-reports">
                View Reports
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Scheduled Assessments */}
        <Card className="bg-white/80 backdrop-blur-sm border-attorney-secondary/30 shadow-soft hover:shadow-lg hover:shadow-attorney-secondary/20 transition-all duration-300 hover:scale-105">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-attorney-secondary">
              <Calendar className="h-5 w-5" />
              Scheduled Assessments
            </CardTitle>
            <CardDescription>
              View your upcoming and completed medical assessments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full border-attorney-secondary/30 hover:bg-attorney-secondary/10">
              <Link to="/scheduled-assessment">
                View Schedule
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Document Upload */}
        <Card className="bg-white/80 backdrop-blur-sm border-attorney-accent/30 shadow-soft hover:shadow-lg hover:shadow-attorney-accent/20 transition-all duration-300 hover:scale-105">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-attorney-accent">
              <Upload className="h-5 w-5" />
              Document Upload
            </CardTitle>
            <CardDescription>
              Upload case documents and medical records securely
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full border-attorney-accent/30 hover:bg-attorney-accent/10">
              <Link to="/document-uploading">
                Upload Documents
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

        {/* Additional Resources */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Attorney Report */}
          <Card className="bg-white/80 backdrop-blur-sm border-attorney-primary/30 shadow-soft hover:shadow-lg hover:shadow-attorney-primary/20 transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-attorney-primary">
                <BarChart3 className="h-5 w-5" />
                Attorney Performance Report
              </CardTitle>
              <CardDescription>
                View your performance metrics and case statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full border-attorney-primary/30 hover:bg-attorney-primary/10">
                <Link to="/referring-attorney-report">
                  View Performance
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Sample Reports */}
          <Card className="bg-white/80 backdrop-blur-sm border-attorney-secondary/30 shadow-soft hover:shadow-lg hover:shadow-attorney-secondary/20 transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-attorney-secondary">
                <FileText className="h-5 w-5" />
                Sample Reports
              </CardTitle>
              <CardDescription>
                Access sample medical expert reports and templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full border-attorney-secondary/30 hover:bg-attorney-secondary/10">
                <Link to="/sample-reports">
                  View Samples
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ReferringAttorneyDashboard;
