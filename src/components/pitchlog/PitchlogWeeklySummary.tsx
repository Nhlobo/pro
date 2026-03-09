import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CalendarDays, Save, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { format, parse, startOfQuarter, endOfQuarter, startOfYear, endOfYear, addMonths } from 'date-fns';

interface Props {
  filterMonthStr: string;
  monthLabel: string;
  salesPersonsList: string[];
  selectedConsultant: string;
  currentUserName?: string;
  isSalesConsultant?: boolean;
}

interface WeeklySummary {
  id?: string;
  sales_person: string;
  month_year: string;
  week_number: number;
  summary_comment: string | null;
  weekly_strategy: string | null;
}

const WEEKS = [1, 2, 3, 4] as const;
const WEEK_LABELS = ['WK 1', 'WK 2', 'WK 3', 'WK 4'];

const PitchlogWeeklySummary: React.FC<Props> = ({ filterMonthStr, monthLabel, salesPersonsList, selectedConsultant, currentUserName, isSalesConsultant }) => {
  const queryClient = useQueryClient();
  const [consolidation, setConsolidation] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [editingCells, setEditingCells] = useState<Record<string, { comment: string; strategy: string }>>({});
  const [isOpen, setIsOpen] = useState(false);

  // Determine months to fetch based on consolidation
  const monthsToFetch = useMemo(() => {
    if (consolidation === 'monthly') return [filterMonthStr];

    // Parse filterMonthStr (format: "YYYY-MM")
    const [year, month] = filterMonthStr.split('-').map(Number);
    const refDate = new Date(year, month - 1, 1);

    if (consolidation === 'quarterly') {
      const qStart = startOfQuarter(refDate);
      return [0, 1, 2].map(i => format(addMonths(qStart, i), 'yyyy-MM'));
    }

    // yearly
    const yStart = startOfYear(refDate);
    return Array.from({ length: 12 }, (_, i) => format(addMonths(yStart, i), 'yyyy-MM'));
  }, [filterMonthStr, consolidation]);

  const { data: summaries = [], isLoading } = useQuery({
    queryKey: ['pitchlog-weekly-summaries', monthsToFetch, isSalesConsultant, currentUserName],
    queryFn: async () => {
      let query = supabase
        .from('pitchlog_weekly_summaries')
        .select('*')
        .in('month_year', monthsToFetch)
        .order('month_year')
        .order('week_number');
      
      // Sales consultants only fetch their own summaries
      if (isSalesConsultant && currentUserName) {
        query = query.eq('sales_person', currentUserName);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as WeeklySummary[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (summary: Omit<WeeklySummary, 'id'>) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('pitchlog_weekly_summaries')
        .upsert({
          ...summary,
          created_by: userData.user?.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'sales_person,month_year,week_number' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pitchlog-weekly-summaries'] });
      toast.success('Weekly summary saved');
    },
    onError: () => toast.error('Failed to save summary'),
  });

  const getCellKey = (sp: string, monthYear: string, wk: number) => `${sp}__${monthYear}__${wk}`;

  const getExisting = (sp: string, monthYear: string, wk: number) =>
    summaries.find(s => s.sales_person === sp && s.month_year === monthYear && s.week_number === wk);

  const startEditing = (sp: string, monthYear: string, wk: number) => {
    const key = getCellKey(sp, monthYear, wk);
    const existing = getExisting(sp, monthYear, wk);
    setEditingCells(prev => ({
      ...prev,
      [key]: { comment: existing?.summary_comment || '', strategy: existing?.weekly_strategy || '' },
    }));
  };

  const saveCell = (sp: string, monthYear: string, wk: number) => {
    const key = getCellKey(sp, monthYear, wk);
    const edit = editingCells[key];
    if (!edit) return;
    upsertMutation.mutate({
      sales_person: sp,
      month_year: monthYear,
      week_number: wk,
      summary_comment: edit.comment || null,
      weekly_strategy: edit.strategy || null,
    });
    setEditingCells(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Sales consultants can only see their own data
  const filteredPersons = useMemo(() => {
    if (isSalesConsultant && currentUserName) {
      return [currentUserName];
    }
    return selectedConsultant === 'all' ? salesPersonsList : [selectedConsultant];
  }, [isSalesConsultant, currentUserName, selectedConsultant, salesPersonsList]);

  const consolidationLabel = consolidation === 'monthly' ? monthLabel
    : consolidation === 'quarterly' ? `Q${Math.ceil(parseInt(filterMonthStr.split('-')[1]) / 3)} ${filterMonthStr.split('-')[0]}`
    : `Year ${filterMonthStr.split('-')[0]}`;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-border/50 shadow-soft">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    Weekly Summary & Strategy
                  </CardTitle>
                  <CardDescription>Manual comments per week — {consolidationLabel}</CardDescription>
                </div>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <Tabs value={consolidation} onValueChange={(v) => setConsolidation(v as any)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="monthly" className="text-xs px-3">Monthly</TabsTrigger>
                    <TabsTrigger value="quarterly" className="text-xs px-3">Quarterly</TabsTrigger>
                    <TabsTrigger value="yearly" className="text-xs px-3">Yearly</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {monthsToFetch.map(monthYear => {
              const [y, m] = monthYear.split('-').map(Number);
              const monthName = format(new Date(y, m - 1, 1), 'MMMM yyyy');

              return (
                <div key={monthYear} className="space-y-2">
                  {consolidation !== 'monthly' && (
                    <h4 className="text-sm font-semibold text-foreground/80 border-b border-border/40 pb-1">{monthName}</h4>
                  )}
                  <div className="overflow-x-auto rounded-md border border-border/50">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-[140px]">Sales Person</TableHead>
                          {WEEKS.map((wk, i) => (
                            <TableHead key={wk} className="text-center min-w-[200px]">
                              <Badge variant="outline" className="font-semibold">{WEEK_LABELS[i]}</Badge>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPersons.map(sp => (
                          <React.Fragment key={sp}>
                            {/* Summary row */}
                            <TableRow>
                              <TableCell className="font-medium align-top" rowSpan={2}>
                                <div className="flex flex-col gap-1">
                                  <span className="text-sm">{sp}</span>
                                  <Badge variant="secondary" className="text-[10px] w-fit">Summary</Badge>
                                </div>
                              </TableCell>
                              {WEEKS.map(wk => {
                                const key = getCellKey(sp, monthYear, wk);
                                const existing = getExisting(sp, monthYear, wk);
                                const isEditing = key in editingCells;

                                return (
                                  <TableCell key={wk} className="align-top p-2">
                                    {isEditing ? (
                                      <div className="space-y-1">
                                        <Textarea
                                          value={editingCells[key].comment}
                                          onChange={e => setEditingCells(prev => ({
                                            ...prev,
                                            [key]: { ...prev[key], comment: e.target.value },
                                          }))}
                                          placeholder="Weekly comment..."
                                          className="min-h-[60px] text-xs resize-none"
                                        />
                                        <Button size="sm" variant="default" className="h-6 text-[10px] w-full" onClick={() => saveCell(sp, monthYear, wk)}>
                                          <Save className="h-3 w-3 mr-1" />Save
                                        </Button>
                                      </div>
                                    ) : (
                                      <div
                                        className="min-h-[40px] cursor-pointer hover:bg-muted/50 rounded p-1 text-xs text-muted-foreground"
                                        onClick={() => startEditing(sp, monthYear, wk)}
                                      >
                                        {existing?.summary_comment || <span className="italic">Click to add comment...</span>}
                                      </div>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                            {/* Strategy row */}
                            <TableRow className="bg-muted/10">
                              {WEEKS.map(wk => {
                                const key = getCellKey(sp, monthYear, wk);
                                const existing = getExisting(sp, monthYear, wk);
                                const isEditing = key in editingCells;

                                return (
                                  <TableCell key={`strategy-${wk}`} className="align-top p-2 border-t-0">
                                    {isEditing ? (
                                      <Textarea
                                        value={editingCells[key].strategy}
                                        onChange={e => setEditingCells(prev => ({
                                          ...prev,
                                          [key]: { ...prev[key], strategy: e.target.value },
                                        }))}
                                        placeholder="Weekly strategy..."
                                        className="min-h-[50px] text-xs resize-none border-dashed"
                                      />
                                    ) : (
                                      <div
                                        className="min-h-[30px] cursor-pointer hover:bg-muted/30 rounded p-1 text-xs"
                                        onClick={() => startEditing(sp, monthYear, wk)}
                                      >
                                        {existing?.weekly_strategy ? (
                                          <span className="flex items-start gap-1">
                                            <FileText className="h-3 w-3 mt-0.5 text-primary/60 shrink-0" />
                                            {existing.weekly_strategy}
                                          </span>
                                        ) : (
                                          <span className="italic text-muted-foreground/60">Click to add strategy...</span>
                                        )}
                                      </div>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          </React.Fragment>
                        ))}
                        {filteredPersons.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No sales consultants found.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default PitchlogWeeklySummary;
