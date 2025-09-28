import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Calendar,
  TrendingUp,
  Eye,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface ProcessStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  expectedDuration: number; // in days
  actualDuration?: number;
  completedAt?: string;
  qualityScore?: number;
}

interface CaseProcess {
  appointmentId: string;
  claimantName: string;
  expertType: string;
  steps: ProcessStep[];
  overallProgress: number;
  qualityRating: 'excellent' | 'good' | 'average' | 'poor';
  estimatedCompletion?: string;
  actualCompletion?: string;
}

export const ProcessTracker: React.FC = () => {
  const [processes, setProcesses] = useState<CaseProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProcess, setSelectedProcess] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProcessData = async () => {
    try {
      setLoading(true);
      
      // Fetch appointments with related data
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          case_status,
          payment_date,
          claimants(first_name, last_name),
          medical_experts(expert_type),
          expert_reports(
            report_status,
            report_submitted_date,
            payment_date,
            days_to_complete,
            expert_performance
          )
        `)
        .order('appointment_date', { ascending: false });

      if (appointmentsError) throw appointmentsError;

      const processedData = appointments?.map(appointment => {
        const steps: ProcessStep[] = [
          {
            id: 'appointment_scheduled',
            name: 'Appointment Scheduled',
            status: appointment.appointment_date ? 'completed' : 'pending',
            expectedDuration: 1,
            completedAt: appointment.appointment_date
          },
          {
            id: 'payment_received',
            name: 'Payment Received',
            status: appointment.payment_date ? 'completed' : 'pending',
            expectedDuration: 3,
            completedAt: appointment.payment_date
          },
          {
            id: 'assessment_conducted',
            name: 'Assessment Conducted',
            status: appointment.case_status === 'completed' ? 'completed' : 
                   appointment.case_status === 'in_progress' ? 'in_progress' : 'pending',
            expectedDuration: 7
          },
          {
            id: 'report_submitted',
            name: 'Report Submitted',
            status: appointment.expert_reports?.[0]?.report_status === 'completed' ? 'completed' : 'pending',
            expectedDuration: 14,
            completedAt: appointment.expert_reports?.[0]?.report_submitted_date,
            actualDuration: appointment.expert_reports?.[0]?.days_to_complete,
            qualityScore: appointment.expert_reports?.[0]?.expert_performance === 'good' ? 85 :
                         appointment.expert_reports?.[0]?.expert_performance === 'average' ? 70 : 
                         appointment.expert_reports?.[0]?.expert_performance === 'bad' ? 50 : undefined
          }
        ];

        const completedSteps = steps.filter(step => step.status === 'completed').length;
        const overallProgress = (completedSteps / steps.length) * 100;

        // Calculate quality rating based on timeliness and completeness
        let qualityRating: 'excellent' | 'good' | 'average' | 'poor' = 'average';
        if (appointment.expert_reports?.[0]?.expert_performance) {
          qualityRating = appointment.expert_reports[0].expert_performance === 'good' ? 'excellent' :
                         appointment.expert_reports[0].expert_performance === 'average' ? 'good' : 'poor';
        }

        return {
          appointmentId: appointment.id,
          claimantName: `${appointment.claimants?.[0]?.first_name || ''} ${appointment.claimants?.[0]?.last_name || ''}`.trim() || 'Unknown',
          expertType: appointment.medical_experts?.[0]?.expert_type || 'Unknown',
          steps,
          overallProgress,
          qualityRating,
          estimatedCompletion: appointment.appointment_date ? 
            format(new Date(new Date(appointment.appointment_date).getTime() + 21 * 24 * 60 * 60 * 1000), 'MMM dd, yyyy') : 
            undefined,
          actualCompletion: appointment.expert_reports?.[0]?.report_submitted_date ?
            format(new Date(appointment.expert_reports[0].report_submitted_date), 'MMM dd, yyyy') : undefined
        };
      }) || [];

      setProcesses(processedData);
    } catch (error) {
      console.error('Error fetching process data:', error);
      toast({
        title: "Error",
        description: "Failed to load process tracking data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcessData();
  }, []);

  const getStatusColor = (status: ProcessStep['status']) => {
    switch (status) {
      case 'completed': return 'bg-success text-success-foreground';
      case 'in_progress': return 'bg-warning text-warning-foreground';
      case 'overdue': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getQualityColor = (rating: CaseProcess['qualityRating']) => {
    switch (rating) {
      case 'excellent': return 'text-success';
      case 'good': return 'text-kutlwano-teal';
      case 'average': return 'text-warning';
      case 'poor': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading Process Tracker...
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
            <TrendingUp className="h-5 w-5 text-kutlwano-blue" />
            Automated Process Tracking
          </CardTitle>
          <CardDescription>
            Real-time monitoring of all medico-legal processes with quality metrics
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Process Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-card border-border/50 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-kutlwano-blue" />
              <span className="text-sm font-medium">Active Processes</span>
            </div>
            <div className="text-2xl font-bold text-kutlwano-blue">
              {processes.filter(p => p.overallProgress < 100).length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-sm font-medium">Completed</span>
            </div>
            <div className="text-2xl font-bold text-success">
              {processes.filter(p => p.overallProgress === 100).length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-sm font-medium">At Risk</span>
            </div>
            <div className="text-2xl font-bold text-warning">
              {processes.filter(p => p.qualityRating === 'poor').length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-kutlwano-teal" />
              <span className="text-sm font-medium">Avg Quality</span>
            </div>
            <div className="text-2xl font-bold text-kutlwano-teal">
              {Math.round(processes.reduce((acc, p) => {
                const score = p.qualityRating === 'excellent' ? 95 :
                             p.qualityRating === 'good' ? 85 :
                             p.qualityRating === 'average' ? 70 : 50;
                return acc + score;
              }, 0) / (processes.length || 1))}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Process List */}
      <div className="space-y-4">
        {processes.map((process) => (
          <Card key={process.appointmentId} className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{process.claimantName}</CardTitle>
                  <CardDescription>
                    {process.expertType} • ID: {process.appointmentId.slice(0, 8)}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getQualityColor(process.qualityRating)}>
                    {process.qualityRating.toUpperCase()}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedProcess(
                      selectedProcess === process.appointmentId ? null : process.appointmentId
                    )}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Overall Progress</span>
                  <span className="font-medium">{Math.round(process.overallProgress)}%</span>
                </div>
                <Progress value={process.overallProgress} className="h-2" />
              </div>
            </CardHeader>

            {selectedProcess === process.appointmentId && (
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {process.steps.map((step) => (
                    <div key={step.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`${getStatusColor(step.status)} text-xs`}>
                          {step.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-sm font-medium">{step.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Expected: {step.expectedDuration} days
                        {step.actualDuration && (
                          <div>Actual: {step.actualDuration} days</div>
                        )}
                        {step.qualityScore && (
                          <div>Quality: {step.qualityScore}%</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {process.estimatedCompletion && (
                  <Alert className="mt-4">
                    <Calendar className="h-4 w-4" />
                    <AlertDescription>
                      <div className="flex justify-between">
                        <span>Estimated Completion: {process.estimatedCompletion}</span>
                        {process.actualCompletion && (
                          <span>Actual: {process.actualCompletion}</span>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {processes.length === 0 && (
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Processes Found</h3>
            <p className="text-muted-foreground">
              No active medico-legal processes to track at this time.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};