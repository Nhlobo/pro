import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, Clock, Users, Database, Key, Eye, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';

interface ComplianceStatus {
  table_name: string;
  record_count: number;
  oldest_record: string;
  compliance_status: string;
  action_required: string;
}

interface SecurityMetrics {
  total_users: number;
  admin_users: number;
  recent_logins: number;
  failed_attempts: number;
  data_access_events: number;
}

export const SecurityDashboard: React.FC = () => {
  const { isAdmin } = usePermissions();
  const [complianceData, setComplianceData] = useState<ComplianceStatus[]>([]);
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin()) {
      fetchSecurityData();
    }
  }, [isAdmin]);

  const fetchSecurityData = async () => {
    try {
      setLoading(true);
      
      // Fetch compliance data
      const { data: compliance, error: complianceError } = await supabase
        .rpc('check_data_retention_compliance');

      if (complianceError) {
        console.error('Error fetching compliance data:', complianceError);
        toast.error('Failed to load compliance data');
      } else {
        setComplianceData(compliance || []);
      }

      // Fetch security metrics from audit logs
      const { data: metrics, error: metricsError } = await supabase
        .from('audit_logs')
        .select('*')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (!metricsError && metrics) {
        // Calculate security metrics
        const securityEvents = metrics.filter(log => log.function_area === 'security_compliance');
        const loginEvents = metrics.filter(log => log.action_type === 'LOGIN');
        const failedAttempts = metrics.filter(log => log.action_type?.includes('failed') || log.action_type?.includes('denied'));
        const dataAccess = securityEvents.filter(log => log.action_type?.includes('pii_access'));

        setSecurityMetrics({
          total_users: 0, // This would need a separate query
          admin_users: 0,  // This would need a separate query
          recent_logins: loginEvents.length,
          failed_attempts: failedAttempts.length,
          data_access_events: dataAccess.length
        });
      }

    } catch (error) {
      console.error('Error fetching security data:', error);
      toast.error('Failed to load security dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getComplianceStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLIANT': return 'text-green-600 bg-green-50 border-green-200';
      case 'WARNING': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'NON_COMPLIANT': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getComplianceIcon = (status: string) => {
    switch (status) {
      case 'COMPLIANT': return <CheckCircle className="h-4 w-4" />;
      case 'WARNING': return <Clock className="h-4 w-4" />;
      case 'NON_COMPLIANT': return <AlertTriangle className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  if (!isAdmin()) {
    return (
      <div className="p-6 text-center">
        <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-muted-foreground">Access Denied</h3>
        <p className="text-muted-foreground">Admin privileges required to view security dashboard.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kutlwano-blue mx-auto"></div>
        <p className="text-muted-foreground mt-2">Loading security dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal rounded-lg">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Security & Compliance Dashboard</h1>
          <p className="text-muted-foreground">Monitor system security and regulatory compliance status</p>
        </div>
        <Button 
          onClick={fetchSecurityData}
          variant="outline"
          className="ml-auto"
        >
          Refresh Data
        </Button>
      </div>

      {/* Security Metrics Overview */}
      {securityMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Logins</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{securityMetrics.recent_logins}</div>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Attempts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{securityMetrics.failed_attempts}</div>
              <p className="text-xs text-muted-foreground">Security incidents</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Data Access</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{securityMetrics.data_access_events}</div>
              <p className="text-xs text-muted-foreground">PII access events</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compliance Status</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {complianceData.filter(item => item.compliance_status === 'COMPLIANT').length}
              </div>
              <p className="text-xs text-muted-foreground">Tables compliant</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Compliance Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Data Retention Compliance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {complianceData.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No compliance data available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {complianceData.map((item, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${getComplianceStatusColor(item.compliance_status)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getComplianceIcon(item.compliance_status)}
                      <div>
                        <h3 className="font-semibold capitalize">
                          {item.table_name.replace('_', ' ')} Table
                        </h3>
                        <p className="text-sm opacity-75">
                          {item.record_count} records • Oldest: {new Date(item.oldest_record).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant={item.compliance_status === 'COMPLIANT' ? 'default' : 'destructive'}>
                      {item.compliance_status}
                    </Badge>
                  </div>
                  {item.action_required !== 'No action required' && (
                    <div className="mt-3 p-3 bg-white/50 rounded border">
                      <p className="text-sm font-medium">Action Required:</p>
                      <p className="text-sm">{item.action_required}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};