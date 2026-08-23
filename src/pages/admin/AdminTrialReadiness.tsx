// src/pages/admin/AdminTrialReadiness.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Scale, CheckCircle2, AlertCircle, Clock, FileText, BookOpen, Save } from 'lucide-react';
import {
  AdminPage,
  AdminHeader,
  AdminCard,
  AdminCardHeader,
  AdminStatCard,
  AdminPill,
  AdminEmptyState,
  AdminLoadingState,
  AdminErrorState,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

/**
 * Litigation service requests — staff triage view.
 *
 * This page used to render entirely invented mock data (a hardcoded
 * `mockCases` array, never queried from the database) under a
 * "Litigation" / "Trial Readiness" heading. Meanwhile, real litigation
 * service requests — submitted by attorneys via the External Portal's
 * LitigationTrialServices.tsx — were saving correctly to
 * `litigation_service_requests` but had no staff-facing view anywhere
 * in the codebase. This page now shows the real requests, with the
 * exact status/urgency vocabulary the submission form uses
 * ('pending' | 'in_progress' | 'completed' | 'cancelled',
 * 'standard' | 'urgent' | 'critical').
 *
 * The previous page's "reports needed vs. submitted" readiness metric
 * has been dropped rather than rebuilt against real data: case_reference
 * is a free-text field the attorney types by hand (placeholder
 * "e.g. CASE-2026-001"), not a foreign key to any claimant or
 * appointment record, so there's no reliable way to compute a real
 * completion percentage from it without risking a wrong answer from a
 * fuzzy match. Better to not show that number than to show one that
 * could be wrong.
 */

interface LitigationRequest {
  id: string;
  service_type: string;
  claimant_name: string;
  case_reference: string | null;
  urgency: string;
  status: string;
  description: string | null;
  trial_date: string | null;
  requested_at: string;
  completed_at: string | null;
  notes: string | null;
  referring_attorney_id: string | null;
  referring_attorneys?: { name: string } | null;
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  bundle_preparation: 'Medico-Legal Bundle Preparation',
  report_summary: 'Report Summaries',
  medical_chronology: 'Medical Chronology',
  quantum_calculation: 'Quantum Calculation',
  expert_availability: 'Expert Availability for Trial',
  case_consultation: 'Case Consultation',
};

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'completed': return <AdminPill tone="success"><CheckCircle2 className="h-3 w-3" />Completed</AdminPill>;
    case 'in_progress': return <AdminPill tone="teal"><Clock className="h-3 w-3" />In Progress</AdminPill>;
    case 'cancelled': return <AdminPill tone="destructive">Cancelled</AdminPill>;
    default: return <AdminPill tone="warning"><AlertCircle className="h-3 w-3" />Pending</AdminPill>;
  }
};

const UrgencyPill: React.FC<{ urgency: string }> = ({ urgency }) => {
  switch (urgency) {
    case 'critical': return <AdminPill tone="destructive">Critical</AdminPill>;
    case 'urgent': return <AdminPill tone="warning">Urgent</AdminPill>;
    default: return <AdminPill tone="neutral">Standard</AdminPill>;
  }
};

const AdminTrialReadiness: React.FC = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<LitigationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('litigation_service_requests' as any)
        .select('*, referring_attorneys(name)')
        .order('requested_at', { ascending: false });
      if (fetchError) throw fetchError;
      setRequests((data || []) as unknown as LitigationRequest[]);
    } catch (err) {
      console.error('Error fetching litigation service requests:', err);
      setError('Could not load litigation service requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const updateRequest = async (id: string, changes: { status?: string; notes?: string }) => {
    setSavingId(id);
    try {
      const payload: Record<string, any> = { ...changes, updated_at: new Date().toISOString() };
      if (changes.status === 'completed') payload.completed_at = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('litigation_service_requests' as any)
        .update(payload)
        .eq('id', id);
      if (updateError) throw updateError;
      setRequests(prev => prev.map(r => (r.id === id ? { ...r, ...payload } : r)));
      toast({ title: 'Updated', description: 'Litigation service request updated.' });
    } catch (err) {
      console.error('Error updating litigation service request:', err);
      toast({ title: 'Error', description: 'Failed to update request.', variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const inProgressCount = requests.filter(r => r.status === 'in_progress').length;
  const completedCount = requests.filter(r => r.status === 'completed').length;
  const criticalCount = requests.filter(r => r.urgency === 'critical' && r.status !== 'completed' && r.status !== 'cancelled').length;

  return (
    <AdminPage>
      <AdminHeader
        eyebrow="Litigation"
        title="Litigation Service Requests"
        description="Bundle preparation, report summaries, and other trial-support requests submitted by attorneys through the portal"
        icon={Scale}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <AdminStatCard label="Pending" value={pendingCount} icon={AlertCircle} />
        <AdminStatCard label="In Progress" value={inProgressCount} icon={Clock} />
        <AdminStatCard label="Completed" value={completedCount} icon={CheckCircle2} />
        <AdminStatCard label="Critical & Open" value={criticalCount} icon={Scale} />
      </div>

      <AdminCard>
        <AdminCardHeader icon={BookOpen} title="All Requests" description={`${requests.length} total`} />
        {loading ? (
          <AdminLoadingState label="Loading litigation service requests…" />
        ) : error ? (
          <AdminErrorState message={error} onRetry={fetchRequests} />
        ) : requests.length === 0 ? (
          <AdminEmptyState icon={Scale} title="No litigation service requests yet" />
        ) : (
          <div className="divide-y divide-black/10">
            {requests.map((r) => (
              <div key={r.id} className="space-y-3 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-black">{r.claimant_name}</span>
                      <UrgencyPill urgency={r.urgency} />
                      <StatusPill status={r.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {SERVICE_TYPE_LABELS[r.service_type] || r.service_type}
                      {r.case_reference && <> • Ref: {r.case_reference}</>}
                      {r.referring_attorneys?.name && <> • {r.referring_attorneys.name}</>}
                    </p>
                    {r.description && <p className="mt-1 text-xs text-slate-600">{r.description}</p>}
                    <p className="mt-1 text-[11px] text-slate-400">
                      Requested {new Date(r.requested_at).toLocaleDateString()}
                      {r.trial_date && <> • Trial date: {new Date(r.trial_date).toLocaleDateString()}</>}
                    </p>
                  </div>
                  <Select
                    value={r.status}
                    onValueChange={(v) => updateRequest(r.id, { status: v })}
                    disabled={savingId === r.id}
                  >
                    <SelectTrigger className="w-40 rounded-none border-black/15"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-start gap-2">
                  <Textarea
                    className="min-h-[2.25rem] flex-1 rounded-none border-black/15 text-xs"
                    placeholder="Internal notes…"
                    value={notesDraft[r.id] ?? r.notes ?? ''}
                    onChange={(e) => setNotesDraft(p => ({ ...p, [r.id]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-none"
                    disabled={savingId === r.id || (notesDraft[r.id] ?? r.notes ?? '') === (r.notes ?? '')}
                    onClick={() => updateRequest(r.id, { notes: notesDraft[r.id] ?? '' })}
                  >
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </AdminPage>
  );
};

export default AdminTrialReadiness;
