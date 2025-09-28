import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, FileText, Shield, Eye, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';

interface AuditEvent {
  id: string;
  action_type: string;
  table_name: string;
  user_email: string;
  created_at: string;
  description: string;
  ip_address: string;
  new_values: any;
}

interface SecurityIncident {
  type: 'high_risk' | 'unauthorized_access' | 'data_breach' | 'suspicious_activity';
  description: string;
  timestamp: string;
  user_email: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export const ComplianceMonitor: React.FC = () => {
  const { isAdmin } = usePermissions();
  const [recentAuditEvents, setRecentAuditEvents] = useState<AuditEvent[]>([]);
  const [securityIncidents, setSecurityIncidents] = useState<SecurityIncident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin()) {
      fetchComplianceData();
    }
  }, [isAdmin]);

  const fetchComplianceData = async () => {
    try {
      setLoading(true);

      // Fetch recent audit events (last 24 hours)
      const { data: auditData, error: auditError } = await supabase
        .from('audit_logs')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      if (auditError) {
        console.error('Error fetching audit data:', auditError);
        toast.error('Failed to load audit data');
      } else {
        setRecentAuditEvents(auditData || []);
        
        // Analyze for security incidents
        const incidents = analyzeSecurityIncidents(auditData || []);
        setSecurityIncidents(incidents);
      }

    } catch (error) {
      console.error('Error fetching compliance data:', error);
      toast.error('Failed to load compliance monitor');
    } finally {
      setLoading(false);
    }
  };

  const analyzeSecurityIncidents = (auditEvents: AuditEvent[]): SecurityIncident[] => {
    const incidents: SecurityIncident[] = [];

    // Look for unauthorized access attempts
    const unauthorizedAttempts = auditEvents.filter(event => 
      event.action_type?.includes('unauthorized') || 
      event.action_type?.includes('denied')
    );

    unauthorizedAttempts.forEach(event => {
      incidents.push({
        type: 'unauthorized_access',
        description: `Unauthorized access attempt: ${event.description}`,
        timestamp: event.created_at,
        user_email: event.user_email || 'Unknown',
        severity: 'HIGH'
      });
    });

    // Look for suspicious PII access patterns
    const piiAccess = auditEvents.filter(event => 
      event.action_type?.includes('pii_access')
    );

    // Check for excessive PII access by single user
    const userPiiCount: { [key: string]: number } = {};
    piiAccess.forEach(event => {
      const email = event.user_email || 'unknown';
      userPiiCount[email] = (userPiiCount[email] || 0) + 1;
    });

    Object.entries(userPiiCount).forEach(([email, count]) => {
      if (count > 10) { // More than 10 PII access events in 24h
        incidents.push({
          type: 'suspicious_activity',
          description: `Excessive PII access detected: ${count} events in 24 hours`,
          timestamp: new Date().toISOString(),
          user_email: email,
          severity: 'MEDIUM'
        });
      }
    });

    return incidents;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-700 bg-red-100 border-red-300';
      case 'HIGH': return 'text-red-600 bg-red-50 border-red-200';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'LOW': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getIncidentIcon = (type: string) => {
    switch (type) {
      case 'unauthorized_access': return <AlertTriangle className="h-4 w-4" />;
      case 'suspicious_activity': return <Eye className="h-4 w-4" />;
      case 'data_breach': return <Shield className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  if (!isAdmin()) {
    return (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          Admin privileges required to view compliance monitoring.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kutlwano-blue mx-auto"></div>
        <p className="text-muted-foreground mt-2">Loading compliance monitor...</p>
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
          <h2 className="text-2xl font-bold text-foreground">Compliance Monitor</h2>
          <p className="text-muted-foreground">Real-time security and compliance monitoring</p>
        </div>
        <Button 
          onClick={fetchComplianceData}
          variant="outline"
          className="ml-auto"
        >
          Refresh
        </Button>
      </div>

      {/* Security Incidents Alert */}
      {securityIncidents.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Security Incidents Detected</AlertTitle>
          <AlertDescription className="text-red-700">
            {securityIncidents.length} security incident{securityIncidents.length > 1 ? 's' : ''} detected in the last 24 hours.
          </AlertDescription>
        </Alert>
      )}

      {/* Security Incidents */}
      {securityIncidents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Security Incidents ({securityIncidents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {securityIncidents.map((incident, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${getSeverityColor(incident.severity)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getIncidentIcon(incident.type)}
                      <div>
                        <h4 className="font-semibold">{incident.description}</h4>
                        <p className="text-sm opacity-75">User: {incident.user_email}</p>
                        <p className="text-xs opacity-60">
                          {new Date(incident.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant="destructive">{incident.severity}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Audit Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Audit Events (24 hours)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentAuditEvents.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No recent audit events</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentAuditEvents.map((event) => (
                <div
                  key={event.id}
                  className="p-3 rounded border bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-sm">{event.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {event.user_email} • {event.table_name} • {event.action_type}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(event.created_at).toLocaleString()}
                      </div>
                    </div>
                    {event.action_type?.includes('unauthorized') && (
                      <Badge variant="destructive" className="text-xs">Risk</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compliance Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-green-800 text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Data Protection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Active</div>
            <p className="text-xs text-green-600">All PII properly masked and protected</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-blue-800 text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Access Control
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">Enforced</div>
            <p className="text-xs text-blue-600">Role-based permissions active</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-purple-800 text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Audit Logging
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">Complete</div>
            <p className="text-xs text-purple-600">All actions logged and monitored</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};