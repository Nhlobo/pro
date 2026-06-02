import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Mail, Plus, Download, Trash2, RefreshCw, Merge } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

interface MarketingEmail {
  id: string;
  attorney_name: string;
  email: string;
  source: string;
  collected_at: string;
  updated_at: string;
}

interface PitchlogMarketingEmailsProps {
  periodStart?: Date;
  periodEnd?: Date;
  periodLabel?: string;
}

const PitchlogMarketingEmails: React.FC<PitchlogMarketingEmailsProps> = ({ periodStart, periodEnd, periodLabel }) => {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [period, setPeriod] = useState<'all' | 'monthly' | 'quarterly' | 'yearly'>('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3).toString());
  const [search, setSearch] = useState('');

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ['attorney-marketing-emails'],
    queryFn: async () => {
      // Fetch stored marketing emails
      const { data: storedEmails, error } = await supabase
        .from('attorney_marketing_emails')
        .select('*')
        .order('attorney_name', { ascending: true });
      if (error) throw error;

      // Auto-fetch from pitchlog
      const { data: pitchlogData } = await supabase
        .from('attorney_pitchlog')
        .select('law_firm_name, email, month_year')
        .not('email', 'is', null);

      const storedList = (storedEmails || []) as MarketingEmail[];
      const existingEmails = new Set(storedList.map(e => e.email.toLowerCase()));

      // Build pitchlog entries not already in the stored list
      const pitchlogEntries: MarketingEmail[] = [];
      const seenPitchlog = new Set<string>();
      pitchlogData?.forEach((p: any) => {
        if (p.email && p.law_firm_name) {
          const em = p.email.trim().toLowerCase();
          if (em && em.includes('@') && !existingEmails.has(em) && !seenPitchlog.has(em)) {
            seenPitchlog.add(em);
            pitchlogEntries.push({
              id: `pitchlog-${em}`,
              attorney_name: p.law_firm_name.trim(),
              email: em,
              source: `pitchlog-${p.month_year || 'unknown'}`,
              collected_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }
      });

      return [...storedList, ...pitchlogEntries].sort((a, b) =>
        a.attorney_name.localeCompare(b.attorney_name)
      );
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({ attorney_name, email }: { attorney_name: string; email: string }) => {
      const { error } = await supabase.from('attorney_marketing_emails').insert({
        attorney_name: attorney_name.trim(),
        email: email.trim().toLowerCase(),
        source: 'manual',
        created_by: user?.id,
      });
      if (error) {
        if (error.message.includes('duplicate') || error.code === '23505') {
          throw new Error('This email address already exists in the marketing list.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attorney-marketing-emails'] });
      toast({ title: 'Email Added', description: 'Attorney email added to marketing list.' });
      setAddOpen(false);
      setName('');
      setEmail('');
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('attorney_marketing_emails').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attorney-marketing-emails'] });
      toast({ title: 'Removed', description: 'Email removed from marketing list.' });
    },
  });

  // Merge from pitchlog (monthly data) + referring attorneys
  const mergeMutation = useMutation({
    mutationFn: async () => {
      // Get emails from pitchlog with month_year for period tracking
      const { data: pitchlogData } = await supabase
        .from('attorney_pitchlog')
        .select('law_firm_name, email, contact_person, month_year, province, pitch_status')
        .not('email', 'is', null);

      // Get emails from referring attorneys
      const { data: attorneyData } = await supabase
        .rpc('get_referring_attorneys_list');

      const emailMap = new Map<string, { name: string; source: string }>();

      // Collect from monthly pitchlog entries
      pitchlogData?.forEach((p: any) => {
        if (p.email && p.law_firm_name) {
          const em = p.email.trim().toLowerCase();
          if (em && em.includes('@')) {
            emailMap.set(em, {
              name: p.law_firm_name.trim(),
              source: `pitchlog-${p.month_year || 'unknown'}`,
            });
          }
        }
      });

      // Collect from referring attorneys, excluding those with existing assessments
      attorneyData?.forEach((a: any) => {
        // Skip attorneys that already have appointments (assessments)
        if (a.appointment_count && a.appointment_count > 0) return;

        const rawEmail = a.email_masked || '';
        if (rawEmail && rawEmail.includes('@') && !rawEmail.includes('***')) {
          emailMap.set(rawEmail.trim().toLowerCase(), {
            name: (a.name || '').trim(),
            source: 'referring-attorney',
          });
        }
      });

      // Insert each unique email, ignoring duplicates
      let added = 0;
      for (const [em, info] of emailMap) {
        const { error } = await supabase.from('attorney_marketing_emails').insert({
          attorney_name: info.name,
          email: em,
          source: info.source,
          created_by: user?.id,
        });
        if (!error) added++;
      }
      return added;
    },
    onSuccess: (added) => {
      queryClient.invalidateQueries({ queryKey: ['attorney-marketing-emails'] });
      toast({ title: 'Merge Complete', description: `${added} new email(s) added from monthly pitchlog and referring attorneys.` });
    },
    onError: (err: any) => {
      toast({ title: 'Merge Error', description: err.message, variant: 'destructive' });
    },
  });

  const filteredEmails = useMemo(() => {
    let result = emails;

    // If global period filter is provided, use it
    if (periodStart && periodEnd) {
      result = result.filter(e => {
        const d = new Date(e.collected_at);
        return d >= periodStart && d <= periodEnd;
      });
    } else if (period !== 'all') {
      // Fallback to internal period filter
      const year = parseInt(selectedYear);
      let start: Date, end: Date;

      if (period === 'monthly') {
        const month = parseInt(selectedMonth) - 1;
        const ref = new Date(year, month, 1);
        start = startOfMonth(ref);
        end = endOfMonth(ref);
      } else if (period === 'quarterly') {
        const q = parseInt(selectedQuarter);
        const ref = new Date(year, (q - 1) * 3, 1);
        start = startOfQuarter(ref);
        end = endOfQuarter(ref);
      } else {
        const ref = new Date(year, 0, 1);
        start = startOfYear(ref);
        end = endOfYear(ref);
      }

      result = result.filter(e => {
        const d = new Date(e.collected_at);
        return d >= start && d <= end;
      });
    }

    // Search filter
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(e =>
        e.attorney_name.toLowerCase().includes(s) || e.email.toLowerCase().includes(s)
      );
    }

    return result;
  }, [emails, period, selectedYear, selectedMonth, selectedQuarter, search, periodStart, periodEnd]);

  const exportCSV = () => {
    const plainEmails = filteredEmails.map(e => e.email).join('\n');
    const blob = new Blob([plainEmails], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attorney-marketing-emails-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const years = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - i).toString());
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString(),
    label: format(new Date(2024, i, 1), 'MMMM'),
  }));

  return (
    <Card className="border-border/50 shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-kutlwano-blue" />
              Attorney Marketing Emails
            </CardTitle>
            <CardDescription>
              {filteredEmails.length} unique email(s) collected for marketing purposes
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => mergeMutation.mutate()} disabled={mergeMutation.isPending}>
              <RefreshCw className={`h-4 w-4 mr-1 ${mergeMutation.isPending ? 'animate-spin' : ''}`} />
              Merge Data
            </Button>
            <Button size="sm" variant="outline" onClick={exportCSV} disabled={filteredEmails.length === 0}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Email</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Attorney Email</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Referring Attorney Name *</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Smith & Associates" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email Address *</Label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@firm.co.za" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                    <Button
                      onClick={() => addMutation.mutate({ attorney_name: name, email })}
                      disabled={!name.trim() || !email.trim() || !email.includes('@') || addMutation.isPending}
                    >
                      {addMutation.isPending ? 'Adding...' : 'Add Email'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {periodLabel && (
            <Badge variant="secondary" className="text-xs font-medium">{periodLabel}</Badge>
          )}
          {!periodStart && (
            <>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium whitespace-nowrap">Period:</Label>
                <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {period !== 'all' && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Year:</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              {period === 'monthly' && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Month:</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              {period === 'quarterly' && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Quarter:</Label>
                  <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                    <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Q1</SelectItem>
                      <SelectItem value="2">Q2</SelectItem>
                      <SelectItem value="3">Q3</SelectItem>
                      <SelectItem value="4">Q4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Input
              placeholder="Search name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-[220px] h-9"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead>Referring Attorney Name</TableHead>
                <TableHead>Email Address</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Collected Date</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : filteredEmails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No marketing emails found. Add manually or use "Merge Data" to pull from pitchlog and referring attorneys.
                  </TableCell>
                </TableRow>
              ) : filteredEmails.map((entry, idx) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-sm text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="text-sm font-medium">{entry.attorney_name}</TableCell>
                  <TableCell className="text-sm">
                    <a href={`mailto:${entry.email}`} className="text-primary hover:underline">{entry.email}</a>
                  </TableCell>
                  <TableCell>
                    <Badge variant={entry.source === 'manual' ? 'outline' : 'secondary'} className="text-xs">
                      {entry.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(entry.collected_at), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell>
                    {isAdmin() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(entry.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t border-border/50">
          <span>Total: <strong className="text-foreground">{filteredEmails.length}</strong> emails</span>
          <span>Manual: <strong className="text-foreground">{filteredEmails.filter(e => e.source === 'manual').length}</strong></span>
          <span>Pitchlog: <strong className="text-foreground">{filteredEmails.filter(e => e.source?.startsWith('pitchlog')).length}</strong></span>
        </div>
      </CardContent>
    </Card>
  );
};

export default PitchlogMarketingEmails;
