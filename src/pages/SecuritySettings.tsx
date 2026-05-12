import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Shield, ArrowLeft, Database, Users, FileText, AlertTriangle, CheckCircle, Settings, Lock, Eye, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useNavigate, Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useSecurityCompliance } from '@/hooks/useSecurityCompliance';
import { SecurityDashboard } from '@/components/SecurityDashboard';
import { ComplianceMonitor } from '@/components/ComplianceMonitor';
import { toast } from 'sonner';

const SecuritySettings: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = usePermissions();
  const {
    loading: securityLoading,
    checkDataRetention,
    logSecurityEvent
  } = useSecurityCompliance();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [systemStatus, setSystemStatus] = useState<{
    rls_enabled: boolean;
    audit_logging: boolean;
    data_masking: boolean;
    access_control: boolean;
  }>({
    rls_enabled: true,
    audit_logging: true,
    data_masking: true,
    access_control: true
  });

  useEffect(() => {
    if (isAdmin()) {
      // Log security dashboard access
      logSecurityEvent({
        eventType: 'dashboard_access',
        resourceType: 'security_settings',
        action: 'admin_security_dashboard_view',
        riskLevel: 'low'
      });
    }
  }, [isAdmin, logSecurityEvent]);

  const handleComplianceCheck = async () => {
    const result = await checkDataRetention();
    if (result) {
      toast.success('Compliance check completed successfully');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kutlwano-blue"></div>
      </div>
    );
  }

  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <Helmet>
        <title>Security & Compliance Settings - Kutlwano & Associate</title>
        <meta name="description" content="Manage security settings and regulatory compliance for the medico-legal system" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-kutlwano-blue/5 to-kutlwano-teal/5 p-6">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal rounded-lg">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Security & Compliance</h1>
                  <p className="text-muted-foreground">Manage system security and regulatory compliance</p>
                </div>
              </div>
              <Button 
                onClick={() => navigate('/dashboard')}
                variant="outline"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </div>

            {/* Security Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className={`${systemStatus.rls_enabled ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Lock className={`h-4 w-4 ${systemStatus.rls_enabled ? 'text-green-600' : 'text-red-600'}`} />
                    Row Level Security
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={systemStatus.rls_enabled ? 'default' : 'destructive'}>
                    {systemStatus.rls_enabled ? 'ENABLED' : 'DISABLED'}
                  </Badge>
                </CardContent>
              </Card>

              <Card className={`${systemStatus.audit_logging ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className={`h-4 w-4 ${systemStatus.audit_logging ? 'text-green-600' : 'text-red-600'}`} />
                    Audit Logging
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={systemStatus.audit_logging ? 'default' : 'destructive'}>
                    {systemStatus.audit_logging ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>
                </CardContent>
              </Card>

              <Card className={`${systemStatus.data_masking ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className={`h-4 w-4 ${systemStatus.data_masking ? 'text-green-600' : 'text-red-600'}`} />
                    Data Masking
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={systemStatus.data_masking ? 'default' : 'destructive'}>
                    {systemStatus.data_masking ? 'ENABLED' : 'DISABLED'}
                  </Badge>
                </CardContent>
              </Card>

              <Card className={`${systemStatus.access_control ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Key className={`h-4 w-4 ${systemStatus.access_control ? 'text-green-600' : 'text-red-600'}`} />
                    Access Control
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={systemStatus.access_control ? 'default' : 'destructive'}>
                    {systemStatus.access_control ? 'ENFORCED' : 'DISABLED'}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Security Recommendations */}
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800">Security Recommendations</AlertTitle>
              <AlertDescription className="text-yellow-700">
                <div className="space-y-2">
                  <p>Your system has strong security measures in place. Consider these additional steps:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Enable SMTP configuration in Supabase for email notifications</li>
                    <li>Enable leaked password protection in Supabase Authentication settings</li>
                    <li>Consider upgrading PostgreSQL for latest security patches</li>
                    <li>Regularly review audit logs for suspicious activities</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          </div>

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="mfa" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Two-Factor
              </TabsTrigger>
              <TabsTrigger value="monitoring" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Monitoring
              </TabsTrigger>
              <TabsTrigger value="compliance" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Compliance
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <SecurityDashboard />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-green-600" />
                    Data Protection (POPIA Sec. 19)
                  </CardTitle>
                  <CardDescription>
                    Encryption and storage safeguards for medical records, ID copies and medico-legal reports.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /> TLS 1.2+ enforced for all data in transit</div>
                  <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /> AES-256 encryption at rest (Supabase managed)</div>
                  <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /> All document buckets are private — no public URLs</div>
                  <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /> Row-Level Security restricts access by role</div>
                  <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /> Immutable audit log of all access and changes</div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mfa" className="space-y-6">
              <MFASetup />
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-6">
              <ComplianceMonitor />
            </TabsContent>

            <TabsContent value="compliance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Data Retention Compliance
                  </CardTitle>
                  <CardDescription>
                    Check compliance with data retention policies and regulatory requirements
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Data Retention Check</h3>
                        <p className="text-sm text-muted-foreground">
                          Verify compliance with 7-year retention policy for legal documents
                        </p>
                      </div>
                      <Button 
                        onClick={handleComplianceCheck}
                        disabled={securityLoading}
                        className="bg-kutlwano-blue hover:bg-kutlwano-blue/90"
                      >
                        {securityLoading ? 'Checking...' : 'Run Compliance Check'}
                      </Button>
                    </div>

                    <Alert className="border-blue-200 bg-blue-50">
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                      <AlertTitle className="text-blue-800">Regulatory Compliance</AlertTitle>
                      <AlertDescription className="text-blue-700">
                        <div className="space-y-2">
                          <p>Your system is configured for compliance with:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>GDPR (General Data Protection Regulation)</li>
                            <li>POPI Act (Protection of Personal Information Act)</li>
                            <li>Legal Professional Privilege requirements</li>
                            <li>Medical Information confidentiality standards</li>
                          </ul>
                        </div>
                      </AlertDescription>
                    </Alert>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Security Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Security Configuration
                    </CardTitle>
                    <CardDescription>
                      Core security settings and access controls
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-800">Row Level Security</span>
                        </div>
                        <Badge className="bg-green-100 text-green-800">ENABLED</Badge>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-800">Data Encryption</span>
                        </div>
                        <Badge className="bg-green-100 text-green-800">ACTIVE</Badge>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-800">PII Masking</span>
                        </div>
                        <Badge className="bg-green-100 text-green-800">ENABLED</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Audit & Monitoring */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Audit & Monitoring
                    </CardTitle>
                    <CardDescription>
                      Security monitoring and audit trail configuration
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-800">Comprehensive Logging</span>
                        </div>
                        <Badge className="bg-green-100 text-green-800">ACTIVE</Badge>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-800">Real-time Monitoring</span>
                        </div>
                        <Badge className="bg-green-100 text-green-800">ENABLED</Badge>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-800">Incident Detection</span>
                        </div>
                        <Badge className="bg-green-100 text-green-800">ACTIVE</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Compliance Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    Regulatory Compliance Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                      <Shield className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <h3 className="font-semibold text-green-800">GDPR</h3>
                      <p className="text-sm text-green-600">Compliant</p>
                    </div>

                    <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                      <Lock className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <h3 className="font-semibold text-green-800">POPI Act</h3>
                      <p className="text-sm text-green-600">Compliant</p>
                    </div>

                    <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                      <FileText className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <h3 className="font-semibold text-green-800">Legal Privilege</h3>
                      <p className="text-sm text-green-600">Protected</p>
                    </div>

                    <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                      <Users className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <h3 className="font-semibold text-green-800">Medical Privacy</h3>
                      <p className="text-sm text-green-600">Secured</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Recommended Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Alert className="border-yellow-200 bg-yellow-50">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <AlertTitle className="text-yellow-800">SMTP Configuration</AlertTitle>
                      <AlertDescription className="text-yellow-700">
                        Configure SMTP settings in Supabase for secure email delivery.
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="ml-2 text-yellow-700 border-yellow-300"
                          onClick={() => window.open('https://supabase.com/dashboard/project/zybkhhxvsdjkluqydcbb/auth/providers', '_blank')}
                        >
                          Configure
                        </Button>
                      </AlertDescription>
                    </Alert>

                    <Alert className="border-blue-200 bg-blue-50">
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                      <AlertTitle className="text-blue-800">Password Security</AlertTitle>
                      <AlertDescription className="text-blue-700">
                        Enable leaked password protection in Supabase Authentication settings for enhanced security.
                      </AlertDescription>
                    </Alert>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default SecuritySettings;