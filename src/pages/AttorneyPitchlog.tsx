import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Plus, ArrowLeft, CalendarDays, TrendingUp, CalendarIcon,
  Users, BarChart3, Target, AlertTriangle, Download, FileText, Star
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, isSameMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import CompanyFooter from '@/components/CompanyFooter';
import PitchlogInlineRow, { 
  PitchEntry, PROVINCES, ATTORNEY_TYPES, PRACTICE_AREAS, PITCH_STATUSES, COMMENT_OPTIONS 
} from '@/components/pitchlog/PitchlogInlineRow';
import PitchlogExcelUpload from '@/components/pitchlog/PitchlogExcelUpload';
import PitchlogAddRow from '@/components/pitchlog/PitchlogAddRow';
import { downloadPitchlogPdf } from '@/components/pitchlog/PitchlogPdfExport';
import PitchlogMarketingEmails from '@/components/pitchlog/PitchlogMarketingEmails';
import PitchlogSalesReport from '@/components/pitchlog/PitchlogSalesReport';

const getMonthOptions = () => {
  const options: string[] = [];
  const now = new Date();
  for (let i = -2; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push(format(d, 'yyyy-MM'));
  }
  return options;
};

const emptyForm = {
  month_year: format(new Date(), 'yyyy-MM'),
  province: '',
  law_firm_name: '',
  attorney_type: '',
  practice_area: '',
  contact_person: '',
  email: '',
  telephone: '',
  sales_person: '',
  pitch_status: 'Pitched',
  follow_up_date: '',
  comment: '',
  identified_challenge: '',
  comment_2: '',
};

