import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Clock, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO, differenceInDays } from 'date-fns';

const ExpertReportTracking: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('expert_id').eq('id', user.id).single();
      if (!profile?.expert_id) { setLoading(false); return; }

      const [reportsRes, apptsRes] = await Promise.all([
        supabase.from('expert_reports').select('*').eq('expert_id', profile.expert_id).order('created_at', { ascending: false }),
        supabase.from('appointments')
          .select(`id, appointment_date, matter_type, claimants(first_name, last_name, auto_id), referring_attorneys:referring_attorney_id(name)`)
          .eq('expert_id', profile.expert_id)
          .is('deleted_at', null),
      ]);
      setReports(reportsRes.data || []);
      setAppointments(apptsRes.data || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed': return <Badge className="bg-success/20 text-success text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'taken_out': return <Badge className="bg-primary/20 text-primary text-[10px]">Taken Out</Badge>;
      case 'in_progress': return <Badge className="bg-warning/20 text-warning text-[10px]"><Clock className="h-3 w-3 mr-1" />In Progress</Badge>;
      case 'under_review': return <Badge className="bg-primary/20 text-primary text-[10px]">Under Review</Badge>;
      default: return <Badge variant="outline" className="text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Not Received</Badge>;
    }
  };

  const stats = {
    total: reports.length,
    pending: reports.filter(r => !['completed', 'taken_out'].includes(r.report_status || '')).length,
    completed: reports.filter(r => r.report_status === 'completed').length,
    overdue: reports.filter(r => {
      if (!r.report_due_date || r.report_status === 'completed') return false;
      return differenceInDays(parseISO(r.report_due_date), new Date()) < 0;
    }).length,
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading reports...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" /> Report Tracking
        </h1>
        <p className="text-sm text-muted-foreground">Track all report submissions and deadlines</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Reports', value: stats.total, icon: FileText, color: 'text-primary' },
          { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-warning' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-success' },
          { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: 'text-destructive' },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claimant</TableHead>
                  <TableHead>Attorney</TableHead>
                  <TableHead>Assessment Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No reports found</TableCell></TableRow>
                ) : (
                  reports.map(r => {
                    const appt = appointments.find(a => a.id === r.appointment_id);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">{appt?.claimants?.first_name} {appt?.claimants?.last_name}</TableCell>
                        <TableCell className="text-sm">{(appt as any)?.referring_attorneys?.name || 'N/A'}</TableCell>
                        <TableCell className="text-sm">{appt ? format(parseISO(appt.appointment_date), 'dd MMM yyyy') : '—'}</TableCell>
                        <TableCell className="text-sm">{r.report_due_date ? format(parseISO(r.report_due_date), 'dd MMM yyyy') : '—'}</TableCell>
                        <TableCell className="text-sm">{r.report_submitted_date ? format(parseISO(r.report_submitted_date), 'dd MMM yyyy') : '—'}</TableCell>
                        <TableCell>
                          {r.days_to_complete ? (
                            <Badge variant="secondary" className="text-[10px]">{r.days_to_complete}d</Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell>{getStatusBadge(r.report_status)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpertReportTracking;
