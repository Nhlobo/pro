import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
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

        {/* Automated Tracking and Quality Control Tabs */}
        <Tabs defaultValue="tracking" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tracking" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Process Tracking
            </TabsTrigger>
            <TabsTrigger value="quality" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Quality Control
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

          <TabsContent value="dashboard" className="mt-6">
            {/* Assessment and Reports Section */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Assessment and Reports
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                {/* Attorney Info Update - First Priority */}
                <Card className="bg-gradient-card backdrop-blur-sm border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-kutlwano-blue">
                      <Users className="h-5 w-5" />
                      Attorney Info Update
                    </CardTitle>
                    <CardDescription>
                      Update referring attorney information and view scheduled assessments
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild className="w-full">
                      <Link to="/referring-attorney-update">
                        Update Attorney Info
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                {/* Claimant Reports */}
                <Card className="bg-gradient-card backdrop-blur-sm border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-kutlwano-teal">
                      <FileText className="h-5 w-5" />
                      Claimant Reports
                    </CardTitle>
                    <CardDescription>
                      Access and download your claimant assessment reports
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/claimant-reports">
                        View Reports
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

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

            {/* Case Management Section */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Case Management
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Request New Appointment */}
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
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ReferringAttorneyAccessControl>
  );
};

export default ReferringAttorneyDashboard;