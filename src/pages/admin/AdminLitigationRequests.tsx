// src/pages/admin/AdminLitigationRequests.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Scale,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  Save,
  Ban,
  Timer,
  User,
  Building2,
  CalendarClock,
  Check,
  Paperclip,
  Download,
  X,
  UserCog,
  UserX,
} from 'lucide-react';
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
  AdminTabList,
  AdminTabTrigger,
  AdminSearchInput,
  AdminPagination,
} from '@/components/admin/ui/AdminUI';

/**
 * Litigation service requests — staff triage view.
 *
 * IMPORTANT NAMING NOTE: this page used to be called
 * AdminTrialReadiness.tsx and rendered entirely invented mock data (a
 * hardcoded `mockCases` array, never queried from the database) under
 * a "Trial Readiness" heading, with no nav entry pointing to it at
 * all. That silence in the nav wasn't an oversight — a REAL "Trial
 * Readiness Overview" panel, computed from actual case/report data,
 * already lives inside AdminReportManagement.tsx
 * (see `caseTrialReadiness` there) and is what "Trial Readiness"
 * correctly refers to today. The old standalone page was dead,
 * superseded code that should have been deleted, not resurrected.
 *
 * What genuinely was missing — and is this page's actual job now — is
 * a staff-facing view for `litigation_service_requests`: real requests
 * attorneys submit through the External/Attorney Portal (bundle
 * preparation, report summaries, medical chronology, and — since the
 * Case Actions rollout — Addendum / Affidavit / Joint Minute requests
 * against a specific case) were saving correctly to the database but
 * had no staff view anywhere in the codebase.
 *
 * `case_reference` is written by TWO different producers with
 * different shapes, and both must be handled here:
 *  - LitigationTrialServices.tsx (legacy bundle_preparation /
 *    report_summary / etc. types) — a free-text field the attorney
 *    types by hand (placeholder "e.g. CASE-2026-001").
 *  - RequestServiceDialog.tsx (addendum / affidavit / joint_minutes /
 *    appointment, launched from Case Actions in both the authenticated
 *    Attorney Portal and the guest Case Access flow) — the underlying
 *    appointment's UUID (`selectedCase.id`), not a human-readable
 *    reference at all.
 * A raw UUID means nothing to staff at a glance, so this page resolves
 * any case_reference that looks like a UUID against `appointments` to
 * show the real assessment code and appointment date instead. Free-text
 * references are shown as-is.
 *
 * The old page's "reports needed vs. submitted" readiness metric has
 * been dropped rather than rebuilt against real data here — that
 * number belongs in Report Management, computed off real
 * appointment/report data — not here.
 *
 * WORKFLOW FIXES (this pass): the notification/audit/storage plumbing
 * from the previous pass was verified live in Supabase (columns,
 * bucket, RLS, triggers and edge functions all exist and are wired
 * correctly) — nothing there needed fixing. What was still missing was
 * on this page itself:
 *  - Cancelling a request now requires a typed reason (`cancellation_reason`
 *    column) instead of silently flipping status with no explanation for
 *    the attorney who gets emailed.
 *  - Requests can now be assigned to a specific staff member
 *    (`assigned_to`/`assigned_at`), so it's clear who owns a request —
 *    the assignee is notified via public.notifications on assignment.
 *
 * PARITY FIXES (this pass): litigation_service_requests had none of the
 * plumbing appointment_requests has as a sibling "request" table —
 * fixed via migration + this file:
 *  - Staff are now notified (public.notifications) the moment a new
 *    request lands, matching on_new_appointment_request_notify. The
 *    submit dialog's "Our team has been notified" toast is now true.
 *  - Every write is now audited (audit_writes_litigation_service_requests),
 *    matching audit_writes_appointment_requests.
 *  - The requesting attorney is now emailed when staff change status
 *    (notify-litigation-request-status-change edge function, mirroring
 *    notify-attorney-assessment-change) — previously silent.
 *  - Attach/download is now real Supabase Storage (litigation-service-
 *    documents bucket), not a browser-memory-only preview.
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
  requested_by: string | null;
  referring_attorney_id: string | null;
  referring_attorneys?: { name: string; email: string | null; code: string } | null;
  response_document_path: string | null;
  response_document_name: string | null;
  response_document_uploaded_at: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  cancellation_reason: string | null;
}

interface ResolvedCase {
  assessment_code: string | null;
  appointment_date: string | null;
}

interface RequesterProfile {
  name: string | null;
  email: string | null;
}

interface StaffMember {
  id: string;
  name: string;
  email: string | null;
}

const DOCUMENTS_BUCKET = 'litigation-service-documents';

const SERVICE_TYPE_LABELS: Record<string, string> = {
  bundle_preparation: 'Medico-Legal Bundle Preparation',
  report_summary: 'Report Summaries',
  medical_chronology: 'Medical Chronology',
  quantum_calculation: 'Quantum Calculation',
  expert_availability: 'Expert Availability for Trial',
  case_consultation: 'Case Consultation',
  trial_coordination: 'Expert Trial Coordination',
  court_formatting: 'Court-Ready Report Formatting',
  // Submitted from Case Actions (My Cases / Case Access) via
  // src/components/attorney-portal/RequestServiceDialog.tsx.
  addendum: 'Addendum',
  affidavit: 'Affidavit',
  joint_minutes: 'Joint Minute',
};

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PAGE_SIZE = 12;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rough SLA windows (in hours) used only to flag requests worth chasing —
// not a formal commitment, just a triage aid for staff.
const OVERDUE_HOURS: Record<string, number> = {
  critical: 48,
  urgent: 72 /* 3 business-ish days */,
  standard: 24 * 7,
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'completed': return <AdminPill tone="success"><CheckCircle2 className="h-3 w-3" />Completed</AdminPill>;
    case 'in_progress': return <AdminPill tone="teal"><Clock className="h-3 w-3" />In Progress</AdminPill>;
    case 'cancelled': return <AdminPill tone="destructive"><Ban className="h-3 w-3" />Cancelled</AdminPill>;
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

