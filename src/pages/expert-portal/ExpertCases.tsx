import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/portal/ExpertPortalCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import {
  PortalPage,
  PortalHeader,
  SyncStatus,
  PortalEmptyState,
  PortalLoadingState,
} from '@/components/attorney-portal/ui/PortalPrimitives';
import { AdminTabList, AdminTabTrigger } from '@/components/admin/ui/AdminUI';
import { ExpertNotLinkedState } from '@/components/portal/ExpertNotLinkedState';
import { useExpertLinkStatus } from '@/hooks/useExpertLinkStatus';
import {
  Briefcase, Search, Clock, MapPin, FileText, AlertTriangle, Calendar, User, Eye, Building2,
  Upload, CheckCircle2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';
import { format, differenceInDays, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface CaseAssignment {
  id: string;
  appointment_date: string;
  matter_type: string | null;
  case_status: string | null;
  claimant_name: string;
  claimant_auto_id: string;
  attorney_name: string;
  report_status: string | null;
  report_due_date: string | null;
  report_submitted_date: string | null;
  days_to_complete: number | null;
  document_count: number;
  location: string | null;
  payment_status: string | null;
}

const ExpertCases: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const linkStatus = useExpertLinkStatus();
  const { lastUpdate, isActiveTab, isPageLocked } = useAppointmentSync();
  const [cases, setCases] = useState<CaseAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notLinked, setNotLinked] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');

  const loadCases = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('expert_id').eq('id', user.id).single();
      if (!profile?.expert_id) { setNotLinked(true); setLoading(false); return; }

      const apptsRes = await supabase
        .from('appointments')
        .select(`
          id, appointment_date, matter_type, case_status, payment_status,
          claimants(first_name, last_name, auto_id),
          referring_attorneys:referring_attorney_id(name),
          medical_experts:expert_id(practice_address)
        `)
        .eq('expert_id', profile.expert_id)
        .is('deleted_at', null)
        .order('appointment_date', { ascending: false });

      const appointmentIds = (apptsRes.data || []).map((a) => a.id);

      const [reportsRes, docsRes] = await Promise.all([
        supabase.from('expert_reports').select('*').eq('expert_id', profile.expert_id),
        // Scoped by appointment_id, not documents.expert_id — most
        // documents on a case (medical records, ID copies, police
        // reports, etc.) are uploaded by staff and never get expert_id
        // set on the row at all; only documents the expert uploads
        // themselves (see ExpertCaseDetail's report upload) do. Filtering
        // on documents.expert_id alone silently undercounted every case
        // down to just the expert's own uploads. This mirrors exactly
        // what the documents RLS policy itself checks (Phase 13/14):
        // expert_id OR appointment ownership — appointment_id is the
        // relationship that's actually always present.
        appointmentIds.length
          ? supabase.from('documents').select('id, appointment_id').in('appointment_id', appointmentIds)
          : Promise.resolve({ data: [] as { id: string; appointment_id: string }[] }),
      ]);

      const appointments = apptsRes.data || [];
      const reports = reportsRes.data || [];
      const docs = docsRes.data || [];

      const mapped: CaseAssignment[] = appointments.map(a => {
        const report = reports.find(r => r.appointment_id === a.id);
        const docCount = docs.filter(d => d.appointment_id === a.id).length;
        return {
          id: a.id,
          appointment_date: a.appointment_date,
          matter_type: a.matter_type,
          case_status: a.case_status,
          claimant_name: a.claimants ? `${a.claimants.first_name} ${a.claimants.last_name}` : 'Unknown',
          claimant_auto_id: a.claimants?.auto_id || '',
          attorney_name: (a as any).referring_attorneys?.name || 'N/A',
          report_status: report?.report_status || null,
          report_due_date: report?.report_due_date || null,
          report_submitted_date: report?.report_submitted_date || null,
          days_to_complete: report?.days_to_complete || null,
          document_count: docCount,
          location: (a as any).medical_experts?.practice_address || null,
          payment_status: a.payment_status,
        };
      });
      setCases(mapped);
    } catch (error) {
      // Previously unguarded — any thrown error here (network failure,
      // etc.) left `loading` stuck true forever with no error state,
      // which is exactly the "loading forever" failure mode this pass
      // is meant to close off.
      console.error('[ExpertCases] load failed', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Same page-lock-aware live sync as the rest of the platform (attorney
  // dashboard, admin views): fetch once on mount, then re-fetch whenever
  // AppointmentSyncContext reports a relevant change, as long as this tab
  // is active and the expert isn't mid-interaction with something else.
  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (!user) return;
    if (!initialFetchDone.current) {
      loadCases();
      initialFetchDone.current = true;
    } else if (isActiveTab && !isPageLocked) {
      loadCases();
    }
  }, [user, lastUpdate, loadCases, isActiveTab, isPageLocked]);

  const now = new Date();

  const getUrgencyLevel = (dueDate: string | null, status: string | null): string => {
    if (status === 'completed' || status === 'taken_out') return 'completed';
    if (!dueDate) return 'normal';
    const days = differenceInDays(parseISO(dueDate), now);
    if (days < 0) return 'overdue';
    if (days <= 3) return 'critical';
    if (days <= 7) return 'urgent';
    return 'normal';
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'overdue': return <Badge className="bg-destructive text-destructive-foreground text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>;
      case 'critical': return <Badge className="bg-destructive/80 text-destructive-foreground text-[10px]"><Clock className="h-3 w-3 mr-1" />Critical</Badge>;
      case 'urgent': return <Badge className="bg-warning text-warning-foreground text-[10px]"><Clock className="h-3 w-3 mr-1" />Urgent</Badge>;
      case 'completed': return <Badge className="bg-success/20 text-success text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">Normal</Badge>;
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed': return <Badge className="bg-success/20 text-success text-[10px]">Completed</Badge>;
      case 'taken_out': return <Badge className="bg-primary/20 text-primary text-[10px]">Taken Out</Badge>;
      case 'in_progress': return <Badge className="bg-warning/20 text-warning text-[10px]">In Progress</Badge>;
      case 'under_review': return <Badge className="bg-primary/20 text-primary text-[10px]">Under Review</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">Pending</Badge>;
    }
  };

  const tabFilteredCases = useMemo(() => {
    return cases.filter(c => {
      if (activeTab === 'upcoming') return new Date(c.appointment_date) >= now;
      if (activeTab === 'pending') return !['completed', 'taken_out'].includes(c.report_status || '') && new Date(c.appointment_date) < now;
      if (activeTab === 'overdue') {
        const urgency = getUrgencyLevel(c.report_due_date, c.report_status);
        return urgency === 'overdue' || urgency === 'critical';
      }
      if (activeTab === 'completed') return ['completed', 'taken_out'].includes(c.report_status || '');
      return true;
    });
  }, [cases, activeTab]);

  const filteredCases = useMemo(() => {
    return tabFilteredCases.filter(c => {
      const matchSearch = !searchTerm ||
        c.claimant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.claimant_auto_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.attorney_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || c.report_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [tabFilteredCases, searchTerm, statusFilter]);

  const tabCounts = useMemo(() => ({
    all: cases.length,
    upcoming: cases.filter(c => new Date(c.appointment_date) >= now).length,
    pending: cases.filter(c => !['completed', 'taken_out'].includes(c.report_status || '') && new Date(c.appointment_date) < now).length,
    overdue: cases.filter(c => {
      const urgency = getUrgencyLevel(c.report_due_date, c.report_status);
      return urgency === 'overdue' || urgency === 'critical';
    }).length,
    completed: cases.filter(c => ['completed', 'taken_out'].includes(c.report_status || '')).length,
  }), [cases]);

  if (linkStatus === 'checking') {
    return (
      <PortalPage>
        <PortalHeader eyebrow="Expert Portal" title="My Case Assignments" icon={Briefcase} />
        <PortalLoadingState label="Checking your account…" />
      </PortalPage>
    );
  }

  if (linkStatus === 'not_linked' || notLinked) {
    return (
      <PortalPage>
        <PortalHeader eyebrow="Expert Portal" title="My Case Assignments" icon={Briefcase} />
        <ExpertNotLinkedState description="Your account is not linked to a medical expert profile, so no cases can be shown yet. Contact an administrator or get help below." />
      </PortalPage>
    );
  }

  return (
    <PortalPage>
      <PortalHeader
        eyebrow="Expert Portal"
        title="My Case Assignments"
        description="View assigned cases, upload reports, and track deadlines."
        icon={Briefcase}
        actions={<SyncStatus loading={loading} onRefresh={loadCases} label="Live data" />}
      />

      {/* Tab Navigation — same black/scrollable system tab bar as the
          rest of the platform (AdminTabList/AdminTabTrigger), instead of
          the default shadcn Tabs styling this page used before. */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <AdminTabList>
          <AdminTabTrigger value="all" label="All" badge={tabCounts.all} />
          <AdminTabTrigger value="upcoming" label="Upcoming" badge={tabCounts.upcoming} />
          <AdminTabTrigger value="pending" label="Pending" badge={tabCounts.pending} />
          <AdminTabTrigger value="overdue" label="Overdue" badge={tabCounts.overdue} />
          <AdminTabTrigger value="completed" label="Done" badge={tabCounts.completed} />
        </AdminTabList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search claimant, attorney..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="not_received">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="taken_out">Taken Out</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Case Cards */}
      {loading ? (
        <Card className="border-black/10">
          <CardContent className="py-12 text-center text-sm text-slate-500">Loading cases…</CardContent>
        </Card>
      ) : filteredCases.length === 0 ? (
        <Card className="border-black/10">
          <PortalEmptyState icon={Briefcase} title="No cases match your filters" />
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredCases.map(c => {
            const urgency = getUrgencyLevel(c.report_due_date, c.report_status);
            const isUpcoming = new Date(c.appointment_date) >= now;
            return (
              <Card
                key={c.id}
                className={`border-black/10 cursor-pointer hover:border-black/25 transition-colors ${
                  urgency === 'overdue' || urgency === 'critical' ? 'border-l-4 border-l-destructive' :
                  urgency === 'urgent' ? 'border-l-4 border-l-warning' :
                  isUpcoming ? 'border-l-4 border-l-primary' : ''
                }`}
                onClick={() => navigate(`/expert-portal/case/${c.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{c.claimant_name}</h3>
                        <Badge variant="outline" className="text-[10px]">{c.claimant_auto_id}</Badge>
                        {getUrgencyBadge(urgency)}
                        {getStatusBadge(c.report_status)}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(parseISO(c.appointment_date), 'dd MMM yyyy')}</span>
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{c.attorney_name}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.matter_type || 'General'}</span>
                        <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{c.document_count} docs</span>
                        {c.location && (
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{c.location}</span>
                        )}
                        {c.report_due_date && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />Due: {format(parseISO(c.report_due_date), 'dd MMM yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!['completed', 'taken_out'].includes(c.report_status || '') && (
                        <Button variant="default" size="sm" className="text-xs shrink-0" onClick={e => { e.stopPropagation(); navigate(`/expert-portal/case/${c.id}`); }}>
                          <Upload className="h-3 w-3 mr-1" /> Upload Report
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="text-xs shrink-0" onClick={e => { e.stopPropagation(); navigate(`/expert-portal/case/${c.id}`); }}>
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PortalPage>
  );
};

export default ExpertCases;
