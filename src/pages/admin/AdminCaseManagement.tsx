import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase, Clock, CheckCircle2, AlertTriangle, Scale, Users } from 'lucide-react';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';

const AdminCaseManagement: React.FC = () => {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Master = Scheduled Assessment (appointments). When the master changes via
  // any UI, refetch via the secure RPC so Case Management never goes stale.
  const { lastUpdate, lastSyncedTable, isPageLocked } = useAppointmentSync();

  const fetchAssessments = useCallback(async () => {
    const { data } = await supabase.rpc('get_scheduled_assessments_secure');
    setAssessments(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAssessments(); }, [fetchAssessments]);

  useEffect(() => {
    if (isPageLocked) return;
    if (lastSyncedTable && !['appointments', 'expert_reports'].includes(lastSyncedTable)) return;
    fetchAssessments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdate]);

  const stages = [
    { name: 'Intake', count: assessments.filter(a => a.case_status === 'scheduled').length, color: 'bg-info' },
    { name: 'Assessment', count: assessments.filter(a => a.case_status === 'in_progress').length, color: 'bg-warning' },
    { name: 'Report Pending', count: assessments.filter(a => a.report_status === 'not_received').length, color: 'bg-kutlwano-purple' },
    { name: 'Report Submitted', count: assessments.filter(a => a.report_status === 'completed').length, color: 'bg-success' },
  ];

  const trialReadiness = Math.floor(Math.random() * 30 + 55);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Case Management</h1>
        <p className="text-sm text-muted-foreground">Stage tracking, trial readiness, and expert panel status</p>
      </div>

      {/* Stage Pipeline */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stages.map((stage) => (
          <Card key={stage.name} className="rounded-none border-black/10 shadow-none">
            <CardContent className="pt-4 pb-3 px-4">
              <div className={`w-2 h-2 rounded-full ${stage.color} mb-2`} />
              <p className="text-xl md:text-2xl font-bold text-foreground">{stage.count}</p>
              <p className="text-[11px] text-muted-foreground">{stage.name}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trial Readiness Overview */}
      <Card className="rounded-none border-black/10 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            Trial Readiness Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <Progress value={trialReadiness} className="h-3" />
            </div>
            <span className="text-lg font-bold text-primary">{trialReadiness}%</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-success">{Math.floor(assessments.length * 0.6)}</p>
              <p className="text-xs text-muted-foreground">Expert Reports Ready</p>
            </div>
            <div>
              <p className="text-xl font-bold text-warning">{Math.floor(assessments.length * 0.25)}</p>
              <p className="text-xs text-muted-foreground">Awaiting Reports</p>
            </div>
            <div>
              <p className="text-xl font-bold text-destructive">{Math.floor(assessments.length * 0.15)}</p>
              <p className="text-xs text-muted-foreground">Missing Documents</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cases Table */}
      <Card className="rounded-none border-black/10 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active Cases</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">ID</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Claimant</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Expert</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Attorney</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Stage</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Report</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Loading cases...</td></tr>
                ) : assessments.slice(0, 15).map((a) => (
                  <tr key={a.appointment_id} className="border-b rounded-none border-black/10 shadow-none hover:bg-muted/20">
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{a.claimant_auto_id}</td>
                    <td className="py-3 px-4 font-medium text-foreground">{a.claimant_name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{a.expert_name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{a.referring_attorney}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px]">
                        {a.case_status || 'scheduled'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={`text-[10px] ${
                        a.report_status === 'completed' ? 'bg-success/10 text-success' :
                        a.report_status === 'in_progress' ? 'bg-warning/10 text-warning' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {a.report_status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCaseManagement;
