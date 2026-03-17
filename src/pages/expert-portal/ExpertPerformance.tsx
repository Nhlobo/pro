import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart3, TrendingUp, Clock, CheckCircle2, AlertTriangle, Award, Target, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { differenceInDays, parseISO, format, subMonths } from 'date-fns';

interface PerformanceMetrics {
  totalCases: number;
  completedReports: number;
  avgDaysToComplete: number;
  onTimeRate: number;
  overdueCount: number;
  excellentCount: number;
  goodCount: number;
  averageCount: number;
  poorCount: number;
  monthlyTrend: { month: string; completed: number; avgDays: number }[];
  overallScore: number;
  overallRating: string;
}

const ExpertPerformance: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('expert_id').eq('id', user.id).single();
      if (!profile?.expert_id) { setLoading(false); return; }

      const [reportsRes, apptsRes] = await Promise.all([
        supabase.from('expert_reports').select('*').eq('expert_id', profile.expert_id),
        supabase.from('appointments').select('id, appointment_date').eq('expert_id', profile.expert_id).is('deleted_at', null),
      ]);

      const reports = reportsRes.data || [];
      const appointments = apptsRes.data || [];
      const completed = reports.filter(r => r.report_status === 'completed' || r.report_status === 'taken_out');
      const withDays = completed.filter(r => r.days_to_complete != null);
      const avgDays = withDays.length > 0 ? Math.round(withDays.reduce((s, r) => s + (r.days_to_complete || 0), 0) / withDays.length) : 0;

      // On-time rate: completed before or on due date
      const withDue = completed.filter(r => r.report_due_date && r.report_submitted_date);
      const onTime = withDue.filter(r => new Date(r.report_submitted_date!) <= new Date(r.report_due_date!));
      const onTimeRate = withDue.length > 0 ? Math.round((onTime.length / withDue.length) * 100) : 100;

      const overdue = reports.filter(r => {
        if (!r.report_due_date || r.report_status === 'completed') return false;
        return differenceInDays(parseISO(r.report_due_date), new Date()) < 0;
      });

      // Performance ratings
      const excellent = completed.filter(r => r.expert_performance === 'excellent').length;
      const good = completed.filter(r => r.expert_performance === 'good').length;
      const average = completed.filter(r => r.expert_performance === 'average').length;
      const poor = completed.filter(r => r.expert_performance === 'poor').length;

      // Monthly trend (last 6 months)
      const monthlyTrend: { month: string; completed: number; avgDays: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthStr = format(monthDate, 'MMM yyyy');
        const monthReports = completed.filter(r => {
          if (!r.report_submitted_date) return false;
          const d = parseISO(r.report_submitted_date);
          return d.getMonth() === monthDate.getMonth() && d.getFullYear() === monthDate.getFullYear();
        });
        const monthAvg = monthReports.filter(r => r.days_to_complete).reduce((s, r) => s + (r.days_to_complete || 0), 0) / (monthReports.filter(r => r.days_to_complete).length || 1);
        monthlyTrend.push({ month: monthStr, completed: monthReports.length, avgDays: Math.round(monthAvg) });
      }

      // Overall score (0-100)
      const completionScore = Math.min(100, (completed.length / Math.max(reports.length, 1)) * 100);
      const speedScore = avgDays <= 14 ? 100 : avgDays <= 21 ? 80 : avgDays <= 30 ? 60 : avgDays <= 45 ? 40 : 20;
      const qualityScore = completed.length > 0
        ? ((excellent * 100 + good * 75 + average * 50 + poor * 25) / completed.length)
        : 50;
      const overallScore = Math.round((completionScore * 0.3 + speedScore * 0.3 + onTimeRate * 0.2 + qualityScore * 0.2));
      const overallRating = overallScore >= 85 ? 'Excellent' : overallScore >= 70 ? 'Good' : overallScore >= 50 ? 'Average' : 'Needs Improvement';

      setMetrics({
        totalCases: appointments.length,
        completedReports: completed.length,
        avgDaysToComplete: avgDays,
        onTimeRate,
        overdueCount: overdue.length,
        excellentCount: excellent,
        goodCount: good,
        averageCount: average,
        poorCount: poor,
        monthlyTrend,
        overallScore,
        overallRating,
      });
      setLoading(false);
    };
    load();
  }, [user]);

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-success';
    if (score >= 70) return 'text-primary';
    if (score >= 50) return 'text-warning';
    return 'text-destructive';
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading performance data...</div>;
  if (!metrics) return <div className="text-center py-12 text-muted-foreground">No performance data available</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> Performance Intelligence
        </h1>
        <p className="text-sm text-muted-foreground">Your comprehensive performance scoring and analytics</p>
      </div>

      {/* Overall Score */}
      <Card className="border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-6 pb-5 flex flex-col md:flex-row items-center gap-6">
          <div className="relative">
            <div className={`text-5xl font-black ${getScoreColor(metrics.overallScore)}`}>{metrics.overallScore}</div>
            <div className="text-xs text-muted-foreground text-center">/100</div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Award className={`h-5 w-5 ${getScoreColor(metrics.overallScore)}`} />
              <h2 className="text-lg font-bold text-foreground">{metrics.overallRating}</h2>
            </div>
            <Progress value={metrics.overallScore} className="h-3 mb-2" />
            <p className="text-xs text-muted-foreground">
              Based on completion rate (30%), speed (30%), on-time delivery (20%), and quality ratings (20%)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Cases', value: metrics.totalCases, icon: Target, color: 'text-primary' },
          { label: 'Reports Completed', value: metrics.completedReports, icon: CheckCircle2, color: 'text-success' },
          { label: 'Avg Days', value: `${metrics.avgDaysToComplete}d`, icon: Clock, color: 'text-warning' },
          { label: 'On-Time Rate', value: `${metrics.onTimeRate}%`, icon: Zap, color: 'text-primary' },
          { label: 'Overdue', value: metrics.overdueCount, icon: AlertTriangle, color: 'text-destructive' },
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

      <div className="grid md:grid-cols-2 gap-6">
        {/* Quality Breakdown */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quality Ratings Breakdown</CardTitle>
            <CardDescription className="text-xs">Based on admin performance evaluations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Excellent', count: metrics.excellentCount, color: 'bg-success', total: metrics.completedReports },
              { label: 'Good', count: metrics.goodCount, color: 'bg-primary', total: metrics.completedReports },
              { label: 'Average', count: metrics.averageCount, color: 'bg-warning', total: metrics.completedReports },
              { label: 'Poor', count: metrics.poorCount, color: 'bg-destructive', total: metrics.completedReports },
            ].map(q => {
              const pct = q.total > 0 ? Math.round((q.count / q.total) * 100) : 0;
              return (
                <div key={q.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">{q.label}</span>
                    <span className="text-muted-foreground">{q.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${q.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Monthly Trend
            </CardTitle>
            <CardDescription className="text-xs">Reports completed per month (last 6 months)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.monthlyTrend.map(m => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">{m.month}</span>
                  <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-primary/70 rounded-full transition-all flex items-center justify-end pr-2"
                      style={{ width: `${Math.min(100, (m.completed / Math.max(...metrics.monthlyTrend.map(t => t.completed), 1)) * 100)}%` }}
                    >
                      {m.completed > 0 && <span className="text-[10px] text-primary-foreground font-medium">{m.completed}</span>}
                    </div>
                  </div>
                  {m.avgDays > 0 && <span className="text-[10px] text-muted-foreground w-10 text-right">{m.avgDays}d avg</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExpertPerformance;
