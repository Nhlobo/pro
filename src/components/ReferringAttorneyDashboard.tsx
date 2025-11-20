import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  FileText, 
  Users, 
  BarChart3,
  Clock,
  CheckCircle2,
  Upload,
  Eye,
  Shield,
  TrendingUp,
  FileSignature
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ReferringAttorneyAccessControl from './ReferringAttorneyAccessControl';
import { ProcessTracker } from './ProcessTracker';
import { QualityControl } from './QualityControl';

const ReferringAttorneyDashboard: React.FC = () => {
  const { isReferringAttorney } = usePermissions();
  const { stats, loading } = useDashboardStats();

  return (
    <ReferringAttorneyAccessControl allowedForReferringAttorney={true}>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold text-foreground">
            Attorney Dashboard
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Automated tracking and quality control for all medico-legal processes
          </p>
          <div className="w-24 h-1 bg-gradient-primary mx-auto rounded-full"></div>
        </div>

        {/* Statistics Cards Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105 group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Total Claimants</CardTitle>
              <div className="p-2 bg-kutlwano-blue/10 rounded-lg group-hover:bg-kutlwano-blue/20 transition-colors duration-300">
                <Users className="h-5 w-5 text-kutlwano-blue" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-kutlwano-blue mb-1">
                {loading ? '...' : stats.totalClaimants}
              </div>
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                <span>All your cases</span>
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
              <div className="text-3xl font-bold text-kutlwano-teal mb-1">
                {loading ? '...' : stats.totalAppointments}
              </div>
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
              <div className="text-3xl font-bold text-warning mb-1">
                {loading ? '...' : stats.pendingReports}
              </div>
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
              <div className="text-3xl font-bold text-blue-500 mb-1">
                {loading ? '...' : stats.reportsInProgress}
              </div>
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
              <div className="text-3xl font-bold text-purple-500 mb-1">
                {loading ? '...' : stats.reportsTakenOut}
              </div>
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                <span>Delivered to you</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105 group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Completed</CardTitle>
              <div className="p-2 bg-success/10 rounded-lg group-hover:bg-success/20 transition-colors duration-300">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success mb-1">
                {loading ? '...' : stats.completedAssessments}
              </div>
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                <span>Reports finalized</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Automated Tracking and Quality Control Tabs */}
        <Tabs defaultValue="tracking" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tracking" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Process Tracking
            </TabsTrigger>
            <TabsTrigger value="quality" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Quality Control
            </TabsTrigger>
            <TabsTrigger value="case-management" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Case Management
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Quick Actions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tracking" className="mt-6">
            <ProcessTracker />
          </TabsContent>

          <TabsContent value="quality" className="mt-6">
            <QualityControl />
          </TabsContent>

          <TabsContent value="case-management" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Request Appointment */}
              <Card className="bg-gradient-card backdrop-blur-sm border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-kutlwano-blue">
                    <Calendar className="h-5 w-5" />
                    Request Appointment
                  </CardTitle>
                  <CardDescription>
                    Submit new medical expert assessment requests for your claimants
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full">
                    <Link to="/appointment-request">
                      New Request
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Claimant Progress Report */}
              <Card className="bg-gradient-card backdrop-blur-sm border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-kutlwano-teal">
                    <FileText className="h-5 w-5" />
                    Claimant Progress Report
                  </CardTitle>
                  <CardDescription>
                    Track progress and access your claimant assessment reports
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/claimant-reports">
                      View Progress
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Assessment Update */}
              <Card className="bg-gradient-card backdrop-blur-sm border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-kutlwano-blue">
                    <Users className="h-5 w-5" />
                    Assessment Update
                  </CardTitle>
                  <CardDescription>
                    View and manage scheduled assessment updates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full">
                    <Link to="/referring-attorney-update">
                      Assessment Update
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="dashboard" className="mt-6">
            {/* Quick Actions Section */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Other Quick Actions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Request Dashboard */}
                <Card className="bg-gradient-card backdrop-blur-sm border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-kutlwano-teal">
                      <BarChart3 className="h-5 w-5" />
                      Request Dashboard
                    </CardTitle>
                    <CardDescription>
                      View and track all your appointment requests and their status
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/appointment-request-dashboard">
                        View Dashboard
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                {/* Claimant List */}
                <Card className="bg-gradient-card backdrop-blur-sm border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-kutlwano-blue">
                      <Users className="h-5 w-5" />
                      Your Claimants
                    </CardTitle>
                    <CardDescription>
                      View and manage your law firm's claimant information
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/claimant-list">
                        View Claimants
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                {/* Scheduled Assessments */}
                <Card className="bg-gradient-card backdrop-blur-sm border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-kutlwano-blue">
                      <Calendar className="h-5 w-5" />
                      Scheduled Assessments
                    </CardTitle>
                    <CardDescription>
                      View your upcoming and completed medical assessments
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/scheduled-assessment">
                        View Schedule
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                {/* Document Upload */}
                <Card className="bg-gradient-card backdrop-blur-sm border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-kutlwano-teal">
                      <Upload className="h-5 w-5" />
                      Document Upload
                    </CardTitle>
                    <CardDescription>
                      Upload case documents and medical records securely
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/document-uploading">
                        Upload Documents
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                {/* AOD Management */}
                <Card className="bg-gradient-card backdrop-blur-sm border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-kutlwano-blue">
                      <FileSignature className="h-5 w-5" />
                      AOD Management
                    </CardTitle>
                    <CardDescription>
                      Manage Acknowledgement of Debt documents and contracts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/aod-management">
                        Manage AODs
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                {/* Company Profile */}
                <Card className="bg-gradient-card backdrop-blur-sm border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-kutlwano-teal">
                      <Users className="h-5 w-5" />
                      Company Profile
                    </CardTitle>
                    <CardDescription>
                      Update your company contact information and details
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/referring-attorney-profile">
                        Manage Profile
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Assessment and Reports Section */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Assessment and Reports
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                {/* Performance Report */}
                <Card className="bg-gradient-card backdrop-blur-sm border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-kutlwano-blue">
                      <BarChart3 className="h-5 w-5" />
                      Performance Report
                    </CardTitle>
                    <CardDescription>
                      View your performance metrics and case statistics
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/referring-attorney-report">
                        View Performance
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                {/* Sample Reports */}
                <Card className="bg-gradient-card backdrop-blur-sm border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-kutlwano-teal">
                      <FileText className="h-5 w-5" />
                      Sample Reports
                    </CardTitle>
                    <CardDescription>
                      Access sample medical expert reports and templates
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/sample-reports">
                        View Samples
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ReferringAttorneyAccessControl>
  );
};

export default ReferringAttorneyDashboard;