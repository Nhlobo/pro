import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Briefcase, Clock, FileText, AlertTriangle, CheckCircle2, Calendar, BarChart3, TrendingUp, User
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, differenceInDays, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const ExpertDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expertId, setExpertId] = useState<string | null>(null);
  const [expertName, setExpertName] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    upcomingAppointments: 0,
    pendingReports: 0,
    overdueReports: 0,
    completedAssessments: 0,
    totalCases: 0,
    averageDays: 0,
  });
  const [upcomingCases, setUpcomingCases] = useState<any[]>([]);
  const [overdueReports, setOverdueReports] = useState<any[]>([]);
  const [pendingReportsList, setPendingReportsList] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('expert_id')
        .eq('id', user.id)
        .single();

      if (!profile?.expert_id) { setLoading(false); return; }
      setExpertId(profile.expert_id);

      const { data: expert } = await supabase
        .from('medical_experts')
        .select('first_name, last_name')
        .eq('id', profile.expert_id)
        .single();
      if (expert) setExpertName(`${expert.first_name} ${expert.last_name}`);

      const [apptsRes, reportsRes] = await Promise.all([
        supabase
          .from('appointments')
          .select(`*, claimants(first_name, last_name, auto_id), referring_attorneys:referring_attorney_id(name)`)
          .eq('expert_id', profile.expert_id)
          .is('deleted_at', null)
          .order('appointment_date', { ascending: true }),
        supabase
          .from('expert_reports')
          .select('*')
          .eq('expert_id', profile.expert_id),
      ]);

      const now = new Date();
      const allAppts = apptsRes.data || [];
      const allReports = reportsRes.data || [];

      // Upcoming appointments (future dates)
      const upcoming = allAppts.filter(a => new Date(a.appointment_date) >= now);

      // Pending reports (not completed, not taken out)
      const pending = allReports.filter(r => r.report_status !== 'completed' && r.report_status !== 'taken_out');

      // Overdue reports
      const overdue = allReports.filter(r => {
        if (!r.report_due_date || r.report_status === 'completed' || r.report_status === 'taken_out') return false;
        return differenceInDays(parseISO(r.report_due_date), now) < 0;
      });

      // Completed assessments
      const completed = allReports.filter(r => r.report_status === 'completed' || r.report_status === 'taken_out');

      // Avg days
      const withDays = completed.filter(r => r.days_to_complete != null);
      const avgDays = withDays.length > 0 ? Math.round(withDays.reduce((s, r) => s + (r.days_to_complete || 0), 0) / withDays.length) : 0;

      setStats({
        upcomingAppointments: upcoming.length,
        pendingReports: pending.length,
        overdueReports: overdue.length,
        completedAssessments: completed.length,
        totalCases: allAppts.length,
        averageDays: avgDays,
      });

      // Upcoming cases with report info (next 5)
      const upcomingWithReports = upcoming.slice(0, 5).map(a => {
        const report = allReports.find(r => r.appointment_id === a.id);
        return { ...a, report };
      });
      setUpcomingCases(upcomingWithReports);

      // Overdue reports list with appointment info
      setOverdueReports(overdue.slice(0, 5).map(r => {
        const appt = allAppts.find(a => a.id === r.appointment_id);
        return { ...r, appointment: appt };
      }));

      // Pending reports list
      setPendingReportsList(pending.filter(r => !overdue.includes(r)).slice(0, 5).map(r => {
        const appt = allAppts.find(a => a.id === r.appointment_id);
        return { ...r, appointment: appt };
      }));

      setLoading(false);
    };
    loadData();
  }, [user]);

  const getUrgencyBadge = (dueDate: string | null) => {
    if (!dueDate) return <Badge variant="outline" className="text-[10px]">No deadline</Badge>;
    const days = differenceInDays(parseISO(dueDate), new Date());
    if (days < 0) return <Badge className="bg-destructive text-destructive-foreground text-[10px]">Overdue by {Math.abs(days)}d</Badge>;
    if (days <= 3) return <Badge className="bg-destructive/80 text-destructive-foreground text-[10px]">Critical ({days}d)</Badge>;
    if (days <= 7) return <Badge className="bg-warning text-warning-foreground text-[10px]">Urgent ({days}d)</Badge>;
    return <Badge className="bg-success/20 text-success text-[10px]">{days}d left</Badge>;
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading dashboard...</div>;

  if (!expertId) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-warning" />
        <h2 className="text-xl font-bold text-foreground mb-2">Expert Profile Not Linked</h2>
        <p className="text-muted-foreground">Your account is not linked to a medical expert profile. Contact an administrator.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome, Dr. {expertName}</h1>
        <p className="text-sm text-muted-foreground">Your case overview and task summary</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Upcoming Appointments', value: stats.upcomingAppointments, icon: Calendar, color: 'text-primary', onClick: () => navigate('/expert-portal/schedule') },
          { label: 'Pending Reports', value: stats.pendingReports, icon: Clock, color: 'text-warning', onClick: () => navigate('/expert-portal/reports') },
          { label: 'Overdue Reports', value: stats.overdueReports, icon: AlertTriangle, color: 'text-destructive', onClick: () => navigate('/expert-portal/reports') },
          { label: 'Completed Assessments', value: stats.completedAssessments, icon: CheckCircle2, color: 'text-success', onClick: () => navigate('/expert-portal/performance') },
          { label: 'Total Cases', value: stats.totalCases, icon: Briefcase, color: 'text-primary', onClick: () => navigate('/expert-portal/cases') },
          { label: 'Avg Days to Complete', value: stats.averageDays, icon: TrendingUp, color: 'text-muted-foreground' },
        ].map(s => (
          <Card key={s.label} className="border-border/50 cursor-pointer hover:shadow-md transition-shadow" onClick={s.onClick}>
            <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color} shrink-0`} />
              <div>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overdue Reports Alert */}
      {overdueReports.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Overdue Reports ({overdueReports.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueReports.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-background">
                  <div>
                    <p className="font-medium text-sm text-foreground">
                      {r.appointment?.claimants?.first_name} {r.appointment?.claimants?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Due: {r.report_due_date ? format(parseISO(r.report_due_date), 'dd MMM yyyy') : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getUrgencyBadge(r.report_due_date)}
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate(`/expert-portal/case/${r.appointment_id}`)}>
                      View Case
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upcoming Appointments */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Upcoming Appointments
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate('/expert-portal/schedule')}>View All</Button>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingCases.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming appointments</p>
            ) : (
              <div className="space-y-3">
                {upcomingCases.map(c => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => navigate(`/expert-portal/case/${c.id}`)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm text-foreground">
                          {c.claimants?.first_name} {c.claimants?.last_name}
                        </p>
                        {getUrgencyBadge(c.report?.report_due_date)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{format(parseISO(c.appointment_date), 'dd MMM yyyy HH:mm')}</span>
                        <span>•</span>
                        <span>{c.referring_attorneys?.name || 'N/A'}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {c.report?.report_status || c.case_status || 'Scheduled'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Reports */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-warning" />
                Pending Reports
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate('/expert-portal/reports')}>View All</Button>
            </div>
          </CardHeader>
          <CardContent>
            {pendingReportsList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No pending reports</p>
            ) : (
              <div className="space-y-3">
                {pendingReportsList.map(r => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => navigate(`/expert-portal/case/${r.appointment_id}`)}
                  >
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {r.appointment?.claimants?.first_name} {r.appointment?.claimants?.last_name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span>{r.appointment?.referring_attorneys?.name || 'N/A'}</span>
                        {r.report_due_date && (
                          <>
                            <span>•</span>
                            <span>Due: {format(parseISO(r.report_due_date), 'dd MMM')}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {getUrgencyBadge(r.report_due_date)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/expert-portal/cases')}>
          <Briefcase className="h-5 w-5 text-primary" />
          <span className="text-xs">View Cases</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/expert-portal/schedule')}>
          <Calendar className="h-5 w-5 text-primary" />
          <span className="text-xs">My Schedule</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/expert-portal/reports')}>
          <FileText className="h-5 w-5 text-primary" />
          <span className="text-xs">Report Tracking</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/expert-portal/performance')}>
          <BarChart3 className="h-5 w-5 text-primary" />
          <span className="text-xs">Performance</span>
        </Button>
      </div>
    </div>
  );
};

export default ExpertDashboard;