const isOpenStatus = (status: string) => status !== 'completed' && status !== 'cancelled';

const isOverdue = (r: LitigationRequest) => {
  if (!isOpenStatus(r.status)) return false;
  const windowHours = OVERDUE_HOURS[r.urgency] ?? OVERDUE_HOURS.standard;
  const ageHours = (Date.now() - new Date(r.requested_at).getTime()) / (1000 * 60 * 60);
  return ageHours > windowHours;
};

const AdminLitigationRequests: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<LitigationRequest[]>([]);
  const [resolvedCases, setResolvedCases] = useState<Record<string, ResolvedCase>>({});
  const [requesters, setRequesters] = useState<Record<string, RequesterProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  // Real upload/download against the litigation-service-documents bucket.
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [attachTargetId, setAttachTargetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [statusTab, setStatusTab] = useState('all');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Staff (admin/employee) users a request can be assigned to.
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  // Cancelling requires a typed reason — captured via this dialog rather
  // than letting the status Select silently flip straight to "Cancelled".
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('litigation_service_requests' as any)
        .select('*, referring_attorneys(name, email, code)')
        .order('requested_at', { ascending: false });
      if (fetchError) throw fetchError;
      const rows = (data || []) as unknown as LitigationRequest[];
      setRequests(rows);

      // Resolve any UUID-shaped case_reference against appointments, so
      // staff see a real assessment code + date instead of a raw UUID
      // (RequestServiceDialog.tsx submits the appointment id, not free text).
      const uuidRefs = Array.from(
        new Set(rows.map(r => r.case_reference).filter((ref): ref is string => !!ref && UUID_RE.test(ref)))
      );
      if (uuidRefs.length > 0) {
        const { data: appts } = await supabase
          .from('appointments')
          .select('id, assessment_code, appointment_date')
          .in('id', uuidRefs);
        const caseMap: Record<string, ResolvedCase> = {};
        (appts || []).forEach((a: any) => {
          caseMap[a.id] = { assessment_code: a.assessment_code, appointment_date: a.appointment_date };
        });
        setResolvedCases(caseMap);
      } else {
        setResolvedCases({});
      }

      // Resolve the actual requesting user (requested_by -> auth.users.id).
      // litigation_service_requests has no FK to profiles, so this can't be
      // a nested select — fetch profiles for the distinct ids separately.
      const userIds = Array.from(new Set(rows.map(r => r.requested_by).filter((id): id is string => !!id)));
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', userIds);
        const userMap: Record<string, RequesterProfile> = {};
        (profiles || []).forEach((p: any) => {
          const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
          userMap[p.id] = { name: name || null, email: p.email || null };
        });
        setRequesters(userMap);
      } else {
        setRequesters({});
      }
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

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        // profiles.role is readable by any admin/employee (RLS: "Company
        // users can view relevant profiles"); public.user_roles is NOT —
        // its SELECT policy only lets an admin see everyone else's row,
        // so an employee-level viewer would only ever see themselves.
        // Querying profiles.role avoids that trap.
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, role, is_active')
          .in('role', ['admin', 'employee']);
        if (profilesError) throw profilesError;
        const list: StaffMember[] = (profiles || [])
          .filter((p: any) => p.is_active !== false)
          .map((p: any) => ({
            id: p.id,
            name: [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || 'Unnamed staff',
            email: p.email || null,
          }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setStaff(list);
      } catch (err) {
        console.error('Error fetching assignable staff:', err);
      }
    };
    fetchStaff();
  }, []);

  // Emails the referring attorney (and, for authenticated submissions,
  // the requester directly if that address differs) when staff change a
  // request's status. Fire-and-forget from the caller's perspective —
  // a failure here shouldn't block or roll back the status change that
  // already saved; it's just logged.
  const notifyRequesterOfStatusChange = useCallback(
    async (r: LitigationRequest, oldStatus: string, newStatus: string, notes?: string) => {
      const requester = r.requested_by ? requesters[r.requested_by] : undefined;
      const email = requester?.email || r.referring_attorneys?.email;
      if (!email) return; // guest submission with no resolvable email on file
      const name = requester?.name || r.referring_attorneys?.name || 'there';
      try {
        await supabase.functions.invoke('notify-litigation-request-status-change', {
          body: {
            requestId: r.id,
            serviceTypeLabel: SERVICE_TYPE_LABELS[r.service_type] || r.service_type,
            claimantName: r.claimant_name,
            oldStatus,
            newStatus,
            attorneyName: name,
            attorneyEmail: email,
            notes: notes || null,
          },
        });
      } catch (err) {
        console.error('Failed to send litigation request status change notification:', err);
      }
    },
    [requesters],
  );

  // Notifies the newly-assigned staff member via public.notifications.
  // RLS on that table already lets any admin/employee insert a
  // notification for any user, so this is a direct client-side insert —
  // no edge function needed. Fire-and-forget, same spirit as
  // notifyRequesterOfStatusChange: a failure here shouldn't block or
  // roll back the assignment that already saved.
  const notifyAssignee = useCallback(
    async (r: LitigationRequest, assigneeId: string) => {
      if (assigneeId === user?.id) return; // no need to notify yourself
      try {
        const { error: notifyError } = await supabase.from('notifications').insert({
          user_id: assigneeId,
          title: 'Litigation service request assigned to you',
          message: `${SERVICE_TYPE_LABELS[r.service_type] || r.service_type} for ${r.claimant_name} was assigned to you.`,
          type: 'info',
          category: 'litigation_service_request',
          related_record_id: r.id,
          related_table: 'litigation_service_requests',
        });
        if (notifyError) throw notifyError;
      } catch (err) {
        console.error('Failed to notify assignee of litigation service request:', err);
      }
    },
    [user?.id],
  );

  const updateRequest = async (
    id: string,
    changes: {
      status?: string;
      notes?: string;
      assigned_to?: string | null;
      assigned_at?: string | null;
      cancellation_reason?: string | null;
    },
  ) => {
    setSavingId(id);
    try {
      const existing = requests.find(r => r.id === id);
      const payload: Record<string, any> = { ...changes, updated_at: new Date().toISOString() };
      if (changes.status === 'completed') payload.completed_at = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('litigation_service_requests' as any)
        .update(payload)
        .eq('id', id);
      if (updateError) throw updateError;
      setRequests(prev => prev.map(r => (r.id === id ? { ...r, ...payload } : r)));
      toast({ title: 'Updated', description: 'Litigation service request updated.' });

      if (changes.status && existing && changes.status !== existing.status) {
        void notifyRequesterOfStatusChange(existing, existing.status, changes.status, changes.notes);
      }
      if (changes.assigned_to && existing && changes.assigned_to !== existing.assigned_to) {
        void notifyAssignee(existing, changes.assigned_to);
      }
    } catch (err) {
      console.error('Error updating litigation service request:', err);
      toast({ title: 'Error', description: 'Failed to update request.', variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  // Quick-action shortcut for the common first transition — same
  // updateRequest call the status dropdown already uses.
  const handleAccept = (id: string) => updateRequest(id, { status: 'in_progress' });

  // The status Select routes here instead of calling updateRequest
  // directly, so "Cancelled" can be intercepted and "everything else"
  // can still go straight through.
  const handleStatusChange = (r: LitigationRequest, newStatus: string) => {
    if (newStatus === 'cancelled') {
      setCancelReason('');
      setCancelTargetId(r.id);
      return;
    }
    // Leaving "Cancelled" for another status clears the old reason —
    // it no longer describes the request's current state.
    const changes: { status: string; cancellation_reason?: string | null } = { status: newStatus };
    if (r.status === 'cancelled') changes.cancellation_reason = null;
    updateRequest(r.id, changes);
  };

  const handleCancelConfirm = async () => {
    if (!cancelTargetId || !cancelReason.trim()) return;
    await updateRequest(cancelTargetId, { status: 'cancelled', cancellation_reason: cancelReason.trim() });
    setCancelTargetId(null);
    setCancelReason('');
  };

  const handleAssigneeChange = (r: LitigationRequest, value: string) => {
    setAssigningId(r.id);
    const changes =
      value === 'unassigned'
        ? { assigned_to: null, assigned_at: null }
        : { assigned_to: value, assigned_at: new Date().toISOString() };
    updateRequest(r.id, changes).finally(() => setAssigningId(null));
  };

  const handleAttachClick = (id: string) => {
    setAttachTargetId(id);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = attachTargetId;
    e.target.value = '';
    setAttachTargetId(null);
    if (!file || !targetId) return;

    setUploadingId(targetId);
    try {
      const path = `${targetId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const payload = {
        response_document_path: path,
        response_document_name: file.name,
        response_document_uploaded_at: new Date().toISOString(),
        response_document_uploaded_by: user?.id || null,
        updated_at: new Date().toISOString(),
      };
      const { error: updateError } = await supabase
        .from('litigation_service_requests' as any)
        .update(payload)
        .eq('id', targetId);
      if (updateError) throw updateError;

      setRequests(prev => prev.map(r => (r.id === targetId ? { ...r, ...payload } : r)));
      toast({ title: 'Document attached', description: `${file.name} saved to the request.` });
    } catch (err) {
      console.error('Error uploading litigation request document:', err);
      toast({ title: 'Upload failed', description: 'Could not save the document. Please try again.', variant: 'destructive' });
    } finally {
      setUploadingId(null);
    }
  };

  const handleRemoveAttachment = async (id: string) => {
    const existing = requests.find(r => r.id === id);
    if (!existing?.response_document_path) return;
    try {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([existing.response_document_path]);
      const payload = {
        response_document_path: null,
        response_document_name: null,
        response_document_uploaded_at: null,
        response_document_uploaded_by: null,
        updated_at: new Date().toISOString(),
      };
      const { error: updateError } = await supabase
        .from('litigation_service_requests' as any)
        .update(payload)
        .eq('id', id);
      if (updateError) throw updateError;
      setRequests(prev => prev.map(r => (r.id === id ? { ...r, ...payload } : r)));
    } catch (err) {
      console.error('Error removing litigation request document:', err);
      toast({ title: 'Error', description: 'Could not remove the document.', variant: 'destructive' });
    }
  };

  const handleDownload = async (id: string) => {
    const existing = requests.find(r => r.id === id);
    if (!existing?.response_document_path) return;
    try {
      const { data, error: signError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .createSignedUrl(existing.response_document_path, 300);
      if (signError || !data?.signedUrl) throw signError || new Error('No signed URL returned');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Error downloading litigation request document:', err);
      toast({ title: 'Error', description: 'Could not open the document.', variant: 'destructive' });
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const inProgressCount = requests.filter(r => r.status === 'in_progress').length;
  const completedCount = requests.filter(r => r.status === 'completed').length;
  const overdueCount = requests.filter(isOverdue).length;
  const unassignedOpenCount = requests.filter(r => isOpenStatus(r.status) && !r.assigned_to).length;

  const getStaffName = useCallback(
    (id: string | null) => {
      if (!id) return null;
      return staff.find(s => s.id === id)?.name || requesters[id]?.name || requesters[id]?.email || null;
    },
    [staff, requesters],
  );

  const serviceTypeOptions = useMemo(() => {
    const present = Array.from(new Set(requests.map(r => r.service_type)));
    return present.sort((a, b) => (SERVICE_TYPE_LABELS[a] || a).localeCompare(SERVICE_TYPE_LABELS[b] || b));
  }, [requests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter(r => {
      if (statusTab !== 'all' && r.status !== statusTab) return false;
      if (serviceTypeFilter !== 'all' && r.service_type !== serviceTypeFilter) return false;
      if (assigneeFilter === 'unassigned' && r.assigned_to) return false;
      if (assigneeFilter !== 'all' && assigneeFilter !== 'unassigned' && r.assigned_to !== assigneeFilter) return false;
      if (!q) return true;
      const resolved = r.case_reference ? resolvedCases[r.case_reference] : undefined;
      const requester = r.requested_by ? requesters[r.requested_by] : undefined;
      const haystack = [
        r.claimant_name,
        r.case_reference,
        resolved?.assessment_code,
        r.referring_attorneys?.name,
        r.referring_attorneys?.code,
        requester?.name,
        requester?.email,
        r.description,
        SERVICE_TYPE_LABELS[r.service_type] || r.service_type,
        getStaffName(r.assigned_to),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [requests, statusTab, serviceTypeFilter, assigneeFilter, search, resolvedCases, requesters, getStaffName]);

  useEffect(() => {
    setPage(1);
  }, [statusTab, serviceTypeFilter, assigneeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <AdminPage>
      <AdminHeader
        eyebrow="Litigation"
        title="Litigation Service Requests"
        description="Addendum, affidavit, joint minute, bundle preparation and other trial-support requests submitted by attorneys through the portal"
        icon={Scale}
      />

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6 md:gap-4">
        <AdminStatCard label="Pending" value={pendingCount} icon={AlertCircle} />
        <AdminStatCard label="In Progress" value={inProgressCount} icon={Clock} />
        <AdminStatCard label="Completed" value={completedCount} icon={CheckCircle2} />
        <AdminStatCard label="Overdue" value={overdueCount} icon={Timer} hint="Past its urgency SLA and still open" />
        <AdminStatCard label="Unassigned" value={unassignedOpenCount} icon={UserX} hint="Open requests with no owner" />
        <AdminStatCard label="Total" value={requests.length} icon={Scale} />
      </div>

      <AdminCard>
        <AdminCardHeader
          icon={BookOpen}
          title="All Requests"
          description={`${filtered.length} of ${requests.length} shown`}
        />

        <div className="flex flex-col gap-3 border-t border-black/10 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <Tabs value={statusTab} onValueChange={setStatusTab} className="w-full md:w-auto">
            <AdminTabList columns={STATUS_TABS.length}>
              {STATUS_TABS.map(t => (
                <AdminTabTrigger
                  key={t.value}
                  value={t.value}
                  label={t.label}
                  center
                  badge={
                    t.value === 'pending' ? pendingCount
                      : t.value === 'in_progress' ? inProgressCount
                      : t.value === 'completed' ? completedCount
                      : undefined
                  }
                />
              ))}
            </AdminTabList>
          </Tabs>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
              <SelectTrigger className="w-full rounded-none border-black/15 sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All service types</SelectItem>
                {serviceTypeOptions.map(t => (
                  <SelectItem key={t} value={t}>{SERVICE_TYPE_LABELS[t] || t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-full rounded-none border-black/15 sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anyone assigned</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {user?.id && <SelectItem value={user.id}>Assigned to me</SelectItem>}
                {staff.filter(s => s.id !== user?.id).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AdminSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search claimant, case, attorney…"
              className="w-full sm:w-64"
            />
          </div>
        </div>

        <Tabs value={statusTab}>
          <TabsContent value={statusTab} className="mt-0 focus-visible:outline-none">
            {loading ? (
              <AdminLoadingState label="Loading litigation service requests…" />
            ) : error ? (
              <AdminErrorState message={error} onRetry={fetchRequests} />
            ) : filtered.length === 0 ? (
              <AdminEmptyState
                icon={Scale}
                title={requests.length === 0 ? 'No litigation service requests yet' : 'No requests match these filters'}
              />
            ) : (
              <div className="divide-y divide-black/10">
                {pageItems.map((r) => {
                  const resolved = r.case_reference ? resolvedCases[r.case_reference] : undefined;
                  const caseLabel = resolved?.assessment_code
                    ? resolved.assessment_code
                    : r.case_reference && !UUID_RE.test(r.case_reference)
                    ? r.case_reference
                    : null;
                  const requester = r.requested_by ? requesters[r.requested_by] : undefined;
                  const requesterName = requester?.name || r.referring_attorneys?.name || null;
                  const overdue = isOverdue(r);

                  return (
                    <div key={r.id} className="space-y-3 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-black">{r.claimant_name}</span>
                            <UrgencyPill urgency={r.urgency} />
                            <StatusPill status={r.status} />
                            {overdue && <AdminPill tone="destructive"><Timer className="h-3 w-3" />Overdue</AdminPill>}
                            {r.assigned_to ? (
                              <AdminPill tone="neutral"><UserCog className="h-3 w-3" />{getStaffName(r.assigned_to) || 'Assigned'}</AdminPill>
                            ) : isOpenStatus(r.status) ? (
                              <AdminPill tone="warning"><UserX className="h-3 w-3" />Unassigned</AdminPill>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {SERVICE_TYPE_LABELS[r.service_type] || r.service_type}
                            {caseLabel && <> • Ref: {caseLabel}</>}
                            {resolved?.appointment_date && (
                              <> • Appt: {new Date(resolved.appointment_date).toLocaleDateString()}</>
                            )}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                            {requesterName && (
                              <span className="inline-flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {requesterName}
                                {requester?.email && <span className="text-slate-400">({requester.email})</span>}
                              </span>
                            )}
                            {r.referring_attorneys?.name && (
                              <span className="inline-flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {r.referring_attorneys.name}
                                {r.referring_attorneys.code && <span className="text-slate-400">({r.referring_attorneys.code})</span>}
                              </span>
                            )}
                          </p>
                          {r.description && <p className="mt-1 text-xs text-slate-600">{r.description}</p>}
                          {r.status === 'cancelled' && r.cancellation_reason && (
                            <p className="mt-1 flex items-start gap-1 text-xs text-destructive">
                              <Ban className="mt-0.5 h-3 w-3 shrink-0" />
                              <span>Cancelled: {r.cancellation_reason}</span>
                            </p>
                          )}
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                            <CalendarClock className="h-3 w-3" />
                            Requested {new Date(r.requested_at).toLocaleDateString()}
                            {r.trial_date && <> • Trial date: {new Date(r.trial_date).toLocaleDateString()}</>}
                            {r.completed_at && <> • Completed {new Date(r.completed_at).toLocaleDateString()}</>}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Select
                            value={r.status}
                            onValueChange={(v) => handleStatusChange(r, v)}
                            disabled={savingId === r.id}
                          >
                            <SelectTrigger className="w-40 rounded-none border-black/15"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map(s => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={r.assigned_to || 'unassigned'}
                            onValueChange={(v) => handleAssigneeChange(r, v)}
                            disabled={assigningId === r.id}
                          >
                            <SelectTrigger className="w-40 rounded-none border-black/15 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {staff.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {r.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-none gap-1"
                            disabled={savingId === r.id}
                            onClick={() => handleAccept(r.id)}
                          >
                            <Check className="h-3.5 w-3.5" /> Accept
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-none gap-1"
                          disabled={uploadingId === r.id}
                          onClick={() => handleAttachClick(r.id)}
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {uploadingId === r.id ? 'Uploading…' : r.response_document_path ? 'Replace file' : 'Attach file'}
                        </Button>
                        {r.response_document_path && (
                          <div className="flex items-center gap-1.5 border border-dashed border-black/20 bg-muted/30 px-2 py-1 text-[11px]">
                            <span className="max-w-[180px] truncate text-slate-600" title={r.response_document_name || undefined}>
                              {r.response_document_name}
                            </span>
                            <button
                              type="button"
                              title="Download"
                              className="text-primary hover:text-primary/70"
                              onClick={() => handleDownload(r.id)}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Remove"
                              className="text-slate-400 hover:text-destructive"
                              onClick={() => handleRemoveAttachment(r.id)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
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
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {!loading && !error && filtered.length > 0 && (
          <AdminPagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={filtered.length}
            startIndex={startIndex}
            endIndex={startIndex + pageItems.length}
          />
        )}
      </AdminCard>

      <Dialog open={!!cancelTargetId} onOpenChange={(open) => { if (!open) { setCancelTargetId(null); setCancelReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this request?</DialogTitle>
            <DialogDescription>
              The requesting attorney will be emailed that this request was cancelled. Add a reason so they know why.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Cancellation reason</Label>
            <Textarea
              id="cancel-reason"
              className="min-h-[6rem] rounded-none border-black/15"
              placeholder="e.g. Duplicate request, claimant withdrew, already covered by an existing report…"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => { setCancelTargetId(null); setCancelReason(''); }}
            >
              Back
            </Button>
            <Button
              variant="destructive"
              className="rounded-none gap-1"
              disabled={!cancelReason.trim() || savingId === cancelTargetId}
              onClick={handleCancelConfirm}
            >
              <Ban className="h-3.5 w-3.5" /> Cancel Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
};

export default AdminLitigationRequests;
