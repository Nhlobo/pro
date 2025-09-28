import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  BarChart3,
  FileCheck,
  Users,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';

interface QualityMetric {
  id: string;
  name: string;
  value: number;
  target: number;
  status: 'excellent' | 'good' | 'warning' | 'poor';
  trend: 'up' | 'down' | 'stable';
  description: string;
}

interface ComplianceAlert {
  id: string;
  type: 'quality' | 'deadline' | 'process' | 'performance';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  appointmentId?: string;
  dueDate?: string;
  actionRequired: string;
}

export const QualityControl: React.FC = () => {
  const [metrics, setMetrics] = useState<QualityMetric[]>([]);
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  const fetchQualityData = async () => {
    try {
      setLoading(true);

      // Fetch appointments and expert reports for quality analysis
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          case_status,
          payment_date,
          created_at,
          claimants(first_name, last_name),
          medical_experts(expert_type, first_name, last_name),
          expert_reports(
            report_status,
            report_submitted_date,
            payment_date,
            days_to_complete,
            expert_performance,
            created_at
          )
        `)
        .order('created_at', { ascending: false });

      if (appointmentsError) throw appointmentsError;

      // Calculate quality metrics
      const totalAppointments = appointments?.length || 0;
      const completedReports = appointments?.filter(a => 
        a.expert_reports?.some(r => r.report_status === 'completed')
      ).length || 0;
      
      const onTimeReports = appointments?.filter(a => 
        a.expert_reports?.some(r => 
          r.report_status === 'completed' && 
          r.days_to_complete && 
          r.days_to_complete <= 14
        )
      ).length || 0;

      const excellentPerformance = appointments?.filter(a =>
        a.expert_reports?.some(r => r.expert_performance === 'good')
      ).length || 0;

      const overDueReports = appointments?.filter(a => {
        if (!a.payment_date) return false;
        const paymentDate = new Date(a.payment_date);
        const daysSincePayment = differenceInDays(new Date(), paymentDate);
        return daysSincePayment > 21 && !a.expert_reports?.some(r => r.report_status === 'completed');
      }).length || 0;

      // Generate quality metrics
      const qualityMetrics: QualityMetric[] = [
        {
          id: 'completion_rate',
          name: 'Report Completion Rate',
          value: totalAppointments > 0 ? (completedReports / totalAppointments) * 100 : 0,
          target: 95,
          status: completedReports / totalAppointments >= 0.95 ? 'excellent' : 
                 completedReports / totalAppointments >= 0.85 ? 'good' : 
                 completedReports / totalAppointments >= 0.70 ? 'warning' : 'poor',
          trend: 'up',
          description: 'Percentage of assessments with completed reports'
        },
        {
          id: 'timeliness',
          name: 'On-Time Report Delivery',
          value: completedReports > 0 ? (onTimeReports / completedReports) * 100 : 0,
          target: 90,
          status: onTimeReports / completedReports >= 0.90 ? 'excellent' : 
                 onTimeReports / completedReports >= 0.75 ? 'good' : 
                 onTimeReports / completedReports >= 0.60 ? 'warning' : 'poor',
          trend: 'stable',
          description: 'Reports delivered within 14 days of payment'
        },
        {
          id: 'expert_performance',
          name: 'Expert Performance Rating',
          value: completedReports > 0 ? (excellentPerformance / completedReports) * 100 : 0,
          target: 85,
          status: excellentPerformance / completedReports >= 0.85 ? 'excellent' : 
                 excellentPerformance / completedReports >= 0.70 ? 'good' : 
                 excellentPerformance / completedReports >= 0.55 ? 'warning' : 'poor',
          trend: 'up',
          description: 'Percentage of reports with excellent expert performance'
        },
        {
          id: 'overdue_reports',
          name: 'Overdue Report Rate',
          value: totalAppointments > 0 ? (overDueReports / totalAppointments) * 100 : 0,
          target: 5,
          status: overDueReports / totalAppointments <= 0.05 ? 'excellent' : 
                 overDueReports / totalAppointments <= 0.10 ? 'good' : 
                 overDueReports / totalAppointments <= 0.20 ? 'warning' : 'poor',
          trend: 'down',
          description: 'Reports overdue by more than 21 days'
        }
      ];

      // Generate compliance alerts
      const complianceAlerts: ComplianceAlert[] = [];

      // Check for overdue reports
      appointments?.forEach(appointment => {
        if (appointment.payment_date && !appointment.expert_reports?.some(r => r.report_status === 'completed')) {
          const paymentDate = new Date(appointment.payment_date);
          const daysSincePayment = differenceInDays(new Date(), paymentDate);
          
          if (daysSincePayment > 21) {
            complianceAlerts.push({
              id: `overdue_${appointment.id}`,
              type: 'deadline',
              severity: daysSincePayment > 30 ? 'high' : 'medium',
              title: 'Overdue Report',
              description: `Report for ${appointment.claimants?.[0]?.first_name || ''} ${appointment.claimants?.[0]?.last_name || ''}`.trim() || 'Unknown' + ` is ${daysSincePayment} days overdue`,
              appointmentId: appointment.id,
              dueDate: format(new Date(paymentDate.getTime() + 21 * 24 * 60 * 60 * 1000), 'MMM dd, yyyy'),
              actionRequired: 'Contact expert for immediate report submission'
            });
          } else if (daysSincePayment > 14) {
            complianceAlerts.push({
              id: `warning_${appointment.id}`,
              type: 'quality',
              severity: 'low',
              title: 'Report Due Soon',
              description: `Report for ${appointment.claimants?.[0]?.first_name || ''} ${appointment.claimants?.[0]?.last_name || ''}`.trim() || 'Unknown' + ` is due in ${21 - daysSincePayment} days`,
              appointmentId: appointment.id,
              dueDate: format(new Date(paymentDate.getTime() + 21 * 24 * 60 * 60 * 1000), 'MMM dd, yyyy'),
              actionRequired: 'Follow up with expert on progress'
            });
          }
        }
      });

      // Check for performance issues
      appointments?.forEach(appointment => {
        appointment.expert_reports?.forEach(report => {
          if (report.expert_performance === 'bad') {
            complianceAlerts.push({
              id: `performance_${appointment.id}`,
              type: 'performance',
              severity: 'high',
              title: 'Poor Expert Performance',
              description: `Expert performance rated as poor for ${appointment.claimants?.[0]?.first_name || ''} ${appointment.claimants?.[0]?.last_name || ''}`.trim() || 'Unknown',
              appointmentId: appointment.id,
              actionRequired: 'Review expert assignment and consider alternative'
            });
          }
        });
      });

      setMetrics(qualityMetrics);
      setAlerts(complianceAlerts);

    } catch (error) {
      console.error('Error fetching quality control data:', error);
      toast({
        title: "Error",
        description: "Failed to load quality control data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQualityData();
  }, []);

  const getMetricColor = (status: QualityMetric['status']) => {
    switch (status) {
      case 'excellent': return 'text-success';
      case 'good': return 'text-kutlwano-teal';
      case 'warning': return 'text-warning';
      case 'poor': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getAlertColor = (severity: ComplianceAlert['severity']) => {
    switch (severity) {
      case 'high': return 'border-destructive bg-destructive/5';
      case 'medium': return 'border-warning bg-warning/5';
      case 'low': return 'border-kutlwano-blue bg-kutlwano-blue/5';
      default: return 'border-muted';
    }
  };

  const getSeverityIcon = (severity: ComplianceAlert['severity']) => {
    switch (severity) {
      case 'high': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'medium': return <Clock className="h-4 w-4 text-warning" />;
      case 'low': return <Shield className="h-4 w-4 text-kutlwano-blue" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading Quality Control...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-border/50 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-kutlwano-blue" />
            Quality Control Dashboard
          </CardTitle>
          <CardDescription>
            Automated quality monitoring and compliance tracking for medico-legal processes
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Quality Metrics</TabsTrigger>
          <TabsTrigger value="alerts">Compliance Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((metric) => (
              <Card key={metric.id} className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">{metric.name}</div>
                    <TrendingUp className={`h-4 w-4 ${
                      metric.trend === 'up' ? 'text-success' : 
                      metric.trend === 'down' ? 'text-destructive' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div className={`text-2xl font-bold ${getMetricColor(metric.status)}`}>
                    {Math.round(metric.value)}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Target: {metric.target}%
                  </div>
                  <Progress 
                    value={Math.min(metric.value, 100)} 
                    className="h-2 mt-2"
                  />
                  <Badge className={`mt-2 ${getMetricColor(metric.status)}`}>
                    {metric.status.toUpperCase()}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* High Priority Alerts */}
          {alerts.filter(alert => alert.severity === 'high').length > 0 && (
            <Alert className="border-destructive bg-destructive/5">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>High Priority Issues</AlertTitle>
              <AlertDescription>
                {alerts.filter(alert => alert.severity === 'high').length} high priority issues require immediate attention.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {metrics.map((metric) => (
              <Card key={metric.id} className="bg-gradient-card border-border/50 shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{metric.name}</span>
                    <Badge className={getMetricColor(metric.status)}>
                      {metric.status.toUpperCase()}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{metric.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Current Performance</span>
                      <span className={`text-2xl font-bold ${getMetricColor(metric.status)}`}>
                        {Math.round(metric.value)}%
                      </span>
                    </div>
                    <Progress value={Math.min(metric.value, 100)} className="h-3" />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>0%</span>
                      <span>Target: {metric.target}%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {alerts.length === 0 ? (
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">All Systems Normal</h3>
                <p className="text-muted-foreground">
                  No compliance alerts or quality issues detected.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <Alert key={alert.id} className={getAlertColor(alert.severity)}>
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(alert.severity)}
                    <div className="flex-1">
                      <AlertTitle className="flex items-center justify-between">
                        <span>{alert.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {alert.type.toUpperCase()}
                        </Badge>
                      </AlertTitle>
                      <AlertDescription className="mt-2">
                        <div>{alert.description}</div>
                        {alert.dueDate && (
                          <div className="text-xs mt-1">Due: {alert.dueDate}</div>
                        )}
                        <div className="text-xs font-medium mt-2 text-foreground">
                          Action Required: {alert.actionRequired}
                        </div>
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};