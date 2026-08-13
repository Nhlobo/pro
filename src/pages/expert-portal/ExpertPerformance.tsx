import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, Clock, CheckCircle2, AlertTriangle, Award, Target, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BRAND_TEAL } from '@/components/admin/ui/AdminUI';
import {
  PortalPage,
  PortalHeader,
  SyncStatus,
  PortalEmptyState,
  PortalStatStrip,
  PortalCard,
  PortalCardHeader,
  PortalCardBody,
  PortalLoadingState,
  type PortalStatTile,
} from '@/components/attorney-portal/ui/PortalPrimitives';
import { ExpertNotLinkedState } from '@/components/portal/ExpertNotLinkedState';
import { useExpertLinkStatus } from '@/hooks/useExpertLinkStatus';
import { differenceInDays, parseISO, format, subMonths } from 'date-fns';

/**
 * Expert Portal — Performance.
 *
 * Rebuilt to match AdminAnalytics.tsx (the system's Analytics page):
 * the same square, single-teal-accent progress fills with a 700ms
 * `transition-all` animation on load, the same PortalStatStrip KPI
 * panel instead of a scatter of separate cards, and semantic color
 * (success/warning/destructive) reserved for real state only — not
 * the mix of bg-primary/bg-success/bg-warning/bg-destructive block
 * colors this page used for quality ratings before.
 */

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
  const linkStatus = useExpertLinkStatus();
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [notLinked, setNotLinked] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: profile } = await supabase.from('profiles').select('expert_id').eq('id', user.id).single();
    if (!profile?.expert_id) { setNotLinked(true); setLoading(false); return; }

    const [reportsRes, apptsRes] = await Promise.all([
      supabase.from('expert_reports').select('*').eq('expert_id', profile.expert_id),
      supabase.from('appointments').select('id, appointment_date').eq('expert_id', profile.expert_id).is('deleted_at', null),
    ]);

    const reports = reportsRes.data || [];
    const appointments = apptsRes.data || [];
    const completed = reports.filter(r => r.report_status === 'completed' || r.report_status === 'taken_out');
    const withDays = completed.filter(r => r.days_to_complete != null);
    const avgDays = withDays.length > 0 ? Math.round(withDays.reduce((s, r) => s + (r.days_to_complete || 0), 0) / withDays.length) : 0;

    const withDue = completed.filter(r => r.report_due_date && r.report_submitted_date);
    const onTime = withDue.filter(r => new Date(r.report_submitted_date!) <= new Date(r.report_due_date!));
    const onTimeRate = withDue.length > 0 ? Math.round((onTime.length / withDue.length) * 100) : 100;

    const overdue = reports.filter(r => {
      if (!r.report_due_date || r.report_status === 'completed') return false;
      return differenceInDays(parseISO(r.report_due_date), new Date()) < 0;
    });

    const excellent = completed.filter(r => r.expert_performance === 'excellent').length;
    const good = completed.filter(r => r.expert_performance === 'good').length;
    const average = completed.filter(r => r.expert_performance === 'average').length;
    const poor = completed.filter(r => r.expert_performance === 'poor').length;

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
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-success';
    if (score >= 70) return 'text-black';
    if (score >= 50) return 'text-warning';
    return 'text-destructive';
  };

  if (linkStatus === 'checking') {
    return (
      <PortalPage>
        <PortalHeader eyebrow="Expert Portal" title="Performance Intelligence" icon={BarChart3} />
        <PortalLoadingState label="Checking your account…" />
      </PortalPage>
    );
  }

  if (linkStatus === 'not_linked' || notLinked) {
    return (
      <PortalPage>
        <PortalHeader eyebrow="Expert Portal" title="Performance Intelligence" icon={BarChart3} />
        <ExpertNotLinkedState description="Your account is not linked to a medical expert profile, so there's no performance data to show yet. Contact an administrator or get help below." />
      </PortalPage>
    );
  }

  if (!loading && !metrics) {
    return (
      <PortalPage>
        <PortalHeader eyebrow="Expert Portal" title="Performance Intelligence" icon={BarChart3} />
        <PortalEmptyState icon={BarChart3} title="No performance data available" />
      </PortalPage>
    );
  }

  const statTiles: PortalStatTile[] = metrics ? [
    { label: 'Total Cases', value: metrics.totalCases, icon: Target },
    { label: 'Reports Completed', value: metrics.completedReports, icon: CheckCircle2 },
    { label: 'Avg Days', value: `${metrics.avgDaysToComplete}d`, icon: Clock },
    { label: 'On-Time Rate', value: `${metrics.onTimeRate}%`, icon: Zap },
    { label: 'Overdue', value: metrics.overdueCount, icon: AlertTriangle, urgent: metrics.overdueCount > 0 },
  ] : [];

  const maxMonthly = metrics ? Math.max(...metrics.monthlyTrend.map(t => t.completed), 1) : 1;

  return (
    <PortalPage>
      <PortalHeader
        eyebrow="Expert Portal"
        title="Performance Intelligence"
        description="Your comprehensive performance scoring and analytics."
        icon={BarChart3}
        actions={<SyncStatus loading={loading} onRefresh={load} label="Live data" />}
      />

      {!metrics ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading performance data…</div>
      ) : (
      <>
      {/* Overall Score */}
      <PortalCard>
        <PortalCardBody className="flex flex-col items-center gap-6 md:flex-row">
          <div className="text-center">
            <div className={`text-5xl font-black ${getScoreColor(metrics.overallScore)}`}>{metrics.overallScore}</div>
            <div className="text-xs text-slate-400">/100</div>
          </div>
          <div className="w-full flex-1">
            <div className="mb-2 flex items-center gap-2">
              <Award className={`h-5 w-5 ${getScoreColor(metrics.overallScore)}`} />
              <h2 className="text-lg font-bold text-black">{metrics.overallRating}</h2>
            </div>
            <div className="h-2 w-full bg-black/5">
              <div
                className="h-2 transition-all duration-700"
                style={{ width: `${metrics.overallScore}%`, backgroundColor: BRAND_TEAL }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Based on completion rate (30%), speed (30%), on-time delivery (20%), and quality ratings (20%)
            </p>
          </div>
        </PortalCardBody>
      </PortalCard>

      {/* Key Metrics */}
      <PortalStatStrip tiles={statTiles} loading={loading} className="sm:grid-cols-5" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {/* Quality Breakdown */}
        <PortalCard>
          <PortalCardHeader title="Quality Ratings Breakdown" description="Based on admin performance evaluations" />
          <PortalCardBody className="space-y-4">
            {[
              { label: 'Excellent', count: metrics.excellentCount },
              { label: 'Good', count: metrics.goodCount },
              { label: 'Average', count: metrics.averageCount },
              { label: 'Poor', count: metrics.poorCount },
            ].map(q => {
              const pct = metrics.completedReports > 0 ? Math.round((q.count / metrics.completedReports) * 100) : 0;
              return (
                <div key={q.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-black">{q.label}</span>
                    <span className="text-slate-500">{q.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 w-full bg-black/5">
                    <div
                      className="h-2 transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: BRAND_TEAL }}
                    />
                  </div>
                </div>
              );
            })}
          </PortalCardBody>
        </PortalCard>

        {/* Monthly Trend */}
        <PortalCard>
          <PortalCardHeader icon={TrendingUp} title="Monthly Trend" description="Reports completed per month (last 6 months)" />
          <PortalCardBody className="space-y-3">
            {metrics.monthlyTrend.map(m => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-[11px] text-slate-500">{m.month}</span>
                <div className="relative h-5 flex-1 bg-black/5">
                  <div
                    className="flex h-full items-center justify-end pr-2 transition-all duration-700"
                    style={{ width: `${Math.min(100, (m.completed / maxMonthly) * 100)}%`, backgroundColor: BRAND_TEAL }}
                  >
                    {m.completed > 0 && <span className="text-[10px] font-medium text-white">{m.completed}</span>}
                  </div>
                </div>
                {m.avgDays > 0 && <span className="w-12 shrink-0 text-right text-[10px] text-slate-400">{m.avgDays}d avg</span>}
              </div>
            ))}
          </PortalCardBody>
        </PortalCard>
      </div>
      </>
      )}
    </PortalPage>
  );
};

export default ExpertPerformance;