const AttorneyPitchlog = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterDate, setFilterDate] = useState<Date>(new Date());
  const [filterSalesPerson, setFilterSalesPerson] = useState('all');

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['attorney-pitchlog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attorney_pitchlog')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PitchEntry[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: typeof form) => {
      const payload = {
        ...formData,
        follow_up_date: formData.follow_up_date || null,
        email: formData.email || null,
        telephone: formData.telephone || null,
        comment: formData.comment || null,
        comment_2: formData.comment_2 || null,
        identified_challenge: formData.identified_challenge || null,
        meeting_function: (formData as any).meeting_function || null,
        created_by: user?.id,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('attorney_pitchlog').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attorney-pitchlog'] });
      toast({ title: 'Pitch logged', description: 'Pitchlog saved successfully.' });
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Inline update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PitchEntry> }) => {
      const { error } = await supabase.from('attorney_pitchlog').update({
        ...data,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attorney-pitchlog'] });
      toast({ title: 'Updated', description: 'Entry updated successfully.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('attorney_pitchlog').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attorney-pitchlog'] });
      toast({ title: 'Deleted', description: 'Entry removed.' });
    },
  });

  // Bulk CSV upload mutation
  const bulkInsertMutation = useMutation({
    mutationFn: async (rows: Record<string, string>[]) => {
      const payload = rows.map(r => ({
        month_year: r.month_year || format(new Date(), 'yyyy-MM'),
        province: r.province,
        law_firm_name: r.law_firm_name,
        attorney_type: r.attorney_type,
        practice_area: r.practice_area,
        contact_person: r.contact_person,
        email: r.email || null,
        telephone: r.telephone || null,
        sales_person: r.sales_person,
        pitch_status: r.pitch_status || 'Pitched',
        follow_up_date: r.follow_up_date || null,
        comment: r.comment || null,
        comment_2: r.comment_2 || null,
        identified_challenge: r.identified_challenge || null,
        meeting_function: r.meeting_function || null,
        created_by: user?.id,
      }));
      const { error } = await supabase.from('attorney_pitchlog').insert(payload);
      if (error) throw error;
    },
    onSuccess: (_, rows) => {
      queryClient.invalidateQueries({ queryKey: ['attorney-pitchlog'] });
      toast({ title: 'Bulk Import Complete', description: `${rows.length} planned pitches added.` });
    },
    onError: (err: any) => {
      toast({ title: 'Import Error', description: err.message, variant: 'destructive' });
    },
  });

  const handleInlineSave = (id: string, data: Partial<PitchEntry>) => {
    updateMutation.mutate({ id, data });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.province || !form.law_firm_name || !form.attorney_type || !form.practice_area || !form.contact_person || !form.sales_person) {
      toast({ title: 'Missing fields', description: 'Please fill all required fields.', variant: 'destructive' });
      return;
    }
    saveMutation.mutate(form);
  };

  const filterMonthStr = format(filterDate, 'yyyy-MM');

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (e.month_year !== filterMonthStr) return false;
      if (filterSalesPerson !== 'all' && e.sales_person !== filterSalesPerson) return false;
      return true;
    });
  }, [entries, filterMonthStr, filterSalesPerson]);

  const potentialAttorneys = useMemo(() => {
    return entries.filter(e => 
      e.comment === 'Potential' || e.comment === 'Interested' || e.pitch_status === 'Interested'
    );
  }, [entries]);

  const salesPersons = useMemo(() => [...new Set(entries.map(e => e.sales_person))], [entries]);

  const challengeSummary = useMemo(() => {
    const monthEntries = entries.filter(e => e.month_year === filterMonthStr);
    const counts: Record<string, number> = {};
    monthEntries.forEach(e => {
      if (e.identified_challenge) {
        counts[e.identified_challenge] = (counts[e.identified_challenge] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [entries, filterMonthStr]);

  const weeklyStats = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recent = entries.filter(e => new Date(e.created_at) >= sevenDaysAgo);
    return {
      pitched: recent.filter(e => e.pitch_status === 'Pitched').length,
      followedUp: recent.filter(e => e.pitch_status === 'Followed Up').length,
      interested: recent.filter(e => e.pitch_status === 'Interested').length,
      rePitched: recent.filter(e => e.pitch_status === 'Re-pitched').length,
      dealsClosed: recent.filter(e => (e as any).deal_closed === true).length,
      provinces: [...new Set(recent.map(e => e.province))].length,
      raf: recent.filter(e => e.practice_area === 'RAF').length,
      medNeg: recent.filter(e => e.practice_area === 'Medical Negligence').length,
      total: recent.length,
    };
  }, [entries]);

  const monthlyStats = useMemo(() => {
    const monthEntries = entries.filter(e => e.month_year === filterMonthStr);
    const topProvince = (() => {
      const pc: Record<string, number> = {};
      monthEntries.forEach(e => { pc[e.province] = (pc[e.province] || 0) + 1; });
      const sorted = Object.entries(pc).sort((a, b) => b[1] - a[1]);
      return sorted[0]?.[0] || 'N/A';
    })();
    return {
      totalFirms: monthEntries.length,
      interested: monthEntries.filter(e => e.pitch_status === 'Interested').length,
      followedUp: monthEntries.filter(e => e.pitch_status === 'Followed Up').length,
      rePitched: monthEntries.filter(e => e.pitch_status === 'Re-pitched').length,
      dealsClosed: monthEntries.filter(e => (e as any).deal_closed === true).length,
      topProvince,
      topChallenge: challengeSummary[0]?.[0] || 'N/A',
    };
  }, [entries, filterMonthStr, challengeSummary]);

  const performanceData = useMemo(() => {
    const monthEntries = entries.filter(e => e.month_year === filterMonthStr);
    const grouped: Record<string, PitchEntry[]> = {};
    monthEntries.forEach(e => {
      if (!grouped[e.sales_person]) grouped[e.sales_person] = [];
      grouped[e.sales_person].push(e);
    });
    return Object.entries(grouped).map(([person, items]) => ({
      person,
      total: items.length,
      pitched: items.filter(i => i.pitch_status === 'Pitched').length,
      followedUp: items.filter(i => i.pitch_status === 'Followed Up').length,
      interested: items.filter(i => i.pitch_status === 'Interested').length,
      followUpsDue: items.filter(i => i.follow_up_date && new Date(i.follow_up_date) <= new Date()).length,
    }));
  }, [entries, filterMonthStr]);

  const exportCSV = (data: PitchEntry[], filename: string) => {
    const headers = ['Month', 'Province', 'Law Firm', 'Attorney Type', 'Practice Area', 'Contact', 'Email', 'Phone', 'Sales Person', 'Status', 'Follow-Up Date', 'Comment', 'Comment Sec 2', 'Challenge', 'Meeting Function'];
    const rows = data.map(e => [
      e.month_year, e.province, e.law_firm_name, e.attorney_type, e.practice_area,
      e.contact_person, e.email || '', e.telephone || '', e.sales_person, e.pitch_status,
      e.follow_up_date || '', e.comment || '', e.comment_2 || '', e.identified_challenge || '', e.meeting_function || ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'Pitched': return 'bg-kutlwano-blue/10 text-kutlwano-blue border-kutlwano-blue/30';
      case 'Re-pitched': return 'bg-purple-500/10 text-purple-600 border-purple-500/30';
      case 'Followed Up': return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      case 'Interested': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
      case 'Not Interested': return 'bg-destructive/10 text-destructive border-destructive/30';
      default: return '';
    }
  };

  const monthLabel = format(filterDate, 'MMMM yyyy');

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Attorney Pitchlog - Medico-Legal CRM</title>
        <meta name="description" content="Track and manage attorneys pitched for medico-legal assessments" />
      </Helmet>

      <header className="bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal shadow-elegant border-b border-kutlwano-blue/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" asChild className="text-white hover:bg-white/10">
                <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-2" />Dashboard</Link>
              </Button>
              <div className="h-6 w-px bg-white/30" />
              <h1 className="text-lg font-bold text-white">Medico-Legal Attorney Pitchlog</h1>
            </div>
            <div className="flex items-center gap-2">
              <PitchlogExcelUpload onUpload={(rows) => bulkInsertMutation.mutate(rows)} />
              <Button size="sm" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                onClick={() => downloadPitchlogPdf(filteredEntries, monthLabel)}>
                <FileText className="h-4 w-4 mr-2" />PDF
              </Button>
              <Button size="sm" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                onClick={() => exportCSV(filteredEntries, `pitchlog-${filterMonthStr}`)}>
                <Download className="h-4 w-4 mr-2" />CSV
              </Button>
              <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setForm(emptyForm); }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-white text-kutlwano-blue hover:bg-white/90 font-semibold">
                    <Plus className="h-4 w-4 mr-2" />Log Pitch
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Log New Attorney Pitch</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Date (auto-set to current) *</Label>
                        <Select value={form.month_year} onValueChange={v => setForm(f => ({ ...f, month_year: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{getMonthOptions().map(m => <SelectItem key={m} value={m}>{format(new Date(m + '-01'), 'MMMM yyyy')}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Province *</Label>
                        <Select value={form.province} onValueChange={v => setForm(f => ({ ...f, province: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select province" /></SelectTrigger>
                          <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Law Firm Name *</Label>
                        <Input value={form.law_firm_name} onChange={e => setForm(f => ({ ...f, law_firm_name: e.target.value }))} placeholder="e.g. Smith & Associates" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Attorney Type *</Label>
                        <Select value={form.attorney_type} onValueChange={v => setForm(f => ({ ...f, attorney_type: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent>{ATTORNEY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Practice Area *</Label>
                        <Select value={form.practice_area} onValueChange={v => setForm(f => ({ ...f, practice_area: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                          <SelectContent>{PRACTICE_AREAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Contact Person *</Label>
                        <Input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} placeholder="Name & Surname" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Email</Label>
                        <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@firm.co.za" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Telephone / Cell</Label>
                        <Input value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} placeholder="012 345 6789" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Sales Person *</Label>
                        <Input value={form.sales_person} onChange={e => setForm(f => ({ ...f, sales_person: e.target.value }))} placeholder="Staff member" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Pitch Status</Label>
                        <Select value={form.pitch_status} onValueChange={v => setForm(f => ({ ...f, pitch_status: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{PITCH_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Follow-Up Date</Label>
                        <Input type="date" value={form.follow_up_date} onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Comment</Label>
                        <Select value={form.identified_challenge} onValueChange={v => setForm(f => ({ ...f, identified_challenge: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select comment" /></SelectTrigger>
                          <SelectContent>{COMMENT_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Comment / Notes</Label>
                      <Textarea value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} placeholder="Notes from discussion..." rows={3} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Comment Sec 2</Label>
                      <Textarea value={form.comment_2} onChange={e => setForm(f => ({ ...f, comment_2: e.target.value }))} placeholder="Additional user comments..." rows={3} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={saveMutation.isPending}>
                        {saveMutation.isPending ? 'Saving...' : 'Log Pitch'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Date:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(filterDate, 'MMMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filterDate}
                  onSelect={(date) => date && setFilterDate(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Sales Person:</Label>
            <Select value={filterSalesPerson} onValueChange={setFilterSalesPerson}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {salesPersons.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="pitchlog" className="space-y-4">
          <TabsList className="bg-muted">
            <TabsTrigger value="pitchlog">Pitchlog</TabsTrigger>
            <TabsTrigger value="potential">Potential Attorneys</TabsTrigger>
            <TabsTrigger value="sales-report">Sales Report</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="challenges">Challenges</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="emails">Attorney Emails</TabsTrigger>
          </TabsList>

          {/* PITCHLOG TABLE with inline editing */}
          <TabsContent value="pitchlog">
            <Card className="border-border/50 shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-kutlwano-blue" />Monthly Pitchlog</CardTitle>
                <CardDescription>{filteredEntries.length} entries for {monthLabel} — click Edit icon on any row to edit inline</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Province</TableHead>
                        <TableHead>Law Firm</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Practice</TableHead>
                        <TableHead>Contact Person</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Telephone</TableHead>
                        <TableHead>Sales Person</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Follow-Up</TableHead>
                        <TableHead>Comment</TableHead>
                        <TableHead>Comment Sec 2</TableHead>
                        <TableHead>Meetings</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow><TableCell colSpan={15} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                      ) : filteredEntries.length === 0 ? (
                        <TableRow><TableCell colSpan={15} className="text-center py-8 text-muted-foreground">No pitch entries found. Use the row below to manually add an entry or upload an Excel file.</TableCell></TableRow>
                      ) : filteredEntries.map(entry => (
                        <PitchlogInlineRow
                          key={entry.id}
                          entry={entry}
                          onSave={handleInlineSave}
                          onDelete={(id) => deleteMutation.mutate(id)}
                          statusColor={statusColor}
                        />
                      ))}
                      <PitchlogAddRow
                        onAdd={(data) => {
                          saveMutation.mutate({
                            ...emptyForm,
                            ...data,
                          });
                        }}
                        isPending={saveMutation.isPending}
                      />
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* POTENTIAL ATTORNEYS TAB */}
          <TabsContent value="potential">
            <Card className="border-border/50 shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-amber-500" />Potential Attorneys</CardTitle>
                <CardDescription>{potentialAttorneys.length} attorneys marked as Potential or Interested</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Province</TableHead>
                        <TableHead>Law Firm</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Practice</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Sales Person</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Comment</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {potentialAttorneys.length === 0 ? (
                        <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No potential attorneys found. Mark entries as "Potential" or "Interested" in the Comment field.</TableCell></TableRow>
                      ) : potentialAttorneys.map(entry => (
                        <PitchlogInlineRow
                          key={entry.id}
                          entry={entry}
                          onSave={handleInlineSave}
                          onDelete={(id) => deleteMutation.mutate(id)}
                          statusColor={statusColor}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SALES REPORT TAB */}
          <TabsContent value="sales-report">
            <PitchlogSalesReport entries={entries} filterMonthStr={filterMonthStr} monthLabel={monthLabel} />
          </TabsContent>

          {/* REPORTS TAB */}
          <TabsContent value="reports">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-border/50 shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-kutlwano-teal" />Weekly Sales Report</CardTitle>
                  <CardDescription>Last 7 days activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableBody>
                      <TableRow><TableCell className="font-medium">Total Pitched</TableCell><TableCell className="text-right font-bold text-kutlwano-blue">{weeklyStats.total}</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">New Pitches</TableCell><TableCell className="text-right">{weeklyStats.pitched}</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Follow-Ups Done</TableCell><TableCell className="text-right">{weeklyStats.followedUp}</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Re-pitched</TableCell><TableCell className="text-right font-semibold text-purple-600">{weeklyStats.rePitched}</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Deals Closed</TableCell><TableCell className="text-right font-semibold text-emerald-600">{weeklyStats.dealsClosed}</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Interested Firms</TableCell><TableCell className="text-right font-semibold">{weeklyStats.interested}</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Province Coverage</TableCell><TableCell className="text-right">{weeklyStats.provinces} provinces</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">RAF Focus</TableCell><TableCell className="text-right">{weeklyStats.raf}</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Med Neg Focus</TableCell><TableCell className="text-right">{weeklyStats.medNeg}</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Conversion Rate</TableCell><TableCell className="text-right font-bold">{weeklyStats.total > 0 ? Math.round((weeklyStats.dealsClosed / weeklyStats.total) * 100) : 0}%</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-kutlwano-blue" />Monthly Sales Report</CardTitle>
                  <CardDescription>{monthLabel}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableBody>
                      <TableRow><TableCell className="font-medium">Total Firms Pitched</TableCell><TableCell className="text-right font-bold text-kutlwano-blue">{monthlyStats.totalFirms}</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Leads Generated (Interested)</TableCell><TableCell className="text-right font-semibold">{monthlyStats.interested}</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Follow-Ups Completed</TableCell><TableCell className="text-right">{monthlyStats.followedUp}</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Re-pitched</TableCell><TableCell className="text-right font-semibold text-purple-600">{monthlyStats.rePitched}</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Deals Closed</TableCell><TableCell className="text-right font-semibold text-emerald-600">{monthlyStats.dealsClosed}</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Conversion Rate</TableCell><TableCell className="text-right font-semibold">{monthlyStats.totalFirms > 0 ? Math.round((monthlyStats.dealsClosed / monthlyStats.totalFirms) * 100) : 0}%</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Top Province</TableCell><TableCell className="text-right">{monthlyStats.topProvince}</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Top Challenge</TableCell><TableCell className="text-right text-sm">{monthlyStats.topChallenge}</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* CHALLENGES TAB */}
          <TabsContent value="challenges">
            <Card className="border-border/50 shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />Common Attorney Challenges Summary</CardTitle>
                <CardDescription>Grouped problems raised by attorneys in {monthLabel}</CardDescription>
              </CardHeader>
              <CardContent>
                {challengeSummary.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No challenges recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {challengeSummary.map(([challenge, count]) => (
                      <div key={challenge} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                        <span className="font-medium text-sm">{challenge}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-kutlwano-blue rounded-full" style={{ width: `${Math.min((count / (filteredEntries.length || 1)) * 100, 100)}%` }} />
                          </div>
                          <Badge variant="secondary">{count} mention{count !== 1 ? 's' : ''}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PERFORMANCE TAB */}
          <TabsContent value="performance">
            <Card className="border-border/50 shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-kutlwano-teal" />Sales Person Performance</CardTitle>
                <CardDescription>Individual pitch activity for {monthLabel}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sales Person</TableHead>
                      <TableHead className="text-center">Total Pitches</TableHead>
                      <TableHead className="text-center">New</TableHead>
                      <TableHead className="text-center">Followed Up</TableHead>
                      <TableHead className="text-center">Interested</TableHead>
                      <TableHead className="text-center">Follow-Ups Due</TableHead>
                      <TableHead className="text-center">Conversion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performanceData.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No data available.</TableCell></TableRow>
                    ) : performanceData.map(p => (
                      <TableRow key={p.person}>
                        <TableCell className="font-medium">{p.person}</TableCell>
                        <TableCell className="text-center font-bold text-kutlwano-blue">{p.total}</TableCell>
                        <TableCell className="text-center">{p.pitched}</TableCell>
                        <TableCell className="text-center">{p.followedUp}</TableCell>
                        <TableCell className="text-center font-semibold">{p.interested}</TableCell>
                        <TableCell className="text-center">
                          {p.followUpsDue > 0 ? <Badge variant="destructive" className="text-xs">{p.followUpsDue} due</Badge> : <span className="text-muted-foreground">0</span>}
                        </TableCell>
                        <TableCell className="text-center font-semibold">{p.total > 0 ? Math.round((p.interested / p.total) * 100) : 0}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          {/* ATTORNEY EMAILS TAB */}
          <TabsContent value="emails">
            <PitchlogMarketingEmails />
          </TabsContent>
        </Tabs>
      </div>

      <CompanyFooter />
    </div>
  );
};

export default AttorneyPitchlog;
