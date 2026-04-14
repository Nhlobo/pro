import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Target, Users, Pencil, Check, X, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useTeamTargets } from '@/hooks/useTeamTargets';
import { SalesConsultant, MonthlyPerformance } from '@/hooks/useSalesIncentives';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TeamTargetsCardProps {
  consultants: SalesConsultant[];
  allPerformance: MonthlyPerformance[];
  isAdmin?: boolean;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface PeriodActual {
  total: number;
  raf: number;
  medneg: number;
  perConsultant: Record<string, { total: number; raf: number; medneg: number }>;
}

const TeamTargetsCard: React.FC<TeamTargetsCardProps> = ({ consultants, allPerformance, isAdmin = false }) => {
  const {
    currentMonth,
    currentYear,
    currentQuarter,
    getCurrentTarget,
    upsertTarget,
  } = useTeamTargets();

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [periodActuals, setPeriodActuals] = useState<Record<string, PeriodActual>>({});
  const [loadingActuals, setLoadingActuals] = useState(true);

  const activeConsultants = consultants.filter(c => c.is_active);
  const teamSize = activeConsultants.length || 1;

  const fetchPeriodActuals = useCallback(async () => {
    setLoadingActuals(true);
    try {
      const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const monthEnd = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

      const qStartMonth = (currentQuarter - 1) * 3 + 1;
      const qStart = `${currentYear}-${String(qStartMonth).padStart(2, '0')}-01`;
      const qEnd = new Date(currentYear, qStartMonth + 2, 0).toISOString().split('T')[0];

      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;

      const [monthRes, quarterRes, yearRes] = await Promise.all([
        supabase.rpc('get_consultant_period_stats', { p_start: monthStart, p_end: monthEnd }),
        supabase.rpc('get_consultant_period_stats', { p_start: qStart, p_end: qEnd }),
        supabase.rpc('get_consultant_period_stats', { p_start: yearStart, p_end: yearEnd }),
      ]);

      const buildActual = (data: any[]): PeriodActual => {
        const rows = data || [];
        const perConsultant: Record<string, { total: number; raf: number; medneg: number }> = {};
        rows.forEach((r: any) => {
          if (r.consultant_id) {
            perConsultant[r.consultant_id] = {
              total: Number(r.total_appts || 0),
              raf: Number(r.raf_appts || 0),
              medneg: Number(r.medneg_appts || 0),
            };
          }
        });
        return {
          total: rows.reduce((s: number, r: any) => s + Number(r.total_appts || 0), 0),
          raf: rows.reduce((s: number, r: any) => s + Number(r.raf_appts || 0), 0),
          medneg: rows.reduce((s: number, r: any) => s + Number(r.medneg_appts || 0), 0),
          perConsultant,
        };
      };

      setPeriodActuals({
        monthly: buildActual(monthRes.data as any[]),
        quarterly: buildActual(quarterRes.data as any[]),
        yearly: buildActual(yearRes.data as any[]),
      });
    } catch (err) {
      console.error('Error fetching period actuals:', err);
    } finally {
      setLoadingActuals(false);
    }
  }, [currentMonth, currentYear, currentQuarter]);

  useEffect(() => {
    fetchPeriodActuals();
  }, [fetchPeriodActuals]);

  const startEdit = (key: string, currentVal: number) => {
    setEditingKey(key);
    setEditValue(String(currentVal));
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const saveTarget = async (periodType: 'monthly' | 'quarterly' | 'yearly') => {
    const val = parseInt(editValue);
    if (isNaN(val) || val < 0) {
      toast.error('Please enter a valid target number');
      return;
    }

    const opts: any = {};
    if (periodType === 'monthly') opts.month = currentMonth;
    if (periodType === 'quarterly') opts.quarter = currentQuarter;

    const { error } = await upsertTarget(periodType, val, opts);
    if (error) {
      toast.error('Failed to save target');
    } else {
      toast.success(`${periodType.charAt(0).toUpperCase() + periodType.slice(1)} target updated`);
      cancelEdit();
    }
  };

  const monthlyTarget = getCurrentTarget('monthly');
  const quarterlyTarget = getCurrentTarget('quarterly');
  const yearlyTarget = getCurrentTarget('yearly');

  const qStartMonth = (currentQuarter - 1) * 3;

  const rows = [
    {
      key: 'monthly',
      period: `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`,
      periodType: 'monthly' as const,
      target: monthlyTarget?.team_target || 0,
      actual: periodActuals.monthly?.total || 0,
      raf: periodActuals.monthly?.raf || 0,
      medneg: periodActuals.monthly?.medneg || 0,
    },
    {
      key: 'quarterly',
      period: `Q${currentQuarter} (${MONTH_NAMES[qStartMonth]}–${MONTH_NAMES[qStartMonth + 2]}) ${currentYear}`,
      periodType: 'quarterly' as const,
      target: quarterlyTarget?.team_target || 0,
      actual: periodActuals.quarterly?.total || 0,
      raf: periodActuals.quarterly?.raf || 0,
      medneg: periodActuals.quarterly?.medneg || 0,
    },
    {
      key: 'yearly',
      period: `${currentYear}`,
      periodType: 'yearly' as const,
      target: yearlyTarget?.team_target || 0,
      actual: periodActuals.yearly?.total || 0,
      raf: periodActuals.yearly?.raf || 0,
      medneg: periodActuals.yearly?.medneg || 0,
    },
  ];

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-blue-500';
    if (progress >= 50) return 'bg-amber-500';
    return 'bg-destructive';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Target vs Actual — Scheduled Assessments
          <Badge variant="outline" className="text-[10px] ml-auto">
            <Users className="h-3 w-3 mr-1" />
            {teamSize} active
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Target = assessments to achieve · Actual = fetched from scheduled assessments
        </p>
      </CardHeader>
      <CardContent>
        {loadingActuals ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading actuals from scheduled assessments…</span>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Main comparison table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs font-semibold">Period</TableHead>
                    <TableHead className="text-xs font-semibold text-center">Target</TableHead>
                    <TableHead className="text-xs font-semibold text-center">Actual</TableHead>
                    <TableHead className="text-xs font-semibold text-center">RAF</TableHead>
                    <TableHead className="text-xs font-semibold text-center">Med Neg</TableHead>
                    <TableHead className="text-xs font-semibold text-center">Variance</TableHead>
                    <TableHead className="text-xs font-semibold text-center w-[140px]">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const variance = row.actual - row.target;
                    const progress = row.target > 0 ? Math.min(100, Math.round((row.actual / row.target) * 100)) : 0;
                    const isEditing = editingKey === row.key;
                    const perPerson = teamSize > 0 && row.target > 0 ? Math.ceil(row.target / teamSize) : 0;

                    return (
                      <TableRow key={row.key} className="hover:bg-muted/30">
                        <TableCell className="py-3">
                          <div className="text-sm font-semibold text-foreground">{row.period}</div>
                          {perPerson > 0 && (
                            <span className="text-[10px] text-muted-foreground">{perPerson} per consultant</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center py-3">
                          {isEditing ? (
                            <div className="flex items-center gap-1 justify-center">
                              <Input
                                type="number"
                                min={0}
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                className="h-7 w-20 text-xs text-center"
                                autoFocus
                              />
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveTarget(row.periodType)}>
                                <Check className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEdit}>
                                <X className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-sm font-bold text-foreground">{row.target || '—'}</span>
                              {isAdmin && (
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(row.key, row.target)}>
                                  <Pencil className="h-3 w-3 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center py-3">
                          <span className="text-sm font-bold text-foreground">{row.actual}</span>
                        </TableCell>
                        <TableCell className="text-center py-3">
                          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                            {row.raf}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center py-3">
                          <Badge variant="outline" className="text-[10px] bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400 border-teal-200 dark:border-teal-800">
                            {row.medneg}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center py-3">
                          {row.target > 0 ? (
                            <div className="flex items-center justify-center gap-1">
                              {variance > 0 ? (
                                <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                              ) : variance < 0 ? (
                                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                              ) : (
                                <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <Badge
                                variant={variance >= 0 ? 'default' : 'destructive'}
                                className="text-[10px]"
                              >
                                {variance >= 0 ? '+' : ''}{variance}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center py-3 min-w-[140px]">
                          {row.target > 0 ? (
                            <div className="space-y-1.5">
                              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(progress)}`}
                                  style={{ width: `${Math.min(100, progress)}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground">{row.actual}/{row.target}</span>
                                <span className={`text-[10px] font-bold ${progress >= 100 ? 'text-green-600' : progress >= 75 ? 'text-blue-600' : progress >= 50 ? 'text-amber-600' : 'text-destructive'}`}>
                                  {progress}%
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No target set</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Per-consultant breakdown for current month */}
            {rows[0].target > 0 && (
              <div className="pt-3 border-t">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Monthly Breakdown — Per Consultant
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {activeConsultants.map(c => {
                    const cData = periodActuals.monthly?.perConsultant?.[c.id];
                    const cAppts = cData?.total || 0;
                    const cRaf = cData?.raf || 0;
                    const cMedneg = cData?.medneg || 0;
                    const perPerson = Math.ceil(rows[0].target / teamSize);
                    const cProgress = perPerson > 0 ? Math.min(100, Math.round((cAppts / perPerson) * 100)) : 0;
                    const met = cAppts >= perPerson;

                    return (
                      <div
                        key={c.id}
                        className={`p-2.5 rounded-lg border ${met ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20' : 'border-border bg-muted/30'}`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-foreground truncate">{c.name}</span>
                          <span className={`text-[10px] font-bold ${met ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {cAppts}/{perPerson}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden mb-1">
                          <div
                            className={`h-full rounded-full transition-all ${getProgressColor(cProgress)}`}
                            style={{ width: `${cProgress}%` }}
                          />
                        </div>
                        <div className="flex gap-2 text-[9px] text-muted-foreground">
                          <span>RAF: {cRaf}</span>
                          <span>MN: {cMedneg}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TeamTargetsCard;
