import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
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
  Users, BarChart3, Target, AlertTriangle, Download, FileText, Star,
  ChevronLeft, ChevronRight, Search
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, isSameMonth, startOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, isWithinInterval, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from '@/utils/pdfBranding';
import CompanyFooter from '@/components/CompanyFooter';
import { usePitchlogFollowUpReminders } from '@/hooks/usePitchlogFollowUpReminders';
import { NotificationCenter } from '@/components/NotificationCenter';
import PitchlogInlineRow, { 
  PitchEntry, PROVINCES, ATTORNEY_TYPES, PRACTICE_AREAS, PITCH_STATUSES, COMMENT_OPTIONS 
} from '@/components/pitchlog/PitchlogInlineRow';
import PitchlogExcelUpload from '@/components/pitchlog/PitchlogExcelUpload';
import PitchlogAddRow from '@/components/pitchlog/PitchlogAddRow';
import { downloadPitchlogPdf } from '@/components/pitchlog/PitchlogPdfExport';
import PitchlogMarketingEmails from '@/components/pitchlog/PitchlogMarketingEmails';
import PitchlogSalesReport from '@/components/pitchlog/PitchlogSalesReport';
import PitchlogWeeklySummary from '@/components/pitchlog/PitchlogWeeklySummary';

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

type FilterPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

