import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Eye, EyeOff, Send, RefreshCw, FileText, Calendar, Award, TrendingUp, TrendingDown, Mail, Shuffle, Pencil, RotateCcw, Save } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { getSampleDrafts, getDraftDefaults, type DraftOverrides, type DraftVariant, type SalesPerfCopyOverrides } from '@/lib/salesPerformanceEmailTemplate';

type Report = {
  id: string;
  consultant_id: string | null;
  consultant_name: string;
  email: string | null;
  period_type: 'weekly' | 'monthly';
  period_start: string;
  period_end: string;
  deals_closed: number;
  target: number;
  target_met: boolean;
  strike_risk_level: 'none' | 'low' | 'medium' | 'high';
  current_strikes: number;
  auto_comment: string | null;
  congratulations: string | null;
  report_html: string | null;
  delivery_status: string;
  sent_at: string | null;
  created_at: string;
};

const riskBadge = (risk: string) => {
  const map: Record<string, string> = {
    none: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    low: 'bg-amber-100 text-amber-700 border-amber-200',
    medium: 'bg-orange-100 text-orange-700 border-orange-200',
    high: 'bg-red-100 text-red-700 border-red-200',
  };
  return map[risk] || map.none;
};

const SalesPerformanceReports: React.FC = () => {
  const qc = useQueryClient();
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [consultantFilter, setConsultantFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [previewReport, setPreviewReport] = useState<Report | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [draftPeriod, setDraftPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [draftsVisible, setDraftsVisible] = useState(false);
  const [draftNonce, setDraftNonce] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorVariant, setEditorVariant] = useState<DraftVariant>('underPerformer');

  const STORAGE_KEY = 'salesPerfDraftOverrides';
  const [allOverrides, setAllOverrides] = useState<Record<'weekly' | 'monthly', DraftOverrides>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { weekly: {}, monthly: {} };
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(allOverrides)); } catch {}
  }, [allOverrides]);

  const drafts = useMemo(
    () => getSampleDrafts(draftPeriod, allOverrides[draftPeriod]),
    [draftPeriod, draftNonce, allOverrides]
  );

  const defaultsForEditor = useMemo(() => getDraftDefaults(draftPeriod), [draftPeriod]);
  const currentEditorValues: SalesPerfCopyOverrides = {
    ...defaultsForEditor[editorVariant],
    ...(allOverrides[draftPeriod]?.[editorVariant] || {}),
  };

  const updateField = (field: keyof SalesPerfCopyOverrides, value: string) => {
    setAllOverrides(prev => ({
      ...prev,
      [draftPeriod]: {
        ...prev[draftPeriod],
        [editorVariant]: {
          ...defaultsForEditor[editorVariant],
          ...(prev[draftPeriod]?.[editorVariant] || {}),
          [field]: value,
        },
      },
    }));
  };

  const resetVariant = () => {
    setAllOverrides(prev => {
      const next = { ...prev, [draftPeriod]: { ...prev[draftPeriod] } };
      delete next[draftPeriod][editorVariant];
      return next;
    });
    toast.success(`${editorVariant === 'performer' ? 'Performer' : 'Under-performer'} draft reset to default`);
  };

  const { data: reports = [], isLoading, refetch } = useQuery({
    queryKey: ['sales-performance-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_performance_reports' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as Report[];
    },
  });

  const { data: consultants = [] } = useQuery({
    queryKey: ['sales-consultants-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_consultants')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    return reports.filter(r => {
      if (periodFilter !== 'all' && r.period_type !== periodFilter) return false;
      if (consultantFilter !== 'all' && r.consultant_id !== consultantFilter) return false;
      if (search && !r.consultant_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [reports, periodFilter, consultantFilter, search]);

  const runReport = async (period_type: 'weekly' | 'monthly', consultant_id?: string, preview = false) => {
    const key = `${period_type}-${consultant_id || 'all'}-${preview ? 'preview' : 'send'}`;
    setGenerating(key);
    try {
      const { data, error } = await supabase.functions.invoke('send-sales-performance-report', {
        body: { period_type, consultant_id, preview },
      });
      if (error) throw error;
      if (preview && data?.results?.[0]?.html) {
        setPreviewReport({
          ...(data.results[0]),
          id: 'preview',
          period_type,
          period_start: data.period.start,
          period_end: data.period.end,
          consultant_name: data.results[0].consultant_name,
          report_html: data.results[0].html,
          deals_closed: data.results[0].deals,
          target: data.results[0].target,
          target_met: data.results[0].targetMet,
          strike_risk_level: data.results[0].risk,
          current_strikes: data.results[0].strikes,
          delivery_status: 'preview',
          sent_at: null,
          created_at: new Date().toISOString(),
          email: data.results[0].email,
          consultant_id: data.results[0].consultant_id,
          auto_comment: data.results[0].comment,
          congratulations: data.results[0].congrats,
        } as Report);
      } else {
        toast.success(`Generated ${data?.count ?? 0} ${period_type} report(s)`);
        qc.invalidateQueries({ queryKey: ['sales-performance-reports'] });
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate report');
    } finally {
      setGenerating(null);
    }
  };

  const sendSampleToMe = async (period_type: 'weekly' | 'monthly') => {
    setGenerating(`sample-${period_type}`);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const adminEmail = auth.user?.email;
      if (!adminEmail) throw new Error('No admin email on session');
      const consultant_id = consultantFilter !== 'all'
        ? consultantFilter
        : consultants[0]?.id;
      if (!consultant_id) throw new Error('No active consultant available to build sample from');
      const { data, error } = await supabase.functions.invoke('send-sales-performance-report', {
        body: { period_type, consultant_id, sample_to: adminEmail },
      });
      if (error) throw error;
      const status = data?.results?.[0]?.deliveryStatus;
      if (status === 'sample_sent') toast.success(`Sample ${period_type} report sent to ${adminEmail}`);
      else toast.error(`Sample send failed: ${status || 'unknown'}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to send sample');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="brand-legal-theme space-y-4 md:space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 flex-wrap"><Mail className="h-5 w-5 text-primary shrink-0" /> Email Draft Templates</CardTitle>
              <CardDescription>
                Preview the exact email layouts sent to sales consultants. Use these drafts to refine wording, tone, and structure before the next scheduled send.
                Weekly reports go out every <strong>Monday 09:00 SAST</strong>; monthly reports go out on the <strong>last day of the month at 18:00 SAST</strong>.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 -mx-1 px-1 overflow-x-auto lg:overflow-visible">
              <Tabs value={draftPeriod} onValueChange={(v) => setDraftPeriod(v as 'weekly' | 'monthly')}>
                <TabsList>
                  <TabsTrigger value="weekly">Weekly draft</TabsTrigger>
                  <TabsTrigger value="monthly">Monthly draft</TabsTrigger>
                </TabsList>
              </Tabs>
              {draftsVisible && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setDraftNonce(n => n + 1)} title="Re-roll coaching wording">
                    <Shuffle className="h-4 w-4 mr-1" /> Shuffle wording
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditorVariant('underPerformer'); setEditorOpen(true); }}>
                    <Pencil className="h-4 w-4 mr-1" /> Edit drafts
                  </Button>
                </>
              )}
              <Button variant={draftsVisible ? 'outline' : 'default'} size="sm" onClick={() => setDraftsVisible(v => !v)}>
                {draftsVisible ? <><EyeOff className="h-4 w-4 mr-1" /> Hide drafts</> : <><Eye className="h-4 w-4 mr-1" /> Show drafts</>}
              </Button>
            </div>
          </div>
        </CardHeader>
        {draftsVisible && (
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border-b border-red-100">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">Draft 1 — Under-performing consultant</p>
                    <p className="text-xs text-red-600/80">Below target · strike warning · coaching tone</p>
                  </div>
                </div>
                <iframe
                  srcDoc={drafts.underPerformer}
                  className="w-full h-[560px] bg-white"
                  title="Under-performer draft preview"
                />
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border-b border-emerald-100">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">Draft 2 — Performing consultant</p>
                    <p className="text-xs text-emerald-600/80">Target met · congratulations · momentum tone</p>
                  </div>
                </div>
                <iframe
                  srcDoc={drafts.performer}
                  className="w-full h-[560px] bg-white"
                  title="Performer draft preview"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Coaching wording is generated dynamically per performance tier (exceptional / on-target / slight-miss / significant-miss / critical-miss) and varies across both consultant and non-consultant roles, so the system never sounds repetitive. Use <strong>Shuffle wording</strong> to preview alternative variants.
            </p>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" /> Sales Performance Reports</CardTitle>
          <CardDescription>
            Automated weekly (Monday 09:00 SAST) and monthly (last day of month) performance reports delivered directly to each consultant's email.
            Reports include deal progress, strike risk, target congratulations, and coaching expectations for the next period.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-muted-foreground">Search consultant</label>
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name…" />
            </div>
            <div className="min-w-[140px]">
              <label className="text-xs text-muted-foreground">Period</label>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px]">
              <label className="text-xs text-muted-foreground">Consultant</label>
              <Select value={consultantFilter} onValueChange={setConsultantFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All consultants</SelectItem>
                  {consultants.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 border rounded-lg p-3 bg-muted/30">
            <span className="text-sm font-medium mr-2 self-center">Generate now:</span>
            <Button size="sm" variant="outline" disabled={!!generating}
              onClick={() => runReport('weekly', consultantFilter !== 'all' ? consultantFilter : undefined, true)}>
              <Eye className="h-4 w-4 mr-1" /> Preview weekly
            </Button>
            <Button size="sm" variant="outline" disabled={!!generating}
              onClick={() => runReport('monthly', consultantFilter !== 'all' ? consultantFilter : undefined, true)}>
              <Eye className="h-4 w-4 mr-1" /> Preview monthly
            </Button>
            <Button size="sm" disabled={!!generating}
              onClick={() => runReport('weekly', consultantFilter !== 'all' ? consultantFilter : undefined, false)}>
              <Send className="h-4 w-4 mr-1" /> Send weekly {consultantFilter !== 'all' ? '(selected)' : '(all)'}
            </Button>
            <Button size="sm" disabled={!!generating}
              onClick={() => runReport('monthly', consultantFilter !== 'all' ? consultantFilter : undefined, false)}>
              <Send className="h-4 w-4 mr-1" /> Send monthly {consultantFilter !== 'all' ? '(selected)' : '(all)'}
            </Button>
            <Button size="sm" variant="secondary" disabled={!!generating}
              onClick={() => sendSampleToMe('weekly')}>
              <Send className="h-4 w-4 mr-1" /> Email me a sample (weekly)
            </Button>
            <Button size="sm" variant="secondary" disabled={!!generating}
              onClick={() => sendSampleToMe('monthly')}>
              <Send className="h-4 w-4 mr-1" /> Email me a sample (monthly)
            </Button>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultant</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Range</TableHead>
                  <TableHead className="text-right">Deals</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    No performance reports yet. Use the buttons above to generate one, or wait for the next scheduled run.
                  </TableCell></TableRow>
                ) : filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.consultant_name}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{r.period_type}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(r.period_start), 'dd MMM')} – {format(new Date(r.period_end), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{r.deals_closed}</TableCell>
                    <TableCell className="text-right">{r.target}</TableCell>
                    <TableCell>
                      {r.target_met
                        ? <Badge className="bg-emerald-600 text-white">Target met</Badge>
                        : <Badge variant="outline" className="text-amber-700 border-amber-300">Below</Badge>}
                    </TableCell>
                    <TableCell><Badge variant="outline" className={riskBadge(r.strike_risk_level)}>{r.strike_risk_level}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {r.delivery_status === 'sent' && r.sent_at
                        ? <span className="text-emerald-600">{format(new Date(r.sent_at), 'dd MMM HH:mm')}</span>
                        : <span className="text-muted-foreground capitalize">{r.delivery_status}</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setPreviewReport(r)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!previewReport} onOpenChange={(open) => !open && setPreviewReport(null)}>
        <DialogContent className="brand-legal-theme max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {previewReport?.consultant_name} — {previewReport?.period_type} report
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {previewReport?.report_html
              ? <iframe srcDoc={previewReport.report_html} className="w-full h-[70vh] border rounded" title="Report preview" />
              : <p className="text-sm text-muted-foreground p-4">No rendered HTML available.</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="brand-legal-theme max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Edit {draftPeriod} email drafts
            </DialogTitle>
          </DialogHeader>
          <Tabs value={editorVariant} onValueChange={(v) => setEditorVariant(v as DraftVariant)} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="self-start">
              <TabsTrigger value="underPerformer"><TrendingDown className="h-3.5 w-3.5 mr-1 text-red-600" />Under-performing</TabsTrigger>
              <TabsTrigger value="performer"><TrendingUp className="h-3.5 w-3.5 mr-1 text-emerald-600" />Performing</TabsTrigger>
            </TabsList>
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden mt-3">
              <div className="overflow-auto pr-2 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Edits save instantly to this browser and update the preview on the right. Use placeholders <code>{'{dateRange}'}</code>, <code>{'{firstName}'}</code>, <code>{'{periodType}'}</code> in the greeting line.
                  </p>
                  <Button variant="ghost" size="sm" onClick={resetVariant}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Reset
                  </Button>
                </div>
                {([
                  { key: 'headerTitle', label: 'Header title', rows: 1 },
                  { key: 'headerTagline', label: 'Header tagline', rows: 1 },
                  { key: 'greetingIntro', label: 'Greeting / intro line', rows: 2 },
                  { key: 'congrats', label: 'Congratulations banner (leave blank to hide)', rows: 2 },
                  { key: 'comment', label: "Manager's note (coaching expectations)", rows: 5 },
                  { key: 'managerNoteHeading', label: "Manager's note heading", rows: 1 },
                  { key: 'footerNote', label: 'Footer note', rows: 2 },
                ] as Array<{ key: keyof SalesPerfCopyOverrides; label: string; rows: number }>).map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs font-medium">{f.label}</Label>
                    <Textarea
                      rows={f.rows}
                      value={currentEditorValues[f.key] ?? ''}
                      onChange={(e) => updateField(f.key, e.target.value)}
                      className="text-sm"
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground flex items-center gap-1 pt-2">
                  <Save className="h-3 w-3" /> Saved automatically to this browser.
                </p>
              </div>
              <div className="overflow-hidden border rounded-lg bg-muted/30">
                <div className="px-3 py-2 bg-background border-b text-xs font-semibold flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5" /> Live preview — {editorVariant === 'performer' ? 'Performing consultant' : 'Under-performing consultant'} ({draftPeriod})
                </div>
                <iframe
                  srcDoc={editorVariant === 'performer' ? drafts.performer : drafts.underPerformer}
                  className="w-full h-[68vh] bg-white"
                  title="Live email preview"
                />
              </div>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesPerformanceReports;
