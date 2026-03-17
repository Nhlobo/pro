import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Briefcase, Clock, FileText, AlertTriangle, CheckCircle2, Calendar, BarChart3, TrendingUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, differenceInDays, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface CaseSummary {
  total: number;
  urgent: number;
  pendingReports: number;
  completedThisMonth: number;
  averageDays: number;
}

const ExpertDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expertId, setExpertId] = useState<string | null>(null);
  const [expertName, setExpertName] = useState('');
  const [stats, setStats] = useState<CaseSummary>({ total: 0, urgent: 0, pendingReports: 0, completedThisMonth: 0, averageDays: 0 });
  const [upcomingCases, setUpcomingCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      // Get expert_id from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('expert_id')
        .eq('id', user.id)
        .single();

      if (!profile?.expert_id) { setLoading(false); return; }
      setExpertId(profile.expert_id);

      // Get expert name
      const { data: expert } = await supabase
        .from('medical_experts')
        .select('first_name, last_name')
        .eq('id', profile.expert_id)
        .single();
      if (expert) setExpertName(`${expert.first_name} ${expert.last_name}`);

      // Get appointments
      const { data: appointments } = await supabase
        .from('appointments')
        .select(`*, claimants(first_name, last_name, auto_id), referring_attorneys:referring_attorney_id(name)`)
        .eq('expert_id', profile.expert_id)
        .is('deleted_at', null)
        .order('appointment_date', { ascending: true });

      // Get expert reports
      const { data: reports } = await supabase
        .from('expert_reports')
        .select('*')
        .eq('expert_id', profile.expert_id);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const allAppts = appointments || [];
      const allReports = reports || [];

      const pending = allReports.filter(r => r.report_status !== 'completed' && r.report_status !== 'taken_out');
      const completedThisMonth = allReports.filter(r => 
        r.report_status === 'completed' && r.report_submitted_date && new Date(r.report_submitted_date) >= monthStart
      );
      const urgent = allReports.filter(r => {
        if (!r.report_due_date || r.report_status === 'completed') return false;
        return differenceInDays(parseISO(r.report_due_date), now) <= 7;
      });
      const avgDays = allReports.filter(r => r.days_to_complete).reduce((sum, r) => sum + (r.days_to_complete || 0), 0) / (allReports.filter(r => r.days_to_complete).length || 1);

      setStats({
        total: allAppts.length,
        urgent: urgent.length,
        pendingReports: pending.length,
        completedThisMonth: completedThisMonth.length,
        averageDays: Math.round(avgDays),
      });

      // Upcoming cases (next 5)
      const upcoming = allAppts
        .filter(a => new Date(a.appointment_date) >= now)
        .slice(0, 5)
        .map(a => {
          const report = allReports.find(r => r.appointment_id === a.id);
          return { ...a, report };
        });
      setUpcomingCases(upcoming);
      setLoading(false);
    };
    loadData();
  }, [user]);

  const getUrgencyBadge = (dueDate: string | null) => {
    if (!dueDate) return <Badge variant="outline" className="text-[10px]">No deadline</Badge>;
    const days = differenceInDays(parseISO(dueDate), new Date());
    if (days < 0) return <Badge className="bg-destructive text-destructive-foreground text-[10px]">Overdue</Badge>;
    if (days <= 3) return <Badge className="bg-destructive/80 text-destructive-foreground text-[10px]">Critical</Badge>;
    if (days <= 7) return <Badge className="bg-warning text-warning-foreground text-[10px]">Urgent</Badge>;
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
        <p className="text-sm text-muted-foreground">Your case overview and performance snapshot</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Cases', value: stats.total, icon: Briefcase, color: 'text-primary' },
          { label: 'Urgent', value: stats.urgent, icon: AlertTriangle, color: 'text-destructive' },
          { label: 'Pending Reports', value: stats.pendingReports, icon: Clock, color: 'text-warning' },
          { label: 'Completed (Month)', value: stats.completedThisMonth, icon: CheckCircle2, color: 'text-success' },
          { label: 'Avg Days', value: stats.averageDays, icon: TrendingUp, color: 'text-primary' },
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

      {/* Upcoming Assignments */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Upcoming Assignments
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate('/expert-portal/cases')}>View All</Button>
          </div>
        </CardHeader>
        <CardContent>
          {upcomingCases.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No upcoming assignments</p>
          ) : (
            <div className="space-y-3">
              {upcomingCases.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm text-foreground">
                        {c.claimants?.first_name} {c.claimants?.last_name}
                      </p>
                      {getUrgencyBadge(c.report?.report_due_date)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{format(parseISO(c.appointment_date), 'dd MMM yyyy')}</span>
                      <span>•</span>
                      <span>{c.referring_attorneys?.name || 'N/A'}</span>
                      <span>•</span>
                      <span>{c.matter_type || 'General'}</span>
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