const AttorneyPitchlog = () => {
  const { user } = useAuth();
  const { isSalesConsultant, isAdmin } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterDate, setFilterDate] = useState<Date>(new Date());
  const [filterSalesPerson, setFilterSalesPerson] = useState('all');
  const [downloadConsultant, setDownloadConsultant] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('daily');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch the logged-in user's profile name to auto-fill sales_person
  const { data: currentUserName } = useQuery({
    queryKey: ['current-user-profile-name', user?.id],
    queryFn: async () => {
      if (!user?.id) return '';
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();
      if (data?.first_name) {
        return data.first_name;
      }
      return user.email?.split('@')[0] || '';
    },
    enabled: !!user?.id,
  });

  // Auto-fill the sales_person in the dialog form when profile loads (for all users)
  useEffect(() => {
    if (currentUserName) {
      setForm(f => ({ ...f, sales_person: currentUserName }));
    }
  }, [currentUserName]);

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

  // Sales consultants only see their own entries across all tabs/stats
  const userEntries = useMemo(() => {
    if (isSalesConsultant() && currentUserName) {
      return entries.filter(e => e.sales_person === currentUserName);
    }
    return entries;
  }, [entries, isSalesConsultant, currentUserName]);

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
      setForm({ ...emptyForm, sales_person: currentUserName || '' });
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

  // Get date range based on selected period
  const periodRange = useMemo(() => {
    const ref = filterDate;
    switch (filterPeriod) {
      case 'daily':
        const dayStart = startOfDay(ref);
        return { start: dayStart, end: new Date(dayStart.getTime() + 86400000 - 1), label: format(ref, 'dd MMMM yyyy') };
      case 'weekly':
        return { start: startOfWeek(ref, { weekStartsOn: 1 }), end: endOfWeek(ref, { weekStartsOn: 1 }), label: `Week of ${format(startOfWeek(ref, { weekStartsOn: 1 }), 'dd MMM')} — ${format(endOfWeek(ref, { weekStartsOn: 1 }), 'dd MMM yyyy')}` };
      case 'monthly':
        return { start: startOfMonth(ref), end: endOfMonth(ref), label: format(ref, 'MMMM yyyy') };
      case 'quarterly':
        return { start: startOfQuarter(ref), end: endOfQuarter(ref), label: `Q${Math.ceil((ref.getMonth() + 1) / 3)} ${format(ref, 'yyyy')}` };
    }
  }, [filterDate, filterPeriod]);

  const navigatePeriod = useCallback((direction: 'prev' | 'next') => {
    setFilterDate(current => {
      const fn = direction === 'prev' ? 
        (filterPeriod === 'daily' ? (d: Date) => subDays(d, 1) :
         filterPeriod === 'weekly' ? (d: Date) => subWeeks(d, 1) :
         filterPeriod === 'monthly' ? (d: Date) => subMonths(d, 1) :
         (d: Date) => subMonths(d, 3)) :
        (filterPeriod === 'daily' ? (d: Date) => addDays(d, 1) :
         filterPeriod === 'weekly' ? (d: Date) => addWeeks(d, 1) :
         filterPeriod === 'monthly' ? (d: Date) => addMonths(d, 1) :
         (d: Date) => addMonths(d, 3));
      return fn(current);
    });
  }, [filterPeriod]);

  const goToToday = useCallback(() => setFilterDate(new Date()), []);

  const isEntryInPeriod = useCallback((entry: PitchEntry) => {
    const entryDate = entry.created_at ? new Date(entry.created_at) : null;
    if (!entryDate) return false;
    return isWithinInterval(entryDate, { start: periodRange.start, end: periodRange.end });
  }, [periodRange]);

  // For sales consultants, only show their own entries
  const filteredEntries = useMemo(() => {
    return userEntries.filter(e => {
      if (!isEntryInPeriod(e)) return false;
      if (filterSalesPerson !== 'all' && e.sales_person !== filterSalesPerson) return false;
      return true;
    });
  }, [userEntries, isEntryInPeriod, filterSalesPerson]);

  const potentialAttorneys = useMemo(() => {
    return userEntries.filter(e => 
      (e.comment === 'Potential' || e.comment === 'Interested' || e.pitch_status === 'Interested') && isEntryInPeriod(e)
    );
  }, [userEntries, isEntryInPeriod]);

  const salesPersons = useMemo(() => [...new Set(userEntries.map(e => e.sales_person))], [userEntries]);

  const challengeSummary = useMemo(() => {
    const POSITIVE_RESPONSES = ['Interested', 'Potential'];
    const counts: Record<string, number> = {};
    filteredEntries.forEach(e => {
      if (e.identified_challenge && !POSITIVE_RESPONSES.includes(e.identified_challenge)) {
        counts[e.identified_challenge] = (counts[e.identified_challenge] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredEntries]);

  // Unified period stats (replaces separate weekly/monthly)
  const periodStats = useMemo(() => {
    const data = filteredEntries;
    const topProvinces = (() => {
      const pc: Record<string, number> = {};
      data.forEach(e => { pc[e.province] = (pc[e.province] || 0) + 1; });
      const sorted = Object.entries(pc).sort((a, b) => b[1] - a[1]);
      return sorted.slice(0, 3).map(([name, count]) => `${name} (${count})`).join(', ') || 'N/A';
    })();
    const topChallenges = challengeSummary.slice(0, 3).map(([name, count]) => `${name} (${count})`).join(', ') || 'N/A';
    return {
      totalFirms: data.length,
      pitched: data.filter(e => e.pitch_status === 'Pitched').length,
      followedUp: data.filter(e => e.pitch_status === 'Followed Up').length,
      interested: data.filter(e => e.pitch_status === 'Interested').length,
      rePitched: data.filter(e => e.pitch_status === 'Re-pitched').length,
      dealsClosed: data.filter(e => (e as any).deal_closed === true).length,
      provinces: [...new Set(data.map(e => e.province))].length,
      raf: data.filter(e => e.practice_area === 'RAF').length,
      medNeg: data.filter(e => e.practice_area === 'Medical Negligence').length,
      topProvinces,
      topChallenges,
    };
  }, [filteredEntries, challengeSummary]);

  const performanceData = useMemo(() => {
    const grouped: Record<string, PitchEntry[]> = {};
    filteredEntries.forEach(e => {
      if (!grouped[e.sales_person]) grouped[e.sales_person] = [];
      grouped[e.sales_person].push(e);
    });
    return Object.entries(grouped).map(([person, items]) => ({
      person,
      total: items.length,
      pitched: items.filter(i => i.pitch_status === 'Pitched').length,
      rePitched: items.filter(i => i.pitch_status === 'Re-pitched').length,
      followedUp: items.filter(i => i.pitch_status === 'Followed Up').length,
      interested: items.filter(i => i.identified_challenge === 'Interested' || i.comment === 'Interested').length,
      potential: items.filter(i => i.identified_challenge === 'Potential' || i.comment === 'Potential').length,
      followUpsDue: items.filter(i => i.follow_up_date && new Date(i.follow_up_date) <= new Date()).length,
    }));
  }, [filteredEntries]);

  // Count follow-ups per law firm (across all entries, not just filtered)
  const followUpCountByFirm = useMemo(() => {
    const counts: Record<string, number> = {};
    (entries || []).forEach(e => {
      if (e.pitch_status === 'Followed Up') {
        const key = e.law_firm_name.toLowerCase().trim();
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [entries]);

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

  const monthLabel = periodRange.label;

  const downloadTabPdf = useCallback((title: string, dataEntries: PitchEntry[], headers: string[], rowMapper: (e: PitchEntry) => (string | number)[], consultant: string) => {
    const filtered = consultant === 'all' ? dataEntries : dataEntries.filter(e => e.sales_person === consultant);
    const consultantLabel = consultant === 'all' ? 'All Sales Consultants' : consultant;
    const doc = new jsPDF({ orientation: 'landscape' });
    const startY = addBrandingToPDF(doc, `${title} — ${consultantLabel}`, `${monthLabel} | ${filtered.length} entries`);
    const tableOptions = getStyledTableOptions();
    autoTable(doc, {
      startY: startY + 5,
      head: [headers],
      body: filtered.map(rowMapper),
      ...tableOptions,
      styles: { ...tableOptions.styles, fontSize: 7, cellPadding: 1.5 },
      headStyles: { ...tableOptions.headStyles, fontSize: 7 },
      margin: { left: 10, right: 10 },
    });
    addBrandingFooter(doc);
    const safeName = `${title.replace(/\s+/g, '_')}_${consultantLabel.replace(/\s+/g, '_')}`;
    doc.save(`${safeName}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  }, [monthLabel]);

  const downloadReportsPdf = useCallback(async (consultant: string) => {
    const consultantLabel = consultant === 'all' ? 'All Sales Consultants' : consultant;
    const periodData = consultant === 'all' ? filteredEntries : filteredEntries.filter(e => e.sales_person === consultant);
    const doc = new jsPDF();
    const periodTitle = filterPeriod.charAt(0).toUpperCase() + filterPeriod.slice(1);
    const startY = addBrandingToPDF(doc, `${periodTitle} Report — ${consultantLabel}`, periodRange.label);
    const tableOptions = getStyledTableOptions();

    const makeStats = (data: PitchEntry[]) => [
      ['Total Pitched', data.length.toString()],
      ['New Pitches', data.filter(e => e.pitch_status === 'Pitched').length.toString()],
      ['Follow-Ups Done', data.filter(e => e.pitch_status === 'Followed Up').length.toString()],
      ['Re-pitched', data.filter(e => e.pitch_status === 'Re-pitched').length.toString()],
      ['Deals Closed', data.filter(e => (e as any).deal_closed === true).length.toString()],
      ['Interested', data.filter(e => e.pitch_status === 'Interested').length.toString()],
      ['Conversion Rate', `${data.length > 0 ? Math.round((data.filter(e => (e as any).deal_closed === true).length / data.length) * 100) : 0}%`],
    ];

    autoTable(doc, {
      startY: startY + 5,
      head: [[`${periodTitle} Report (${periodRange.label})`, 'Count']],
      body: makeStats(periodData),
      ...tableOptions,
    });

    // Fetch weekly summaries for the period
    try {
      const monthsForSummary: string[] = [];
      if (filterPeriod === 'quarterly') {
        const qStart = startOfQuarter(filterDate);
        for (let i = 0; i < 3; i++) monthsForSummary.push(format(addMonths(qStart, i), 'yyyy-MM'));
      } else {
        monthsForSummary.push(filterMonthStr);
      }

      let summaryQuery = supabase
        .from('pitchlog_weekly_summaries')
        .select('*')
        .in('month_year', monthsForSummary)
        .order('month_year')
        .order('week_number');

      if (consultant !== 'all') {
        summaryQuery = summaryQuery.eq('sales_person', consultant);
      }

      const { data: summaries } = await summaryQuery;

      if (summaries && summaries.length > 0) {
        const lastTableY = (doc as any).lastAutoTable?.finalY || 120;

        // Add section header
        doc.setFontSize(13);
        doc.setTextColor(31, 182, 206);
        doc.text('Weekly Summary & Strategy', 14, lastTableY + 15);

        const weekLabels = ['WK 1', 'WK 2', 'WK 3', 'WK 4'];
        const summaryBody: (string | number)[][] = [];

        // Group summaries by sales_person and month
        const grouped: Record<string, Record<string, typeof summaries>> = {};
        for (const s of summaries) {
          if (!grouped[s.sales_person]) grouped[s.sales_person] = {};
          if (!grouped[s.sales_person][s.month_year]) grouped[s.sales_person][s.month_year] = [];
          grouped[s.sales_person][s.month_year].push(s);
        }

        for (const [person, months] of Object.entries(grouped)) {
          for (const [monthYear, items] of Object.entries(months)) {
            const [y, m] = monthYear.split('-').map(Number);
            const monthName = format(new Date(y, m - 1, 1), 'MMM yyyy');

            for (const wk of [1, 2, 3, 4]) {
              const entry = items.find((s: any) => s.week_number === wk);
              if (entry?.summary_comment || entry?.weekly_strategy) {
                summaryBody.push([
                  person,
                  weekLabels[wk - 1],
                  entry.summary_comment || '',
                  entry.weekly_strategy || '',
                ]);
              }
            }
          }
        }

        if (summaryBody.length > 0) {
          autoTable(doc, {
            startY: lastTableY + 20,
            head: [['Sales Person', 'Week', 'Summary Comment', 'Strategy']],
            body: summaryBody,
            ...tableOptions,
            styles: { ...tableOptions.styles, fontSize: 8, cellPadding: 2 },
            headStyles: { ...tableOptions.headStyles, fontSize: 8 },
            columnStyles: {
              2: { cellWidth: 60 },
              3: { cellWidth: 60 },
            },
          });
        }
      }
    } catch (err) {
      console.warn('Could not fetch weekly summaries for PDF:', err);
    }

    addBrandingFooter(doc);
    doc.save(`${periodTitle}_Report_${consultantLabel.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  }, [filteredEntries, filterPeriod, periodRange, filterDate, filterMonthStr]);

  const downloadPerformancePdf = useCallback((consultant: string) => {
    const filtered = consultant === 'all' ? performanceData : performanceData.filter(p => p.person === consultant);
    const consultantLabel = consultant === 'all' ? 'All Sales Consultants' : consultant;
    const doc = new jsPDF({ orientation: 'landscape' });
    const startY = addBrandingToPDF(doc, `Performance Report — ${consultantLabel}`, monthLabel);
    const tableOptions = getStyledTableOptions();
    autoTable(doc, {
      startY: startY + 5,
      head: [['Sales Person', 'Total Pitches', 'New', 'Followed Up', 'Interested', 'Follow-Ups Due', 'Conversion %']],
      body: filtered.map(p => [p.person, p.total, p.pitched, p.followedUp, p.interested, p.followUpsDue, `${p.total > 0 ? Math.round((p.interested / p.total) * 100) : 0}%`]),
      ...tableOptions,
    });
    addBrandingFooter(doc);
    doc.save(`Performance_${consultantLabel.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  }, [performanceData, monthLabel]);

  // Reusable download selector component
  const ConsultantDownload = ({ onDownload }: { onDownload: (consultant: string) => void }) => (
    <div className="flex items-center gap-2">
      <Select value={downloadConsultant} onValueChange={setDownloadConsultant}>
        <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Select consultant" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sales Consultants</SelectItem>
          {salesPersons.map(sp => <SelectItem key={sp} value={sp}>{sp}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" onClick={() => onDownload(downloadConsultant)}>
        <Download className="h-4 w-4 mr-1" />PDF
      </Button>
    </div>
  );

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

  // Check for due follow-up reminders and create bell notifications
  usePitchlogFollowUpReminders();


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
              <NotificationCenter />
              <PitchlogExcelUpload onUpload={(rows) => bulkInsertMutation.mutate(rows)} />
              <Button size="sm" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                onClick={() => downloadPitchlogPdf(filteredEntries, monthLabel)}>
                <FileText className="h-4 w-4 mr-2" />PDF
              </Button>
              <Button size="sm" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                onClick={() => exportCSV(filteredEntries, `pitchlog-${filterMonthStr}`)}>
                <Download className="h-4 w-4 mr-2" />CSV
              </Button>
              <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setForm({ ...emptyForm, sales_person: currentUserName || '' }); }}>
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
                        <Input 
                          value={form.sales_person} 
                          onChange={e => setForm(f => ({ ...f, sales_person: e.target.value }))} 
                          placeholder="Staff member" 
                          readOnly={true}
                          className="bg-muted cursor-not-allowed"
                        />
                        <p className="text-xs text-muted-foreground">Auto-filled from your profile</p>
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
            <Label className="text-sm font-medium">Period:</Label>
            <Select value={filterPeriod} onValueChange={(v) => setFilterPeriod(v as FilterPeriod)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigatePeriod('prev')} title="Previous period">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[240px] justify-center text-left font-medium text-sm")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {periodRange.label}
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
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigatePeriod('next')} title="Next period">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-8 ml-1" onClick={goToToday}>
              Today
            </Button>
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
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-kutlwano-blue" />Pitchlog — {periodRange.label}</CardTitle>
                  <CardDescription>{filteredEntries.length} entries for {periodRange.label} — click Edit icon on any row to edit inline</CardDescription>
                </div>
                <ConsultantDownload onDownload={(c) => downloadTabPdf(
                  'Monthly_Pitchlog', filteredEntries,
                  ['Date', 'Province', 'Law Firm', 'Type', 'Practice', 'Contact', 'Email', 'Phone', 'Sales Person', 'Status', 'Follow-Up', 'Comment', 'Comment 2', 'Meeting'],
                  (e) => [e.created_at ? format(new Date(e.created_at), 'dd MMM yyyy') : '', e.province, e.law_firm_name, e.attorney_type, e.practice_area, e.contact_person, e.email || '', e.telephone || '', e.sales_person, e.pitch_status, e.follow_up_date ? format(new Date(e.follow_up_date), 'dd MMM yyyy') : '', e.identified_challenge || e.comment || '', e.comment_2 || '', e.meeting_function || ''],
                  c
                )} />
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
                          followUpCount={followUpCountByFirm[entry.law_firm_name.toLowerCase().trim()] || 0}
                        />
                      ))}
                      <PitchlogAddRow
                        onAdd={(data) => {
                          saveMutation.mutate({
                            ...emptyForm,
                            ...data,
                            sales_person: currentUserName || data.sales_person,
                          });
                        }}
                        isPending={saveMutation.isPending}
                        defaultSalesPerson={currentUserName || ''}
                        salesPersonReadOnly={true}
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
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-amber-500" />Potential Attorneys</CardTitle>
                  <CardDescription>{potentialAttorneys.length} attorneys marked as Potential or Interested</CardDescription>
                </div>
                <ConsultantDownload onDownload={(c) => downloadTabPdf(
                  'Potential_Attorneys', potentialAttorneys,
                  ['Date', 'Province', 'Law Firm', 'Type', 'Practice', 'Contact', 'Sales Person', 'Status', 'Comment'],
                  (e) => [e.created_at ? format(new Date(e.created_at), 'dd MMM yyyy') : '—', e.province, e.law_firm_name, e.attorney_type, e.practice_area, e.contact_person, e.sales_person, e.pitch_status, e.comment || '—'],
                  c
                )} />
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
                          followUpCount={followUpCountByFirm[entry.law_firm_name.toLowerCase().trim()] || 0}
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
            <div className="flex justify-end mb-4">
              <ConsultantDownload onDownload={(c) => downloadReportsPdf(c)} />
            </div>
            <Card className="border-border/50 shadow-soft mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-kutlwano-teal" />Sales Report — {periodRange.label}</CardTitle>
                <CardDescription>{filterPeriod.charAt(0).toUpperCase() + filterPeriod.slice(1)} activity summary</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    <TableRow><TableCell className="font-medium">Total Pitched</TableCell><TableCell className="text-right font-bold text-kutlwano-blue">{periodStats.totalFirms}</TableCell></TableRow>
                    <TableRow><TableCell className="font-medium">New Pitches</TableCell><TableCell className="text-right">{periodStats.pitched}</TableCell></TableRow>
                    <TableRow><TableCell className="font-medium">Follow-Ups Done</TableCell><TableCell className="text-right">{periodStats.followedUp}</TableCell></TableRow>
                    <TableRow><TableCell className="font-medium">Re-pitched</TableCell><TableCell className="text-right font-semibold text-purple-600">{periodStats.rePitched}</TableCell></TableRow>
                    <TableRow><TableCell className="font-medium">Deals Closed</TableCell><TableCell className="text-right font-semibold text-emerald-600">{periodStats.dealsClosed}</TableCell></TableRow>
                    <TableRow><TableCell className="font-medium">Interested Firms</TableCell><TableCell className="text-right font-semibold">{periodStats.interested}</TableCell></TableRow>
                    <TableRow><TableCell className="font-medium">Province Coverage</TableCell><TableCell className="text-right">{periodStats.provinces} provinces</TableCell></TableRow>
                    <TableRow><TableCell className="font-medium">RAF Focus</TableCell><TableCell className="text-right">{periodStats.raf}</TableCell></TableRow>
                    <TableRow><TableCell className="font-medium">Med Neg Focus</TableCell><TableCell className="text-right">{periodStats.medNeg}</TableCell></TableRow>
                    <TableRow><TableCell className="font-medium">Top Provinces</TableCell><TableCell className="text-right text-sm">{periodStats.topProvinces}</TableCell></TableRow>
                    <TableRow><TableCell className="font-medium">Top Challenges</TableCell><TableCell className="text-right text-sm">{periodStats.topChallenges}</TableCell></TableRow>
                    <TableRow><TableCell className="font-medium">Conversion Rate</TableCell><TableCell className="text-right font-bold">{periodStats.totalFirms > 0 ? Math.round((periodStats.dealsClosed / periodStats.totalFirms) * 100) : 0}%</TableCell></TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Weekly Summary & Strategy */}
            <PitchlogWeeklySummary
              filterMonthStr={filterMonthStr}
              monthLabel={monthLabel}
              salesPersonsList={salesPersons}
              selectedConsultant={filterSalesPerson}
              currentUserName={currentUserName || ''}
              isSalesConsultant={isSalesConsultant()}
            />
          </TabsContent>

          {/* CHALLENGES TAB */}
          <TabsContent value="challenges">
            <Card className="border-border/50 shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />Common Attorney Challenges Summary</CardTitle>
                <CardDescription>Grouped problems raised by attorneys in {periodRange.label}</CardDescription>
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
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-kutlwano-teal" />Sales Person Performance</CardTitle>
                  <CardDescription>Individual pitch activity for {periodRange.label}</CardDescription>
                </div>
                <ConsultantDownload onDownload={(c) => downloadPerformancePdf(c)} />
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sales Person</TableHead>
                      <TableHead className="text-center">Total Pitches</TableHead>
                      <TableHead className="text-center">New</TableHead>
                      <TableHead className="text-center">Re-Pitched</TableHead>
                      <TableHead className="text-center">Followed Up</TableHead>
                      <TableHead className="text-center">Interested</TableHead>
                      <TableHead className="text-center">Potential</TableHead>
                      <TableHead className="text-center">Follow-Ups Due</TableHead>
                      <TableHead className="text-center">Conversion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performanceData.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No data available.</TableCell></TableRow>
                    ) : performanceData.map(p => (
                      <TableRow key={p.person}>
                        <TableCell className="font-medium">{p.person}</TableCell>
                        <TableCell className="text-center font-bold text-kutlwano-blue">{p.total}</TableCell>
                        <TableCell className="text-center">{p.pitched}</TableCell>
                        <TableCell className="text-center">{p.rePitched}</TableCell>
                        <TableCell className="text-center">{p.followedUp}</TableCell>
                        <TableCell className="text-center font-semibold">{p.interested}</TableCell>
                        <TableCell className="text-center font-semibold text-amber-600">{p.potential}</TableCell>
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
