import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Target, Users, Pencil, Check, X, Loader2, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { useTeamTargets } from '@/hooks/useTeamTargets';
import { SalesConsultant, MonthlyPerformance } from '@/hooks/useSalesIncentives';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TeamTargetsCardProps {
  consultants: SalesConsultant[];
  allPerformance: MonthlyPerformance[];
  isAdmin?: boolean;
}

const Q_LABELS = ['Q1', 'Q2', 'Q3', 'Q4'];
const Q_MONTHS = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'];

const TeamTargetsCard: React.FC<TeamTargetsCardProps> = ({ consultants, allPerformance, isAdmin = false }) => {
  const {
    targets,
    currentMonth,
    currentYear,
    currentQuarter,
    upsertTarget,
  } = useTeamTargets();

  const [editingQ, setEditingQ] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [quarterActuals, setQuarterActuals] = useState<Record<number, { total: number; mva: number; medneg: number; byConsultant: Record<string, { total: number; mva: number; medneg: number }> }>>({});
  const [loadingActuals, setLoadingActuals] = useState(true);

  const activeConsultants = consultants.filter(c => c.is_active);
  const teamSize = activeConsultants.length || 1;

  // Fetch actuals via SECURITY DEFINER RPC so all roles see the same numbers as admins
  const fetchActuals = useCallback(async () => {
    setLoadingActuals(true);
    try {
      const { data, error } = await supabase.rpc('get_quarter_actuals_by_consultant', { p_year: currentYear });
      if (error) throw error;
      const rows = (data || []) as Array<{ quarter: number; sales_consultant_id: string | null; total: number; mva: number; medneg: number }>;
      const actuals: Record<number, { total: number; mva: number; medneg: number; byConsultant: Record<string, { total: number; mva: number; medneg: number }> }> = {
        1: { total: 0, mva: 0, medneg: 0, byConsultant: {} },
        2: { total: 0, mva: 0, medneg: 0, byConsultant: {} },
        3: { total: 0, mva: 0, medneg: 0, byConsultant: {} },
        4: { total: 0, mva: 0, medneg: 0, byConsultant: {} },
      };
      rows.forEach(r => {
        const q = Number(r.quarter);
        if (!actuals[q]) return;
        const cid = r.sales_consultant_id || 'unattributed';
        const total = Number(r.total) || 0;
        const mva = Number(r.mva) || 0;
        const medneg = Number(r.medneg) || 0;
        actuals[q].total += total;
        actuals[q].mva += mva;
        actuals[q].medneg += medneg;
        if (!actuals[q].byConsultant[cid]) actuals[q].byConsultant[cid] = { total: 0, mva: 0, medneg: 0 };
        actuals[q].byConsultant[cid].total += total;
        actuals[q].byConsultant[cid].mva += mva;
        actuals[q].byConsultant[cid].medneg += medneg;
      });
      setQuarterActuals(actuals);
    } catch (err) {
      console.error('Error fetching actuals:', err);
    } finally {
      setLoadingActuals(false);
    }
  }, [currentYear]);

  useEffect(() => {
    fetchActuals();
  }, [fetchActuals]);

  // Real-time refresh when appointments change
  useEffect(() => {
    const channel = supabase
      .channel('team-targets-actuals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchActuals();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchActuals]);

  // Get monthly target for each quarter (stored as quarterly target's team_target)
  const getQuarterMonthlyTarget = (q: number): number => {
    const t = targets.find(t => t.period_type === 'quarterly' && t.period_quarter === q);
    return t?.team_target || 0;
  };

  const startEdit = (q: number) => {
    setEditingQ(q);
    setEditValue(String(getQuarterMonthlyTarget(q)));
  };

  const cancelEdit = () => {
    setEditingQ(null);
    setEditValue('');
  };

  const saveQuarterTarget = async (q: number) => {
    const val = parseInt(editValue);
    if (isNaN(val) || val < 0) {
      toast.error('Please enter a valid number');
      return;
    }
    const { error } = await upsertTarget('quarterly', val, { quarter: q });
    if (error) {
      toast.error('Failed to save target');
    } else {
      toast.success(`Q${q} monthly target updated to ${val}`);
      cancelEdit();
    }
  };

  // Build quarter rows for a specific group: 'consultant' (all attributed
  // sales consultants combined) or 'non-consultant' (unattributed/direct).
  const buildQuarterRows = (group: 'consultant' | 'non-consultant') => {
    return [1, 2, 3, 4].map(q => {
      const monthly = getQuarterMonthlyTarget(q);
      const quarterlyTotal = monthly * 3;
      const byCons = quarterActuals[q]?.byConsultant || {};
      let actual = 0, mva = 0, medneg = 0;
      Object.entries(byCons).forEach(([cid, v]) => {
        const isUnattr = cid === 'unattributed';
        if ((group === 'consultant' && !isUnattr) || (group === 'non-consultant' && isUnattr)) {
          actual += v.total; mva += v.mva; medneg += v.medneg;
        }
      });
      const isCurrent = q === currentQuarter;
      return { q, monthly, quarterlyTotal, actual, mva, medneg, isCurrent };
    });
  };

  const consultantRows = buildQuarterRows('consultant');
  const nonConsultantRows = buildQuarterRows('non-consultant');
  // Yearly totals are derived per-table inside the renderer below.
  const quarterRows = consultantRows; // keep legacy var name for footer math


  const getProgressColor = (pct: number) => {
    if (pct >= 100) return 'bg-green-500';
    if (pct >= 75) return 'bg-blue-500';
    if (pct >= 50) return 'bg-amber-500';
    return 'bg-destructive';
  };

  const getProgressTextColor = (pct: number) => {
    if (pct >= 100) return 'text-green-600';
    if (pct >= 75) return 'text-blue-600';
    if (pct >= 50) return 'text-amber-600';
    return 'text-destructive';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Target vs Actual
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              <Calendar className="h-3 w-3 mr-1" />
              {currentYear}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              <Users className="h-3 w-3 mr-1" />
              {teamSize} consultants
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Monthly target × 3 months = Quarterly bookings · Actuals from scheduled assessments
        </p>
      </CardHeader>
      <CardContent>
        {loadingActuals ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading assessment data…</span>
          </div>
        ) : (
          <div className="space-y-6">
            {[
              { title: 'Sales Consultants (Combined)', rows: consultantRows, allowEdit: true },
              { title: 'Non-Sales Consultant (Direct)', rows: nonConsultantRows, allowEdit: false },
            ].map((group) => {
              const yearlyTarget = group.rows.reduce((s, r) => s + r.quarterlyTotal, 0);
              const yearlyActual = group.rows.reduce((s, r) => s + r.actual, 0);
              const yearlyMva = group.rows.reduce((s, r) => s + r.mva, 0);
              const yearlyMedneg = group.rows.reduce((s, r) => s + r.medneg, 0);
              return (
                <div key={group.title} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
                    <Badge variant="secondary" className="text-[10px]">
                      {group.title.startsWith('Sales') ? `${activeConsultants.length} consultants` : 'Direct / Unattributed'}
                    </Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-xs font-semibold w-[80px]">Quarter</TableHead>
                          <TableHead className="text-xs font-semibold text-center">Monthly Min</TableHead>
                          <TableHead className="text-xs font-semibold text-center">Quarterly Target</TableHead>
                          <TableHead className="text-xs font-semibold text-center">Actual</TableHead>
                          <TableHead className="text-xs font-semibold text-center">Variance</TableHead>
                          <TableHead className="text-xs font-semibold text-center w-[130px]">Progress</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.rows.map((row) => {
                          const variance = row.actual - row.quarterlyTotal;
                          const progress = row.quarterlyTotal > 0 ? Math.min(100, Math.round((row.actual / row.quarterlyTotal) * 100)) : 0;
                          const isEditing = group.allowEdit && editingQ === row.q;
                          return (
                            <TableRow key={row.q} className={row.isCurrent ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/30'}>
                              <TableCell className="py-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-bold text-foreground">{Q_LABELS[row.q - 1]}</span>
                                  {row.isCurrent && (<Badge variant="default" className="text-[9px] px-1.5 py-0">Now</Badge>)}
                                </div>
                                <span className="text-[10px] text-muted-foreground">{Q_MONTHS[row.q - 1]}</span>
                              </TableCell>
                              <TableCell className="text-center py-3">
                                {isEditing ? (
                                  <div className="flex items-center gap-1 justify-center">
                                    <Input type="number" min={0} value={editValue} onChange={e => setEditValue(e.target.value)} className="h-7 w-16 text-xs text-center" autoFocus
                                      onKeyDown={e => { if (e.key === 'Enter') saveQuarterTarget(row.q); if (e.key === 'Escape') cancelEdit(); }} />
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveQuarterTarget(row.q)}><Check className="h-3.5 w-3.5 text-green-600" /></Button>
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEdit}><X className="h-3.5 w-3.5 text-destructive" /></Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-1">
                                    <span className="text-sm font-bold text-foreground">{row.monthly || '—'}</span>
                                    {isAdmin && group.allowEdit && (
                                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(row.q)}><Pencil className="h-3 w-3 text-muted-foreground" /></Button>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-center py-3">
                                {row.monthly > 0 ? (<span className="text-sm font-bold text-foreground">{row.quarterlyTotal}</span>) : (<span className="text-xs text-muted-foreground">—</span>)}
                              </TableCell>
                              <TableCell className="text-center py-3">
                                <span className="text-sm font-bold text-foreground">{row.actual}</span>
                                {(row.mva > 0 || row.medneg > 0) && (
                                  <div className="flex items-center justify-center gap-1 mt-0.5">
                                    <span className="text-[9px] text-blue-600 dark:text-blue-400">MVA:{row.mva}</span>
                                    <span className="text-[9px] text-teal-600 dark:text-teal-400">MN:{row.medneg}</span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-center py-3">
                                {row.quarterlyTotal > 0 ? (
                                  <div className="flex items-center justify-center gap-1">
                                    {variance > 0 ? <TrendingUp className="h-3.5 w-3.5 text-green-600" /> : variance < 0 ? <TrendingDown className="h-3.5 w-3.5 text-destructive" /> : <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                                    <span className={`text-xs font-semibold ${variance >= 0 ? 'text-green-600' : 'text-destructive'}`}>{variance >= 0 ? '+' : ''}{variance}</span>
                                  </div>
                                ) : (<span className="text-xs text-muted-foreground">—</span>)}
                              </TableCell>
                              <TableCell className="text-center py-3 min-w-[130px]">
                                {row.quarterlyTotal > 0 ? (
                                  <div className="space-y-1">
                                    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                                      <div className={`h-full rounded-full transition-all duration-500 ${getProgressColor(progress)}`} style={{ width: `${Math.min(100, progress)}%` }} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] text-muted-foreground">{row.actual}/{row.quarterlyTotal}</span>
                                      <span className={`text-[10px] font-bold ${getProgressTextColor(progress)}`}>{progress}%</span>
                                    </div>
                                  </div>
                                ) : (<span className="text-[10px] text-muted-foreground">No target</span>)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                      <TableFooter>
                        <TableRow className="bg-muted/70 font-semibold">
                          <TableCell className="py-3"><span className="text-sm font-bold text-foreground">Yearly</span></TableCell>
                          <TableCell className="text-center py-3"><span className="text-xs text-muted-foreground">—</span></TableCell>
                          <TableCell className="text-center py-3">
                            <span className="text-sm font-bold text-foreground">{yearlyTarget > 0 ? yearlyTarget : '—'}</span>
                            {yearlyTarget > 0 && (<div className="text-[10px] text-muted-foreground">bookings</div>)}
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <span className="text-sm font-bold text-foreground">{yearlyActual}</span>
                            {(yearlyMva > 0 || yearlyMedneg > 0) && (
                              <div className="flex items-center justify-center gap-1 mt-0.5">
                                <span className="text-[9px] text-blue-600 dark:text-blue-400">MVA:{yearlyMva}</span>
                                <span className="text-[9px] text-teal-600 dark:text-teal-400">MN:{yearlyMedneg}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center py-3">
                            {yearlyTarget > 0 ? (
                              <div className="flex items-center justify-center gap-1">
                                {(yearlyActual - yearlyTarget) >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-green-600" /> : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
                                <span className={`text-xs font-semibold ${(yearlyActual - yearlyTarget) >= 0 ? 'text-green-600' : 'text-destructive'}`}>{(yearlyActual - yearlyTarget) >= 0 ? '+' : ''}{yearlyActual - yearlyTarget}</span>
                              </div>
                            ) : (<span className="text-xs text-muted-foreground">—</span>)}
                          </TableCell>
                          <TableCell className="text-center py-3 min-w-[130px]">
                            {yearlyTarget > 0 ? (() => {
                              const yPct = Math.min(100, Math.round((yearlyActual / yearlyTarget) * 100));
                              return (
                                <div className="space-y-1">
                                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-500 ${getProgressColor(yPct)}`} style={{ width: `${yPct}%` }} />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-muted-foreground">{yearlyActual}/{yearlyTarget}</span>
                                    <span className={`text-[10px] font-bold ${getProgressTextColor(yPct)}`}>{yPct}%</span>
                                  </div>
                                </div>
                              );
                            })() : (<span className="text-[10px] text-muted-foreground">Set targets above</span>)}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TeamTargetsCard;
