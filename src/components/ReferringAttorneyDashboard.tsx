import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAttorneyDashboardStats } from '@/hooks/useAttorneyDashboardStats';
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
  AlertCircle,
  Download,
  FileSignature,
  TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ReferringAttorneyAccessControl from './ReferringAttorneyAccessControl';
import { LiveCaseTracker } from './LiveCaseTracker';

const ReferringAttorneyDashboard: React.FC = () => {
  const { isReferringAttorney } = usePermissions();
  const { stats, liveCases, loading, refetchStats } = useAttorneyDashboardStats();

  return (
    <ReferringAttorneyAccessControl allowedForReferringAttorney={true}>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold text-foreground">
            Attorney Dashboard
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Track your matters, monitor report progress, and manage your cases
          </p>
          <div className="w-24 h-1 bg-gradient-primary mx-auto rounded-full"></div>
        </div>

        {/* Key Statistics Cards - Attorney Focused */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Matters Submitted */}
          <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105 group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Matters Submitted</CardTitle>
              <div className="p-2 bg-kutlwano-blue/10 rounded-lg group-hover:bg-kutlwano-blue/20 transition-colors duration-300">
                <FileText className="h-5 w-5 text-kutlwano-blue" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-kutlwano-blue mb-1">
                {loading ? '...' : stats.mattersSubmitted}
              </div>
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                <span>Total referrals</span>
              </div>
            </CardContent>
          </Card>

          {/* Reports In Progress */}
          <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105 group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Reports In Progress</CardTitle>
              <div className="p-2 bg-warning/10 rounded-lg group-hover:bg-warning/20 transition-colors duration-300">
                <Clock className="h-5 w-5 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning mb-1">
                {loading ? '...' : stats.reportsInProgress}
              </div>
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Being prepared</span>
              </div>
            </CardContent>
          </Card>

          {/* Reports Ready to Download */}
          <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105 group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Ready to Download</CardTitle>
              <div className="p-2 bg-success/10 rounded-lg group-hover:bg-success/20 transition-colors duration-300">
                <Download className="h-5 w-5 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success mb-1">
                {loading ? '...' : stats.reportsReadyToDownload}
              </div>
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" />
                <span>Available now</span>
              </div>
            </CardContent>
          </Card>

          {/* Actions Needed */}
          <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105 group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Actions Needed</CardTitle>
              <div className="p-2 bg-destructive/10 rounded-lg group-hover:bg-destructive/20 transition-colors duration-300">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive mb-1">
                {loading ? '...' : stats.actionsNeeded}
              </div>
              <div className="flex flex-col text-xs text-muted-foreground space-y-0.5">
                {stats.missingDocuments > 0 && (
                  <span>{stats.missingDocuments} missing docs</span>
                )}
                {stats.pendingConfirmations > 0 && (
                  <span>{stats.pendingConfirmations} pending confirmations</span>
                )}
                {stats.actionsNeeded === 0 && (
                  <span>All up to date</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="case-tracker" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="case-tracker" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Live Case Tracker
            </TabsTrigger>
            <TabsTrigger value="case-management" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Case Management
            </TabsTrigger>
            <TabsTrigger value="quick-actions" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Quick Actions
            </TabsTrigger>
          </TabsList>

          {/* Live Case Tracker Tab */}
          <TabsContent value="case-tracker" className="mt-6">
            <LiveCaseTracker 
              cases={liveCases} 
              loading={loading} 
              onRefresh={refetchStats} 
            />
          </TabsContent>

          {/* Case Management Tab */}
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

              {/* Document Upload */}
              <Card className="bg-gradient-card backdrop-blur-sm border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-kutlwano-teal">
                    <Upload className="h-5 w-5" />
                    Upload Documents
                  </CardTitle>
                  <CardDescription>
                    Upload case documents and medical records securely
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/document-uploading">
                      Upload Now
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

              {/* Your Claimants */}
              <Card className="bg-gradient-card backdrop-blur-sm border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-kutlwano-teal">
                    <Users className="h-5 w-5" />
                    Your Claimants
                  </CardTitle>
                  <CardDescription>
                    View and manage your claimant information
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
            </div>
          </TabsContent>

          {/* Quick Actions Tab */}
          <TabsContent value="quick-actions" className="mt-6">
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

              {/* Assessment Report Statistics */}
              <Card className="bg-gradient-card backdrop-blur-sm border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-kutlwano-blue">
                    <BarChart3 className="h-5 w-5" />
                    Performance Report
                  </CardTitle>
                  <CardDescription>
                    View detailed statistics and performance metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/assessment-reports-statistics">
                      View Statistics
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
                    View sample medico-legal reports and templates
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

              {/* Deleted Appointments */}
              <Card className="bg-gradient-card backdrop-blur-sm border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    Deleted Appointments
                  </CardTitle>
                  <CardDescription>
                    View and restore deleted appointment records
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/deleted-appointments">
                      View Deleted
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ReferringAttorneyAccessControl>
  );
};

export default ReferringAttorneyDashboard;
