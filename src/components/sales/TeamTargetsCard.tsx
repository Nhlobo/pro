import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Target, Users, Pencil, Check, X, Loader2 } from 'lucide-react';
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

  // Fetch actual appointment counts for all periods
  const fetchPeriodActuals = useCallback(async () => {
    setLoadingActuals(true);
    try {
      // Monthly: current month
      const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const monthEnd = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

      // Quarterly: current quarter
      const qStartMonth = (currentQuarter - 1) * 3 + 1;
      const qStart = `${currentYear}-${String(qStartMonth).padStart(2, '0')}-01`;
      const qEnd = new Date(currentYear, qStartMonth + 2, 0).toISOString().split('T')[0];

      // Yearly
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;

      const [monthRes, quarterRes, yearRes] = await Promise.all([
        supabase.rpc('get_consultant_period_stats', { p_start: monthStart, p_end: monthEnd }),
        supabase.rpc('get_consultant_period_stats', { p_start: qStart, p_end: qEnd }),
        supabase.rpc('get_consultant_period_stats', { p_start: yearStart, p_end: yearEnd }),
      ]);

      const sumStats = (data: any[]) => {
        const rows = data || [];
        return {
          total: rows.reduce((s, r) => s + Number(r.total_appts || 0), 0),
          raf: rows.reduce((s, r) => s + Number(r.raf_appts || 0), 0),
          medneg: rows.reduce((s, r) => s + Number(r.medneg_appts || 0), 0),
        };
      };

      setPeriodActuals({
        monthly: sumStats(monthRes.data as any[]),
        quarterly: sumStats(quarterRes.data as any[]),
        yearly: sumStats(yearRes.data as any[]),
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Target vs Actual
          <Badge variant="outline" className="text-[10px] ml-auto">
            <Users className="h-3 w-3 mr-1" />
            {teamSize} active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loadingActuals ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading actuals…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Period</TableHead>
                  <TableHead className="text-xs text-center">Target</TableHead>
                  <TableHead className="text-xs text-center">Actual</TableHead>
                  <TableHead className="text-xs text-center">RAF</TableHead>
                  <TableHead className="text-xs text-center">Med Neg</TableHead>
                  <TableHead className="text-xs text-center">Variance</TableHead>
                  <TableHead className="text-xs text-center">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const variance = row.actual - row.target;
                  const progress = row.target > 0 ? Math.min(100, Math.round((row.actual / row.target) * 100)) : 0;
                  const isEditing = editingKey === row.key;
                  const perPerson = teamSize > 0 && row.target > 0 ? Math.ceil(row.target / teamSize) : 0;

                  return (
                    <TableRow key={row.key}>
                      <TableCell className="text-sm font-medium">
                        <div>{row.period}</div>
                        {perPerson > 0 && (
                          <span className="text-[10px] text-muted-foreground">{perPerson}/person</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
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
                            <span className="text-sm font-bold">{row.target || '—'}</span>
                            {isAdmin && (
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(row.key, row.target)}>
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm font-bold">{row.actual}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                          {row.raf}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[10px] bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400 border-teal-200 dark:border-teal-800">
                          {row.medneg}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {row.target > 0 ? (
                          <Badge
                            variant={variance >= 0 ? 'default' : 'destructive'}
                            className="text-[10px]"
                          >
                            {variance >= 0 ? '+' : ''}{variance}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center min-w-[100px]">
                        {row.target > 0 ? (
                          <div className="space-y-1">
                            <Progress value={progress} className="h-2" />
                            <span className="text-[10px] text-muted-foreground">{progress}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Per-consultant breakdown for current month */}
        {!loadingActuals && rows[0].target > 0 && (
          <div className="mt-4 pt-3 border-t">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Monthly — Per Consultant
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activeConsultants.map(c => {
                const cPerf = allPerformance.find(p => p.consultant_id === c.id);
                const cAppts = cPerf?.total_appts || 0;
                const perPerson = Math.ceil((rows[0].target) / teamSize);
                const met = cAppts >= perPerson;
                return (
                  <Badge
                    key={c.id}
                    variant={met ? 'default' : 'outline'}
                    className={`text-[9px] ${!met ? 'border-destructive/50 text-destructive' : ''}`}
                  >
                    {c.name.split(' ')[0]}: {cAppts}/{perPerson}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TeamTargetsCard;
