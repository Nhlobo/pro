import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Users, UserCheck, UserX, ClipboardList, FileText, AlertTriangle,
  Search, Filter, Eye, ArrowUpDown, CheckCircle2, Clock, XCircle,
  Bell, Download, Calendar, Activity,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { formatExpertType } from '@/utils/expertTypeMapping';

// ─── Types reused from CaseAccess ───
export interface CaseRow {
  id: string;
  claimant_name: string;
  appointment_date: string;
  case_status: string;
  payment_status: string;
  matter_type: string;
  expert_name: string;
  expert_type: string;
  report_status: string;
  report_submitted_date: string | null;
  service_fee: number;
  deposit_amount: number;
}

interface Props {
  cases: CaseRow[];
  onOpenDocuments?: (claimantName: string) => void;
}

// ─── Helpers ───
const isReportReceived = (status?: string) =>
  ['completed', 'taken_out', 'taken out', 'delivered', 'received'].includes((status || '').toLowerCase());

const isAssessed = (status?: string) =>
  ['assessed', 'completed', 'done', 'report_submitted'].includes((status || '').toLowerCase());

const normalizeClaimType = (raw?: string | null): string => {
  if (!raw) return '—';
  const k = raw.toLowerCase();
  if (k.includes('raf') || k.includes('mva')) return 'RAF';
  if (k.includes('negligence')) return 'Medical Negligence';
  if (k.includes('personal injury') || k.includes('injury')) return 'Personal Injury';
  return raw.replace(/_/g, ' ');
};

type Stage = 'Referral' | 'Booking' | 'Assessment' | 'Reports' | 'Litigation' | 'Closed';
const STAGES: Stage[] = ['Referral', 'Booking', 'Assessment', 'Reports', 'Litigation', 'Closed'];

interface ClaimantAggregate {
  name: string;
  caseRef: string;
  claimType: string;
  rows: CaseRow[];
  assessmentsBooked: number;
  assessmentsCompleted: number;
  reportsReceived: number;
  reportsOutstanding: number;
  totalReports: number;
  lastUpdated: string | null;
  status: 'Active' | 'Closed';
  stage: Stage;
  pct: number;
  hasOverdue: boolean;
  isLitigationReady: boolean;
}

const computeStage = (rows: CaseRow[]): { stage: Stage; pct: number } => {
  if (rows.length === 0) return { stage: 'Referral', pct: 10 };
  const total = rows.length;
  const received = rows.filter(r => isReportReceived(r.report_status)).length;
  if (received === total) return { stage: 'Closed', pct: 100 };
  if (received > 0) return { stage: 'Litigation', pct: 85 };
  const anyAssessed = rows.some(r => isAssessed(r.case_status));
  if (anyAssessed) return { stage: 'Reports', pct: 70 };
  const anyScheduled = rows.some(r => ['scheduled', 'confirmed', 'in_progress', 'in progress']
    .includes((r.case_status || '').toLowerCase()) || !!r.appointment_date);
  if (anyScheduled) return { stage: 'Assessment', pct: 45 };
  return { stage: 'Booking', pct: 25 };
};

const stageColor = (stage: Stage, current: Stage, hasOverdue: boolean) => {
  const idx = STAGES.indexOf(stage);
  const cur = STAGES.indexOf(current);
  if (idx < cur) return 'bg-success text-success-foreground border-success';
  if (idx === cur) return hasOverdue ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-primary text-primary-foreground border-primary';
  return 'bg-muted text-muted-foreground border-border';
};

const aggregateClaimants = (cases: CaseRow[]): ClaimantAggregate[] => {
  const map = new Map<string, CaseRow[]>();
  cases.forEach(c => {
    const k = (c.claimant_name || 'Unknown').trim();
    const arr = map.get(k) || [];
    arr.push(c);
    map.set(k, arr);
  });

  return Array.from(map.entries()).map(([name, rows]) => {
    const sorted = [...rows].sort((a, b) =>
      new Date(b.appointment_date || 0).getTime() - new Date(a.appointment_date || 0).getTime()
    );
    const assessmentsBooked = rows.length;
    const assessmentsCompleted = rows.filter(r => isAssessed(r.case_status)).length;
    const reportsReceived = rows.filter(r => isReportReceived(r.report_status)).length;
    const totalReports = rows.length;
    const reportsOutstanding = totalReports - reportsReceived;
    const { stage, pct } = computeStage(rows);
    const lastUpdated = sorted[0]?.report_submitted_date || sorted[0]?.appointment_date || null;
    // Overdue: appointment >30 days ago and report still not received
    const hasOverdue = rows.some(r => {
      if (isReportReceived(r.report_status)) return false;
      if (!r.appointment_date) return false;
      try {
        return differenceInDays(new Date(), parseISO(r.appointment_date)) > 30;
      } catch { return false; }
    });
    const isLitigationReady = reportsReceived === totalReports && totalReports > 0;
    const claimType = normalizeClaimType(sorted[0]?.matter_type);
    const caseRef = (sorted[0]?.id || '').slice(0, 8).toUpperCase();
    return {
      name,
      caseRef,
      claimType,
      rows,
      assessmentsBooked,
      assessmentsCompleted,
      reportsReceived,
      reportsOutstanding,
      totalReports,
      lastUpdated,
      status: stage === 'Closed' ? 'Closed' : 'Active',
      stage,
      pct,
      hasOverdue,
      isLitigationReady,
    };
  });
};

// ─── Component ───
const CaseAccessClaimantView: React.FC<Props> = ({ cases, onOpenDocuments }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'closed' | 'reports_outstanding' | 'litigation_ready'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'most_outstanding'>('newest');
  const [activeCard, setActiveCard] = useState<'all' | 'active' | 'closed' | 'booked' | 'received' | 'outstanding'>('all');
  const [selectedClaimant, setSelectedClaimant] = useState<ClaimantAggregate | null>(null);
  const [detailTab, setDetailTab] = useState('overview');

  const claimants = useMemo(() => aggregateClaimants(cases), [cases]);

  // Dashboard stats
  const stats = useMemo(() => ({
    activeClaimants: claimants.filter(c => c.status === 'Active').length,
    closedClaimants: claimants.filter(c => c.status === 'Closed').length,
    assessmentsBooked: claimants.reduce((s, c) => s + c.assessmentsBooked, 0),
    reportsReceived: claimants.reduce((s, c) => s + c.reportsReceived, 0),
    reportsOutstanding: claimants.reduce((s, c) => s + c.reportsOutstanding, 0),
  }), [claimants]);

  // Notifications
  const alerts = useMemo(() => {
    const list: { icon: React.ReactNode; title: string; desc: string; variant: string; claimant?: string }[] = [];
    claimants.forEach(c => {
      if (c.hasOverdue) {
        list.push({
          icon: <AlertTriangle className="h-4 w-4" />,
          title: 'Outstanding report overdue',
          desc: `${c.name} — ${c.reportsOutstanding} report(s) outstanding for >30 days`,
          variant: 'border-destructive/50 bg-destructive/5',
          claimant: c.name,
        });
      }
      if (c.totalReports > 0 && c.reportsReceived === c.totalReports) {
        list.push({
          icon: <CheckCircle2 className="h-4 w-4" />,
          title: 'All reports completed',
          desc: `${c.name} — case ready for litigation`,
          variant: 'border-success/50 bg-success/5',
          claimant: c.name,
        });
      } else if (c.reportsReceived > 0) {
        list.push({
          icon: <FileText className="h-4 w-4" />,
          title: 'New report uploaded',
          desc: `${c.name} — ${c.reportsReceived}/${c.totalReports} report(s) available`,
          variant: 'border-primary/30 bg-primary/5',
          claimant: c.name,
        });
      }
    });
    return list.slice(0, 6);
  }, [claimants]);

  // Filtered + sorted
  const visible = useMemo(() => {
    let list = [...claimants];

    // card quick filter
    if (activeCard === 'active') list = list.filter(c => c.status === 'Active');
    else if (activeCard === 'closed') list = list.filter(c => c.status === 'Closed');
    else if (activeCard === 'outstanding') list = list.filter(c => c.reportsOutstanding > 0);
    else if (activeCard === 'received') list = list.filter(c => c.reportsReceived > 0);
    else if (activeCard === 'booked') list = list.filter(c => c.assessmentsBooked > 0);

    // dropdown filter
    if (filter === 'active') list = list.filter(c => c.status === 'Active');
    else if (filter === 'closed') list = list.filter(c => c.status === 'Closed');
    else if (filter === 'reports_outstanding') list = list.filter(c => c.reportsOutstanding > 0);
    else if (filter === 'litigation_ready') list = list.filter(c => c.isLitigationReady);

    // search
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.caseRef.toLowerCase().includes(q) ||
        c.claimType.toLowerCase().includes(q)
      );
    }

    // sort
    list.sort((a, b) => {
      if (sortBy === 'most_outstanding') return b.reportsOutstanding - a.reportsOutstanding;
      const aDate = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
      const bDate = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
      return sortBy === 'newest' ? bDate - aDate : aDate - bDate;
    });

    return list;
  }, [claimants, search, filter, sortBy, activeCard]);

  const openClaimant = (name: string) => {
    const found = claimants.find(c => c.name === name);
    if (found) {
      setSelectedClaimant(found);
      setDetailTab('overview');
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── 1. DASHBOARD CARDS ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${activeCard === 'active' ? 'border-primary ring-2 ring-primary/20' : 'border-border/50'}`}
          onClick={() => setActiveCard(activeCard === 'active' ? 'all' : 'active')}
        >
          <CardContent className="py-4 text-center">
            <UserCheck className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-primary">{stats.activeClaimants}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Active Claimants</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${activeCard === 'closed' ? 'border-success ring-2 ring-success/20' : 'border-border/50'}`}
          onClick={() => setActiveCard(activeCard === 'closed' ? 'all' : 'closed')}
        >
          <CardContent className="py-4 text-center">
            <UserX className="h-5 w-5 text-success mx-auto mb-1" />
            <p className="text-2xl font-bold text-success">{stats.closedClaimants}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Closed Claimants</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${activeCard === 'booked' ? 'border-info ring-2 ring-info/20' : 'border-border/50'}`}
          onClick={() => setActiveCard(activeCard === 'booked' ? 'all' : 'booked')}
        >
          <CardContent className="py-4 text-center">
            <ClipboardList className="h-5 w-5 text-info mx-auto mb-1" />
            <p className="text-2xl font-bold text-info">{stats.assessmentsBooked}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Assessments Booked</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${activeCard === 'received' ? 'border-success ring-2 ring-success/20' : 'border-border/50'}`}
          onClick={() => setActiveCard(activeCard === 'received' ? 'all' : 'received')}
        >
          <CardContent className="py-4 text-center">
            <FileText className="h-5 w-5 text-success mx-auto mb-1" />
            <p className="text-2xl font-bold text-success">{stats.reportsReceived}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Reports Received</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${activeCard === 'outstanding' ? 'border-destructive ring-2 ring-destructive/20' : 'border-border/50'}`}
          onClick={() => setActiveCard(activeCard === 'outstanding' ? 'all' : 'outstanding')}
        >
          <CardContent className="py-4 text-center">
            <AlertTriangle className="h-5 w-5 text-destructive mx-auto mb-1" />
            <p className="text-2xl font-bold text-destructive">{stats.reportsOutstanding}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Outstanding Reports</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── 6. NOTIFICATIONS ─── */}
      {alerts.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" /> Recent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a, i) => (
              <Alert
                key={i}
                className={`${a.variant} cursor-pointer hover:opacity-80 transition`}
                onClick={() => a.claimant && openClaimant(a.claimant)}
              >
                {a.icon}
                <AlertTitle className="text-xs font-semibold">{a.title}</AlertTitle>
                <AlertDescription className="text-xs">{a.desc}</AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ─── 2. CLAIMANT LIST + Search/Filter/Sort ─── */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Claimants ({visible.length})
          </CardTitle>
          <CardDescription>Click a claimant to view full case file, assessments and reports.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by claimant name or case reference..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
              <SelectTrigger className="w-full md:w-[200px]">
                <Filter className="h-4 w-4 mr-2" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Claimants</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="reports_outstanding">Reports Outstanding</SelectItem>
                <SelectItem value="litigation_ready">Ready for Litigation</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-full md:w-[180px]">
                <ArrowUpDown className="h-4 w-4 mr-2" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="most_outstanding">Most Outstanding</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {visible.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No claimants match your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Claimant</TableHead>
                    <TableHead>Case Ref</TableHead>
                    <TableHead>Claim Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Assessments</TableHead>
                    <TableHead className="text-center">Reports R/O</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map(c => (
                    <TableRow
                      key={c.name}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => { setSelectedClaimant(c); setDetailTab('overview'); }}
                    >
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{c.caseRef}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{c.claimType}</Badge>
                      </TableCell>
                      <TableCell>
                        {c.status === 'Closed'
                          ? <Badge className="bg-success/10 text-success border-success/20">Closed</Badge>
                          : c.hasOverdue
                            ? <Badge variant="destructive">Overdue</Badge>
                            : <Badge className="bg-primary/10 text-primary border-primary/20">Active</Badge>
                        }
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs">{c.assessmentsCompleted}/{c.assessmentsBooked}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs">
                          <span className="text-success font-medium">{c.reportsReceived}</span>
                          <span className="text-muted-foreground"> / </span>
                          <span className={c.reportsOutstanding > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                            {c.reportsOutstanding}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.lastUpdated ? format(parseISO(c.lastUpdated), 'dd MMM yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); setSelectedClaimant(c); setDetailTab('overview'); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 3. CLAIMANT DETAIL DIALOG ─── */}
      <Dialog open={!!selectedClaimant} onOpenChange={(o) => !o && setSelectedClaimant(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedClaimant && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedClaimant.name}</DialogTitle>
                <DialogDescription>
                  Case Ref: <span className="font-mono">{selectedClaimant.caseRef}</span> • {selectedClaimant.claimType}
                </DialogDescription>
              </DialogHeader>

              <Tabs value={detailTab} onValueChange={setDetailTab} className="mt-4">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="assessments">Assessments</TabsTrigger>
                  <TabsTrigger value="reports">Reports</TabsTrigger>
                </TabsList>

                {/* A. Overview */}
                <TabsContent value="overview" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Full Name</p>
                      <p className="font-medium">{selectedClaimant.name}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Case Reference</p>
                      <p className="font-mono font-medium">{selectedClaimant.caseRef}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Claim Type</p>
                      <p className="font-medium">{selectedClaimant.claimType}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Current Stage</p>
                      <p className="font-medium">{selectedClaimant.stage}</p>
                    </div>
                  </div>

                  {/* ─── 5. LIVE STATUS TRACKER ─── */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" /> Workflow Progress
                      </h4>
                      <span className="text-xs text-muted-foreground">{selectedClaimant.pct}% complete</span>
                    </div>
                    <Progress value={selectedClaimant.pct} className="h-2" />
                    <div className="grid grid-cols-6 gap-1.5">
                      {STAGES.map(stage => (
                        <div
                          key={stage}
                          className={`text-center p-2 rounded-md border text-[10px] font-medium ${stageColor(stage, selectedClaimant.stage, selectedClaimant.hasOverdue)}`}
                        >
                          {stage}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
                      <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-success" /> Completed</span>
                      <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-primary" /> Current</span>
                      <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-destructive" /> Delayed</span>
                    </div>
                  </div>
                </TabsContent>

                {/* B. Assessments */}
                <TabsContent value="assessments" className="pt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Expert Type</TableHead>
                        <TableHead>Appointment Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedClaimant.rows.map(r => {
                        const s = (r.case_status || '').toLowerCase();
                        let badge: React.ReactNode;
                        if (isAssessed(s)) badge = <Badge className="bg-success/10 text-success border-success/20">Assessed</Badge>;
                        else if (['scheduled', 'confirmed'].includes(s)) badge = <Badge className="bg-info/10 text-info border-info/20">Scheduled</Badge>;
                        else if (s === 'rescheduled') badge = <Badge className="bg-warning/10 text-warning border-warning/20">Rescheduled</Badge>;
                        else if (['missed', 'no_show', 'cancelled'].includes(s)) badge = <Badge variant="destructive">Missed</Badge>;
                        else badge = <Badge variant="outline">Pending</Badge>;

                        return (
                          <TableRow key={r.id}>
                            <TableCell>{formatExpertType(r.expert_type)}</TableCell>
                            <TableCell>
                              {r.appointment_date ? format(parseISO(r.appointment_date), 'dd MMM yyyy') : '—'}
                            </TableCell>
                            <TableCell>{badge}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TabsContent>

                {/* C. Reports */}
                <TabsContent value="reports" className="pt-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-muted/30 text-center">
                      <p className="text-xl font-bold">{selectedClaimant.totalReports}</p>
                      <p className="text-[10px] text-muted-foreground">Total Required</p>
                    </div>
                    <div className="p-3 rounded-lg bg-success/5 text-center">
                      <p className="text-xl font-bold text-success">{selectedClaimant.reportsReceived}</p>
                      <p className="text-[10px] text-muted-foreground">Received</p>
                    </div>
                    <div className="p-3 rounded-lg bg-destructive/5 text-center">
                      <p className="text-xl font-bold text-destructive">{selectedClaimant.reportsOutstanding}</p>
                      <p className="text-[10px] text-muted-foreground">Outstanding</p>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Expert / Specialty</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due / Received</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedClaimant.rows.map(r => {
                        const received = isReportReceived(r.report_status);
                        const overdue = !received && r.appointment_date &&
                          differenceInDays(new Date(), parseISO(r.appointment_date)) > 30;
                        return (
                          <TableRow key={r.id} className={overdue ? 'bg-destructive/5' : ''}>
                            <TableCell>{formatExpertType(r.expert_type)}</TableCell>
                            <TableCell>
                              {received
                                ? <Badge className="bg-success/10 text-success border-success/20"><CheckCircle2 className="h-3 w-3 mr-1" />Received</Badge>
                                : overdue
                                  ? <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Overdue</Badge>
                                  : <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Outstanding</Badge>
                              }
                            </TableCell>
                            <TableCell className="text-xs">
                              {r.report_submitted_date
                                ? <span className="text-success">Received: {format(parseISO(r.report_submitted_date), 'dd MMM yyyy')}</span>
                                : r.appointment_date
                                  ? <span className="text-muted-foreground">After: {format(parseISO(r.appointment_date), 'dd MMM yyyy')}</span>
                                  : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {received && onOpenDocuments ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => { onOpenDocuments(selectedClaimant.name); setSelectedClaimant(null); }}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CaseAccessClaimantView;
