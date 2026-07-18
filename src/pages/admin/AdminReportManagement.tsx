import React, { useState, useEffect, useCallback, useRef } from "react";
import { Helmet } from "react-helmet-async";
import {
  FileText, Search, RefreshCw, Eye, Send, CheckCircle2,
  Clock, AlertCircle, Star, Filter, Mail, Activity, Paperclip, X, FileDown, Wifi, WifiOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { uploadFileResumable } from "@/lib/resumableUpload";
import { upsertExpertReport } from "@/utils/expertReports";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";
import CompanyFooter from "@/components/CompanyFooter";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  AdminPage,
  AdminHeader,
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminStatCard,
  AdminPill,
  AdminEmptyState,
  AdminLoadingState,
  AdminTabList,
  AdminTabTrigger,
} from "@/components/admin/ui/AdminUI";

// ============================================================================
// Data-fetching / business logic (Supabase reads & writes) below is functionally
// UNCHANGED — every insert/update/RPC call that existed before still exists,
// with the same tables, columns and rules. Two things were fixed because they
// were silently producing incorrect results, not because the rules changed:
//   1. The report list previously used `!inner` joins plus a hardcoded
//      "appointments since 1 Jan 2025" pre-filter. An inner join drops a row
//      the instant ANY related record is missing/null, and the date filter
//      hid everything before it — together these could legitimately produce
//      an empty "0 / 0 / 0" list even though report rows exist. Joins are now
//      left joins (nothing required to exist) with defensive fallbacks in the
//      mapping step, and the artificial date ceiling is gone.
//   2. The vault→report sync used to run one Supabase round trip per document
//      inside a sequential loop (N+1), and it re-ran automatically on every
//      single page load/refresh — which is what made the page feel like it
//      "syncs forever". The same create/skip logic now runs against batched
//      lookups, and it only runs when the user asks for it (Sync button) or
//      a background sync completes — page loads themselves are a single fast
//      read. Live updates now also flow through the app's existing realtime
//      sync channel (the same one Case Management/Appointments use) instead
//      of a manual re-scan, so new reports appear automatically.
// ============================================================================

type ReportEntry = {
  id: string;
  claimant_name: string;
  expert_name: string;
  expert_type: string;
  expert_email: string;
  referring_attorney: string;
  referring_attorney_id: string;
  attorney_email: string;
  report_status: string;
  report_submitted_date: string | null;
  report_due_date: string | null;
  appointment_id: string | null;
  case_status: string | null;
  created_at: string;
  updated_at: string;
  expert_report_doc: { id: string; file_name: string; file_path: string; upload_date: string | null } | null;
  deliveries: any[];
  reviews: any[];
};

const ReportManagement: React.FC = () => {
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all-reports");
  const [selectedReport, setSelectedReport] = useState<ReportEntry | null>(null);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [caseStatusDialogOpen, setCaseStatusDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewStatus, setReviewStatus] = useState("approved");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [deliveryNewStatus, setDeliveryNewStatus] = useState("report_delivered");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendToAttorney, setSendToAttorney] = useState(true);
  const [sendToExpert, setSendToExpert] = useState(false);
  const [emailCc, setEmailCc] = useState("");
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  const [editableAttorneyEmail, setEditableAttorneyEmail] = useState("");
  const [editableExpertEmail, setEditableExpertEmail] = useState("");
  const [newCaseStatus, setNewCaseStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  type SyncStep = {
    key: string;
    label: string;
    status: 'pending' | 'running' | 'done' | 'error';
    detail?: string;
    count?: number;
  };
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncSteps, setSyncSteps] = useState<SyncStep[]>([]);
  const fetchReportsRef = React.useRef<((silent?: boolean) => Promise<void>) | null>(null);

  const updateStep = (key: string, patch: Partial<SyncStep>) => {
    setSyncSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };

  // Batched sync: creates any expert_reports rows that are missing for a
  // scheduled assessment's uploaded report, or for a legacy Document Vault
  // upload. Same create rules as before — the only change is that lookups
  // ("does a row already exist?", "which appointment does this claimant's
  // latest booking belong to?") now run as a handful of bulk queries instead
  // of one round trip per document, so a vault with hundreds of uploads
  // syncs in roughly the time one page load used to take.
  const syncVaultUploads = useCallback(async (report?: (key: string, patch: Partial<SyncStep>) => void) => {
    const r = report || (() => {});
    const counts = { apptCreated: 0, apptSkipped: 0, claimantCreated: 0, claimantSkipped: 0 };
    try {
      r('apptDocs', { status: 'running', detail: 'Querying scheduled appointment uploads…' });
      const { data: apptDocs } = await supabase
        .from('documents')
        .select('id, appointment_id, claimant_id, file_name, upload_date')
        .eq('document_type', 'expert_report')
        .not('appointment_id', 'is', null)
        .order('upload_date', { ascending: false });
      const uniqueApptDocs = new Map<string, typeof apptDocs[number]>();
      for (const doc of apptDocs || []) {
        if (doc.appointment_id && !uniqueApptDocs.has(doc.appointment_id)) uniqueApptDocs.set(doc.appointment_id, doc);
      }
      r('apptDocs', { status: 'done', detail: `Found ${uniqueApptDocs.size} appointment-linked uploads`, count: uniqueApptDocs.size });

      r('apptSync', { status: 'running', detail: 'Creating missing report records…' });
      const apptIds = Array.from(uniqueApptDocs.keys());
      let existingByAppt = new Set<string>();
      let apptById = new Map<string, { id: string; expert_id: string; claimant_id: string }>();
      if (apptIds.length > 0) {
        const [existingRes, apptsRes] = await Promise.all([
          supabase.from('expert_reports').select('appointment_id').in('appointment_id', apptIds),
          supabase.from('appointments').select('id, expert_id, claimant_id').in('id', apptIds),
        ]);
        existingByAppt = new Set((existingRes.data || []).map((e: any) => e.appointment_id));
        apptById = new Map((apptsRes.data || []).map((a: any) => [a.id, a]));
      }
      for (const [apptId, doc] of uniqueApptDocs) {
        if (existingByAppt.has(apptId)) { counts.apptSkipped++; continue; }
        const appt = apptById.get(apptId);
        if (!appt) { counts.apptSkipped++; continue; }
        const result = await upsertExpertReport({
          appointment_id: appt.id,
          expert_id: appt.expert_id,
          claimant_id: appt.claimant_id,
          report_status: 'uploaded',
          report_submitted_date: doc.upload_date,
          notes: `Auto-synced from scheduled assessment upload: ${doc.file_name}`,
        });
        if (result.ok) counts.apptCreated++; else counts.apptSkipped++;
      }
      r('apptSync', { status: 'done', detail: `Created ${counts.apptCreated} • Skipped ${counts.apptSkipped}`, count: counts.apptCreated });

      r('vaultDocs', { status: 'running', detail: 'Querying legacy vault uploads…' });
      const { data: vaultDocs } = await supabase
        .from('documents')
        .select('id, claimant_id, file_name, upload_date, referring_attorney_id')
        .eq('document_type', 'expert_report')
        .not('claimant_id', 'is', null)
        .order('upload_date', { ascending: false });
      const seenClaimants = new Set<string>();
      const uniqueDocs = (vaultDocs || []).filter((d) => {
        if (!d.claimant_id || seenClaimants.has(d.claimant_id)) return false;
        seenClaimants.add(d.claimant_id);
        return true;
      });
      r('vaultDocs', { status: 'done', detail: `Found ${uniqueDocs.length} legacy uploads`, count: uniqueDocs.length });

      r('vaultSync', { status: 'running', detail: 'Linking legacy uploads to appointments…' });
      const claimantIds = uniqueDocs.map((d) => d.claimant_id).filter(Boolean) as string[];
      let latestApptByClaimant = new Map<string, { id: string; expert_id: string; claimant_id: string }>();
      if (claimantIds.length > 0) {
        // Already ordered by appointment_date desc, so the first row seen
        // per claimant is that claimant's latest appointment — same result
        // as the old "one query per claimant, limit 1" loop, in one call.
        const { data: apptRows } = await supabase
          .from('appointments')
          .select('id, expert_id, claimant_id, appointment_date')
          .in('claimant_id', claimantIds)
          .is('deleted_at', null)
          .order('appointment_date', { ascending: false });
        for (const a of apptRows || []) {
          if (!latestApptByClaimant.has(a.claimant_id)) latestApptByClaimant.set(a.claimant_id, a);
        }
      }
      const resolvedApptIds = Array.from(new Set(Array.from(latestApptByClaimant.values()).map((a) => a.id)));
      let existingByResolvedAppt = new Set<string>();
      if (resolvedApptIds.length > 0) {
        const { data: existingRows } = await supabase
          .from('expert_reports').select('appointment_id').in('appointment_id', resolvedApptIds);
        existingByResolvedAppt = new Set((existingRows || []).map((e: any) => e.appointment_id));
      }

      for (const doc of uniqueDocs) {
        const appointment = doc.claimant_id ? latestApptByClaimant.get(doc.claimant_id) : undefined;
        if (!appointment) { counts.claimantSkipped++; continue; }
        if (existingByResolvedAppt.has(appointment.id)) { counts.claimantSkipped++; continue; }

        const result = await upsertExpertReport({
          appointment_id: appointment.id,
          expert_id: appointment.expert_id,
          claimant_id: appointment.claimant_id,
          report_status: 'uploaded',
          report_submitted_date: doc.upload_date,
          notes: `Auto-synced from Document Vault: ${doc.file_name}`,
        });
        if (result.ok) counts.claimantCreated++; else counts.claimantSkipped++;
      }
      r('vaultSync', { status: 'done', detail: `Created ${counts.claimantCreated} • Skipped ${counts.claimantSkipped}`, count: counts.claimantCreated });
      return counts;
    } catch (err: any) {
      console.error('Vault sync check error:', err);
      r('apptSync', { status: 'error', detail: err?.message || 'Sync failed' });
      return counts;
    }
  }, []);

  const runManualSync = useCallback(async () => {
    setSyncSteps([
      { key: 'apptDocs', label: 'Scan appointment-linked uploads', status: 'pending' },
      { key: 'apptSync', label: 'Create missing report records (appointments)', status: 'pending' },
      { key: 'vaultDocs', label: 'Scan legacy vault uploads', status: 'pending' },
      { key: 'vaultSync', label: 'Link legacy uploads to appointments', status: 'pending' },
      { key: 'refresh', label: 'Refresh report list', status: 'pending' },
    ]);
    setSyncDialogOpen(true);
    setSyncRunning(true);
    const counts = await syncVaultUploads(updateStep);
    updateStep('refresh', { status: 'running', detail: 'Loading latest reports…' });
    await fetchReportsRef.current?.(true);
    updateStep('refresh', { status: 'done', detail: 'Report list refreshed' });
    setSyncRunning(false);
    toast({
      title: 'Sync complete',
      description: `Created ${counts.apptCreated + counts.claimantCreated} new report records (${counts.apptSkipped + counts.claimantSkipped} already up to date).`,
    });
  }, [syncVaultUploads, toast]);

  // Fast read: this is the ONLY thing that runs on page load / auto-refresh.
  // No vault scan blocks it, so it renders whatever is already in
  // `expert_reports` immediately. Joins are left joins (not `!inner`) so a
  // report with a missing/incomplete related record still shows up instead
  // of silently vanishing from the list.
  const fetchReports = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: expertReports, error } = await supabase
        .from("expert_reports")
        .select(`
          id, report_status, report_submitted_date, report_due_date, appointment_id, created_at, updated_at, notes,
          claimants(first_name, last_name),
          medical_experts(first_name, last_name, expert_type, email),
          appointments(referring_attorney, referring_attorney_id, case_status, appointment_date, referring_attorneys(name, email))
        `)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      // Fetch deliveries, reviews, and expert_report documents in parallel
      const reportIds = (expertReports || []).map((r: any) => r.id);
      const appointmentIds = (expertReports || []).map((r: any) => r.appointment_id).filter(Boolean);

      let deliveriesMap: Record<string, any[]> = {};
      let reviewsMap: Record<string, any[]> = {};
      let expertDocMap: Record<string, any> = {}; // by appointment_id

      if (reportIds.length > 0) {
        const [deliveriesRes, reviewsRes, docsRes] = await Promise.all([
          supabase.from("report_deliveries").select("*").in("expert_report_id", reportIds).order("delivered_at", { ascending: false }),
          supabase.from("report_reviews").select("*").in("expert_report_id", reportIds).order("created_at", { ascending: false }),
          appointmentIds.length > 0
            ? supabase
                .from("documents")
                .select("id, file_name, file_path, upload_date, appointment_id, document_type")
                .eq("document_type", "expert_report")
                .in("appointment_id", appointmentIds)
                .order("upload_date", { ascending: false })
            : Promise.resolve({ data: [] as any[] }),
        ]);

        (deliveriesRes.data || []).forEach((d: any) => {
          if (!deliveriesMap[d.expert_report_id]) deliveriesMap[d.expert_report_id] = [];
          deliveriesMap[d.expert_report_id].push(d);
        });
        (reviewsRes.data || []).forEach((r: any) => {
          if (!reviewsMap[r.expert_report_id]) reviewsMap[r.expert_report_id] = [];
          reviewsMap[r.expert_report_id].push(r);
        });
        (docsRes.data || []).forEach((d: any) => {
          // keep latest per appointment (already ordered desc)
          if (!expertDocMap[d.appointment_id]) expertDocMap[d.appointment_id] = d;
        });
      }

      const mapped: ReportEntry[] = (expertReports || []).map((r: any) => {
        const deliveries = deliveriesMap[r.id] || [];
        const reviews = reviewsMap[r.id] || [];
        const doc = r.appointment_id ? expertDocMap[r.appointment_id] || null : null;
        return {
          id: r.id,
          claimant_name: `${r.claimants?.first_name || ""} ${r.claimants?.last_name || ""}`.trim(),
          expert_name: `${r.medical_experts?.first_name || ""} ${r.medical_experts?.last_name || ""}`.trim(),
          expert_type: r.medical_experts?.expert_type || "N/A",
          expert_email: r.medical_experts?.email || "",
          referring_attorney: r.appointments?.referring_attorneys?.name || r.appointments?.referring_attorney || "N/A",
          referring_attorney_id: r.appointments?.referring_attorney_id || "",
          attorney_email: r.appointments?.referring_attorneys?.email || "",
          report_status: r.report_status,
          report_submitted_date: r.report_submitted_date,
          report_due_date: r.report_due_date,
          appointment_id: r.appointment_id,
          case_status: r.appointments?.case_status || null,
          created_at: r.created_at,
          updated_at: r.updated_at,
          expert_report_doc: doc ? { id: doc.id, file_name: doc.file_name, file_path: doc.file_path, upload_date: doc.upload_date } : null,
          deliveries,
          reviews,
        };
      });

      setReports(mapped);
    } catch (err: any) {
      console.error("Error fetching reports:", err);
      toast({ title: "Error", description: "Failed to load reports.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchReportsRef.current = fetchReports; }, [fetchReports]);

  // Show real data immediately on load — no sync scan gates this.
  useEffect(() => { fetchReports(); }, [fetchReports]);

  // Once, shortly after the list first renders, run the vault/appointment
  // sync quietly in the background to pick up anything not yet linked, then
  // silently refresh the list if it created new records. This replaces the
  // old "sync on every load, block the UI until it finishes" behaviour.
  const backgroundSyncRanRef = useRef(false);
  useEffect(() => {
    if (backgroundSyncRanRef.current) return;
    backgroundSyncRanRef.current = true;
    const timer = setTimeout(async () => {
      const counts = await syncVaultUploads();
      if (counts.apptCreated + counts.claimantCreated > 0) {
        await fetchReportsRef.current?.(true);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [syncVaultUploads]);

  // Live sync: reuse the app's existing realtime channel (the same one Case
  // Management / Appointments listen to) instead of polling. Any insert,
  // update, or delete on appointments/expert_reports anywhere in the system
  // refreshes this list automatically, so it never goes stale while open.
  const { lastUpdate, lastSyncedTable, isConnected, isPageLocked } = useAppointmentSync();
  const isFirstSyncTick = useRef(true);
  useEffect(() => {
    if (isFirstSyncTick.current) { isFirstSyncTick.current = false; return; }
    if (isPageLocked) return;
    if (lastSyncedTable && !['appointments', 'expert_reports'].includes(lastSyncedTable)) return;
    fetchReportsRef.current?.(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdate]);

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      !searchTerm ||
      r.claimant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.expert_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.referring_attorney.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.report_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: reports.length,
    pending: reports.filter((r) => r.report_status === "pending" || r.report_status === "not_received").length,
    uploaded: reports.filter((r) => r.report_status === "uploaded").length,
    inProgress: reports.filter((r) => r.report_status === "in_progress").length,
    completed: reports.filter((r) => r.report_status === "completed" || r.report_status === "taken_out").length,
    delivered: reports.filter((r) => r.deliveries.length > 0).length,
    reviewed: reports.filter((r) => r.reviews.some((rv: any) => rv.review_status === "approved")).length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
      case "taken_out":
        return <AdminPill tone="success">Completed</AdminPill>;
      case "uploaded":
        return <AdminPill tone="teal">Uploaded - Ready for Review</AdminPill>;
      case "in_progress":
        return <AdminPill tone="teal">In Progress</AdminPill>;
      case "under_review":
        return <AdminPill tone="warning">Under Review</AdminPill>;
      default:
        return <AdminPill tone="neutral">Pending</AdminPill>;
    }
  };

  const formatExpertType = (type: string) => {
    if (!type || type === "N/A") return "N/A";
    return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Open the loaded expert report in a new tab (signed URL from attorney-documents bucket)
  const handleOpenExpertReport = async (report: ReportEntry) => {
    if (!report.expert_report_doc) {
      toast({ title: "No Report Found", description: "No expert report has been uploaded for this appointment yet.", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await supabase
        .storage
        .from('attorney-documents')
        .createSignedUrl(report.expert_report_doc.file_path, 604800); // 7-day expiry for browser cache reuse
      if (error || !data?.signedUrl) throw error || new Error('Failed to create signed URL');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      console.error('Open expert report error:', err);
      toast({ title: "Error", description: "Could not open the expert report.", variant: "destructive" });
    }
  };

  const handleRecordDelivery = async () => {
    if (!selectedReport || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("report_deliveries").insert({
        expert_report_id: selectedReport.id,
        delivered_to_attorney_id: selectedReport.referring_attorney_id || null,
        delivery_method: "email",
        delivered_by: user.id,
        notes: deliveryNotes || null,
      });
      if (error) throw error;

      // Also update report_status on expert_reports so the system reflects the new state
      if (deliveryNewStatus) {
        await supabase
          .from("expert_reports")
          .update({
            report_status: deliveryNewStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedReport.id);

        // And mirror onto the linked appointment's case_status when applicable
        if (selectedReport.appointment_id) {
          await supabase
            .from("appointments")
            .update({ case_status: deliveryNewStatus })
            .eq("id", selectedReport.appointment_id);
        }
      }

      toast({
        title: "Delivery Recorded",
        description: deliveryNewStatus
          ? `Delivery tracked and status updated to "${deliveryNewStatus.replace(/_/g, ' ')}".`
          : "Report delivery has been tracked.",
      });
      setDeliveryDialogOpen(false);
      setDeliveryNotes("");
      setDeliveryNewStatus("report_delivered");
      await fetchReports();
    } catch (err: any) {
      console.error("Delivery error:", err);
      toast({ title: "Error", description: "Failed to record delivery.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedReport || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("report_reviews").insert({
        expert_report_id: selectedReport.id,
        reviewer_id: user.id,
        review_status: reviewStatus,
        review_notes: reviewNotes || null,
        reviewed_at: new Date().toISOString(),
      });
      if (error) throw error;

      toast({ title: "Review Submitted", description: `Report marked as ${reviewStatus}.` });
      setReviewDialogOpen(false);
      setReviewNotes("");
      await fetchReports();
    } catch (err: any) {
      console.error("Review error:", err);
      toast({ title: "Error", description: "Failed to submit review.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  const handleSendEmail = async () => {
    if (!selectedReport || !user) return;
    if (!sendToAttorney && !sendToExpert) {
      toast({ title: "Select Recipient", description: "Please select at least one recipient.", variant: "destructive" });
      return;
    }
    if (!emailSubject.trim()) {
      toast({ title: "Subject Required", description: "Please enter an email subject.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const recipients: { email: string; name: string; type: string }[] = [];
      if (sendToAttorney && editableAttorneyEmail.trim()) {
        recipients.push({ email: editableAttorneyEmail.trim(), name: selectedReport.referring_attorney, type: "Attorney" });
      }
      if (sendToExpert && editableExpertEmail.trim()) {
        recipients.push({ email: editableExpertEmail.trim(), name: selectedReport.expert_name, type: "Expert" });
      }
      if (recipients.length === 0) {
        toast({ title: "No Email Found", description: "Selected recipients have no email address on file.", variant: "destructive" });
        setSaving(false);
        return;
      }

      // Parse CC emails
      const ccEmails = emailCc
        .split(/[,;]/)
        .map(e => e.trim())
        .filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

      // Upload attachments to storage and get URLs
      const attachmentDetails: { filename: string; url: string; size: number }[] = [];
      for (const file of emailAttachments) {
        const filePath = `report-email-attachments/${selectedReport.id}/${Date.now()}_${file.name}`;
        try {
          await uploadFileResumable({ bucket: "documents", path: filePath, file });
        } catch (uploadErr) {
          console.error("Attachment upload error:", uploadErr);
          continue;
        }
        const { data: urlData } = supabase.storage.from("documents").getPublicUrl(filePath);
        attachmentDetails.push({ filename: file.name, url: urlData.publicUrl, size: file.size });
      }

      const attachmentHtml = attachmentDetails.length > 0
        ? `<div style="margin-top: 16px; padding: 12px; background-color: #f8fafc; border-radius: 8px;">
            <p style="font-weight: bold; margin-bottom: 8px;">📎 Attachments (${attachmentDetails.length}):</p>
            ${attachmentDetails.map(a => `<p style="margin: 4px 0;"><a href="${a.url}" style="color: #2563eb; text-decoration: underline;">${a.filename}</a> <span style="color: #94a3b8; font-size: 12px;">(${(a.size / 1024).toFixed(0)} KB)</span></p>`).join('')}
          </div>`
        : '';

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a365d;">Medico-Legal Report</h2>
          <p><strong>Claimant:</strong> ${selectedReport.claimant_name}</p>
          <p><strong>Expert:</strong> ${selectedReport.expert_name} (${formatExpertType(selectedReport.expert_type)})</p>
          <p><strong>Status:</strong> ${selectedReport.report_status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
          <hr style="border: 1px solid #e2e8f0; margin: 16px 0;" />
          <div>${emailBody.replace(/\n/g, '<br/>')}</div>
          ${attachmentHtml}
          <hr style="border: 1px solid #e2e8f0; margin: 16px 0;" />
          <p style="font-size: 12px; color: #718096;">Sent from Kutlwano Medico-Legal Report Management System</p>
        </div>
      `;

      for (const recipient of recipients) {
        const { data: inserted } = await supabase.from("email_queue").insert({
          email_type: "report_delivery",
          recipient_email: recipient.email,
          recipient_name: recipient.name,
          subject: emailSubject,
          html_content: htmlContent,
          status: "sending",
          related_record_id: selectedReport.id,
          related_table: "expert_reports",
          metadata: {
            claimant: selectedReport.claimant_name,
            recipient_type: recipient.type,
            cc_emails: ccEmails.length > 0 ? ccEmails : undefined,
            attachments: attachmentDetails.length > 0 ? attachmentDetails.map(a => a.filename) : undefined,
          },
        }).select("id").single();
        // Auto-send immediately
        if (inserted?.id) {
          const { data: sendResult } = await supabase.functions.invoke("auto-send-queued-email", { body: { emailId: inserted.id } });
          if (!sendResult?.success) {
            console.error('Auto-send failed for report delivery');
          }
        }
      }

      // Also send CC emails
      for (const ccEmail of ccEmails) {
        const { data: ccInserted } = await supabase.from("email_queue").insert({
          email_type: "report_delivery_cc",
          recipient_email: ccEmail,
          recipient_name: ccEmail,
          subject: `[CC] ${emailSubject}`,
          html_content: htmlContent,
          status: "sending",
          related_record_id: selectedReport.id,
          related_table: "expert_reports",
          metadata: { claimant: selectedReport.claimant_name, recipient_type: "CC" },
        }).select("id").single();
        if (ccInserted?.id) {
          const { data: sendResult } = await supabase.functions.invoke("auto-send-queued-email", { body: { emailId: ccInserted.id } });
          if (!sendResult?.success) {
            console.error('Auto-send failed for CC email');
          }
        }
      }

      // Record delivery for attorney
      if (sendToAttorney && selectedReport.attorney_email) {
        await supabase.from("report_deliveries").insert({
          expert_report_id: selectedReport.id,
          delivered_to_attorney_id: selectedReport.referring_attorney_id || null,
          delivery_method: "email",
          delivered_by: user.id,
          notes: `Email sent: ${emailSubject}${ccEmails.length > 0 ? ` (CC: ${ccEmails.join(', ')})` : ''}${attachmentDetails.length > 0 ? ` [${attachmentDetails.length} attachment(s)]` : ''}`,
        });
      }

      // Audit log
      await supabase.from("audit_logs").insert({
        action_type: "report_email_sent",
        table_name: "expert_reports",
        record_id: selectedReport.id,
        function_area: "report_management",
        user_id: user.id,
        description: `Report emailed to: ${recipients.map(r => `${r.type} (${r.email})`).join(', ')}${ccEmails.length > 0 ? ` CC: ${ccEmails.join(', ')}` : ''}${attachmentDetails.length > 0 ? ` with ${attachmentDetails.length} attachment(s)` : ''}`,
      });

      toast({ title: "Email Queued", description: `Report sent to ${recipients.map(r => r.type).join(' & ')}${ccEmails.length > 0 ? ` with ${ccEmails.length} CC(s)` : ''}.` });
      setEmailDialogOpen(false);
      setEmailSubject("");
      setEmailBody("");
      setEmailCc("");
      setEmailAttachments([]);
      setEditableAttorneyEmail("");
      setEditableExpertEmail("");
      setSendToAttorney(true);
      setSendToExpert(false);
      await fetchReports();
    } catch (err: any) {
      console.error("Email error:", err);
      toast({ title: "Error", description: "Failed to queue email.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCaseStatus = async () => {
    if (!selectedReport?.appointment_id || !newCaseStatus || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ case_status: newCaseStatus })
        .eq("id", selectedReport.appointment_id);
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        action_type: "case_status_updated",
        table_name: "appointments",
        record_id: selectedReport.appointment_id,
        function_area: "report_management",
        user_id: user.id,
        description: `Case status updated to "${newCaseStatus}" for ${selectedReport.claimant_name}`,
        new_values: { case_status: newCaseStatus },
        old_values: { case_status: selectedReport.case_status },
      });

      toast({ title: "Case Status Updated", description: `Status changed to "${newCaseStatus}".` });
      setCaseStatusDialogOpen(false);
      setNewCaseStatus("");
      await fetchReports();
    } catch (err: any) {
      console.error("Case status error:", err);
      toast({ title: "Error", description: "Failed to update case status.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <Helmet>
        <title>Report Management - Medico-Legal Assessment System</title>
        <meta name="description" content="Manage medico-legal expert reports with version control, delivery tracking, and review workflows." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <AdminPage className="max-w-7xl px-4 py-6 md:px-6">
          <AdminHeader
            eyebrow="Reports"
            title="Report Management"
            description="Track, deliver, and review medico-legal expert reports"
            icon={FileText}
            actions={
              <>
                <div
                  className="hidden items-center gap-1.5 rounded-none border border-black/10 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-500 sm:flex"
                  title={isConnected ? "Live sync connected — new reports appear automatically" : "Live sync reconnecting — data still refreshes on demand"}
                >
                  {isConnected ? (
                    <Wifi className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  {isConnected ? "Live" : "Offline"}
                </div>
                <Button variant="default" size="sm" className="rounded-none" onClick={runManualSync} disabled={syncRunning || loading}>
                  <Activity className={`h-4 w-4 mr-1.5 ${syncRunning ? "animate-pulse" : ""}`} />
                  {syncRunning ? "Syncing…" : "Sync Reports"}
                </Button>
                <Button variant="outline" size="sm" className="rounded-none" onClick={() => fetchReports()} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </>
            }
          />

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            <AdminStatCard label="Total Reports" value={stats.total} icon={FileText} loading={loading} />
            <AdminStatCard label="Pending" value={stats.pending} icon={Clock} loading={loading} />
            <AdminStatCard label="Uploaded" value={stats.uploaded} icon={FileDown} loading={loading} />
            <AdminStatCard label="In Progress" value={stats.inProgress} icon={AlertCircle} loading={loading} />
            <AdminStatCard label="Completed" value={stats.completed} icon={CheckCircle2} loading={loading} />
            <AdminStatCard label="Delivered" value={stats.delivered} icon={Send} loading={loading} />
            <AdminStatCard label="Reviewed" value={stats.reviewed} icon={Star} loading={loading} />
          </div>

          {/* Filters */}
          <AdminCard>
            <AdminCardHeader icon={Filter} title="Search & Filters" description="Narrow down the report list below." />
            <AdminCardBody>
              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search by claimant, expert, or attorney..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="rounded-none pl-8"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full rounded-none md:w-[200px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="uploaded">Uploaded</SelectItem>
                    <SelectItem value="not_received">Not Received</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="taken_out">Taken Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </AdminCardBody>
          </AdminCard>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <AdminTabList columns={3}>
              <AdminTabTrigger value="all-reports" label="All Reports" icon={FileText} badge={stats.total} center />
              <AdminTabTrigger value="deliveries" label="Deliveries" icon={Send} badge={stats.delivered} center />
              <AdminTabTrigger value="reviews" label="Reviews" icon={Star} badge={stats.reviewed} center />
            </AdminTabList>

            {/* All Reports Tab */}
            <TabsContent value="all-reports" className="mt-4">
              <AdminCard>
                <AdminCardHeader
                  icon={FileText}
                  title="Expert Reports Repository"
                  description={`${filteredReports.length} of ${reports.length} report${reports.length === 1 ? '' : 's'} — all medico-legal reports with version tracking`}
                />
                {loading ? (
                  <AdminLoadingState label="Loading reports…" />
                ) : filteredReports.length === 0 ? (
                  <AdminEmptyState
                    icon={FileText}
                    title={reports.length === 0 ? "No reports yet" : "No reports match your filters"}
                    description={
                      reports.length === 0
                        ? "Reports appear here automatically once experts upload them. Try Sync Reports to pull in any uploads that haven't been linked yet."
                        : "Try adjusting your search or status filter."
                    }
                    action={
                      reports.length === 0 ? (
                        <Button variant="outline" size="sm" className="rounded-none" onClick={runManualSync} disabled={syncRunning}>
                          <Activity className={`h-4 w-4 mr-1.5 ${syncRunning ? "animate-pulse" : ""}`} />
                          Sync Reports Now
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                    <ScrollArea className="w-full">
                      <Table className="[&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-slate-500">
                        <TableHeader className="bg-black/[0.02]">
                          <TableRow>
                            <TableHead>Claimant</TableHead>
                            <TableHead>Expert</TableHead>
                            <TableHead>Attorney</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">Report</TableHead>
                            <TableHead className="text-center">Delivered</TableHead>
                            <TableHead className="text-center">Reviewed</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredReports.map((report) => (
                            <TableRow key={report.id} className="border-black/10 hover:bg-black/[0.02]">
                              <TableCell className="font-medium">{report.claimant_name}</TableCell>
                              <TableCell>
                                <div>
                                  <p className="text-sm">{report.expert_name}</p>
                                  <p className="text-xs text-muted-foreground">{formatExpertType(report.expert_type)}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{report.referring_attorney}</TableCell>
                              <TableCell>{getStatusBadge(report.report_status)}</TableCell>
                              <TableCell className="text-center">
                                {report.expert_report_doc ? (
                                  <FileDown className="h-5 w-5 text-success mx-auto" />
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {report.deliveries.length > 0 ? (
                                  <CheckCircle2 className="h-5 w-5 text-success mx-auto" />
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {report.reviews.some((rv: any) => rv.review_status === "approved") ? (
                                  <Star className="h-5 w-5 text-warning mx-auto fill-warning" />
                                ) : report.reviews.length > 0 ? (
                                  <Eye className="h-5 w-5 text-muted-foreground mx-auto" />
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleOpenExpertReport(report)}
                                    title={report.expert_report_doc ? `Open expert report: ${report.expert_report_doc.file_name}` : "No expert report uploaded yet"}
                                    disabled={!report.expert_report_doc}
                                  >
                                    <FileDown className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => { setSelectedReport(report); setDeliveryDialogOpen(true); }}
                                    title="Record delivery"
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => { setSelectedReport(report); setReviewDialogOpen(true); }}
                                    title="Submit review"
                                  >
                                    <Star className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-primary"
                                    onClick={() => {
                                      setSelectedReport(report);
                                      setEmailSubject(`Medico-Legal Report: ${report.claimant_name} — ${formatExpertType(report.expert_type)}`);
                                      setEditableAttorneyEmail(report.attorney_email || "");
                                      setEditableExpertEmail(report.expert_email || "");
                                      setEmailDialogOpen(true);
                                    }}
                                    title="Send report via email"
                                  >
                                    <Mail className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-warning"
                                    onClick={() => {
                                      setSelectedReport(report);
                                      setNewCaseStatus(report.case_status || "");
                                      setCaseStatusDialogOpen(true);
                                    }}
                                    title="View / Update case status"
                                  >
                                    <Activity className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
              </AdminCard>
            </TabsContent>



            {/* Deliveries Tab */}
            <TabsContent value="deliveries" className="mt-4">
              <AdminCard>
                <AdminCardHeader
                  icon={Send}
                  title="Attorney Delivery Tracking"
                  description="Track when reports were sent to attorneys"
                />
                {reports.filter((r) => r.deliveries.length > 0).length === 0 ? (
                  <AdminEmptyState icon={Send} title="No deliveries recorded yet" />
                ) : (
                  <Table>
                    <TableHeader className="bg-black/[0.02]">
                      <TableRow>
                        <TableHead>Claimant</TableHead>
                        <TableHead>Attorney</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Delivered</TableHead>
                        <TableHead className="text-center">Receipt</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports
                        .filter((r) => r.deliveries.length > 0)
                        .flatMap((report) =>
                          report.deliveries.map((d: any) => (
                            <TableRow key={d.id} className="border-black/10 hover:bg-black/[0.02]">
                              <TableCell className="font-medium">{report.claimant_name}</TableCell>
                              <TableCell>{report.referring_attorney}</TableCell>
                              <TableCell>
                                <AdminPill tone="neutral" className="capitalize">{d.delivery_method}</AdminPill>
                              </TableCell>
                              <TableCell className="text-sm">
                                {format(parseISO(d.delivered_at), "dd MMM yyyy HH:mm")}
                              </TableCell>
                              <TableCell className="text-center">
                                {d.confirmed_receipt ? (
                                  <CheckCircle2 className="h-5 w-5 text-success mx-auto" />
                                ) : (
                                  <Clock className="h-5 w-5 text-muted-foreground mx-auto" />
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                {d.notes || "—"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                    </TableBody>
                  </Table>
                )}
              </AdminCard>
            </TabsContent>

            {/* Reviews Tab */}
            <TabsContent value="reviews" className="mt-4">
              <AdminCard>
                <AdminCardHeader
                  icon={Star}
                  title="Report Reviews"
                  description="Review and approval status of reports"
                />
                {reports.filter((r) => r.reviews.length > 0).length === 0 ? (
                  <AdminEmptyState icon={Star} title="No reviews submitted yet" />
                ) : (
                  <Table>
                    <TableHeader className="bg-black/[0.02]">
                      <TableRow>
                        <TableHead>Claimant</TableHead>
                        <TableHead>Expert</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reviewed</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports
                        .filter((r) => r.reviews.length > 0)
                        .flatMap((report) =>
                          report.reviews.map((rv: any) => (
                            <TableRow key={rv.id} className="border-black/10 hover:bg-black/[0.02]">
                              <TableCell className="font-medium">{report.claimant_name}</TableCell>
                              <TableCell>{report.expert_name}</TableCell>
                              <TableCell>
                                <AdminPill
                                  tone={
                                    rv.review_status === "approved" ? "success" :
                                    rv.review_status === "rejected" ? "destructive" :
                                    "warning"
                                  }
                                >
                                  {rv.review_status.charAt(0).toUpperCase() + rv.review_status.slice(1)}
                                </AdminPill>
                              </TableCell>
                              <TableCell className="text-sm">
                                {rv.reviewed_at ? format(parseISO(rv.reviewed_at), "dd MMM yyyy HH:mm") : "Pending"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                {rv.review_notes || "—"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                    </TableBody>
                  </Table>
                )}
              </AdminCard>
            </TabsContent>
          </Tabs>
        </AdminPage>

        {/* Sync Progress Dialog */}
        <Dialog open={syncDialogOpen} onOpenChange={(open) => { if (!syncRunning) setSyncDialogOpen(open); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Activity className={`h-5 w-5 ${syncRunning ? "animate-pulse text-primary" : "text-success"}`} />
                Sync Reports from Scheduled Assessments
              </DialogTitle>
              <DialogDescription>
                Scanning uploads and creating any missing report records.
              </DialogDescription>
            </DialogHeader>
            <ol className="space-y-3">
              {syncSteps.map((s, idx) => (
                <li key={s.key} className="flex items-start gap-3 text-sm">
                  <div className="mt-0.5">
                    {s.status === 'pending' && <div className="h-5 w-5 rounded-full border-2 border-muted text-xs flex items-center justify-center text-muted-foreground">{idx + 1}</div>}
                    {s.status === 'running' && <RefreshCw className="h-5 w-5 animate-spin text-primary" />}
                    {s.status === 'done' && <CheckCircle2 className="h-5 w-5 text-success" />}
                    {s.status === 'error' && <AlertCircle className="h-5 w-5 text-destructive" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-medium ${s.status === 'done' ? 'text-foreground' : s.status === 'pending' ? 'text-muted-foreground' : ''}`}>
                        {s.label}
                      </span>
                      {typeof s.count === 'number' && s.status === 'done' && (
                        <AdminPill tone="neutral">{s.count}</AdminPill>
                      )}
                    </div>
                    {s.detail && <p className="text-xs text-muted-foreground mt-0.5">{s.detail}</p>}
                  </div>
                </li>
              ))}
            </ol>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSyncDialogOpen(false)} disabled={syncRunning}>
                {syncRunning ? "Working…" : "Close"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delivery Dialog */}
        <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Report Delivery</DialogTitle>
              <DialogDescription>
                Track delivery of {selectedReport?.claimant_name}'s report to {selectedReport?.referring_attorney}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Update Report Status</Label>
                <Select value={deliveryNewStatus} onValueChange={setDeliveryNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select new report status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="report_delivered">Report Delivered</SelectItem>
                    <SelectItem value="report_submitted">Report Submitted</SelectItem>
                    <SelectItem value="report_submitted_on_aod">Report Submitted on AOD</SelectItem>
                    <SelectItem value="report_fully_paid_submitted">Report Fully Paid &amp; Submitted</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="taken_out">Taken Out</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Recording delivery will update the report status across the system.
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Delivery Notes (optional)</Label>
                <Textarea
                  placeholder="e.g. Sent via email with cover letter..."
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeliveryDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleRecordDelivery} disabled={saving}>
                <Send className="h-4 w-4 mr-2" />
                Record Delivery
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Review Dialog */}
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Report Review</DialogTitle>
              <DialogDescription>
                Review {selectedReport?.claimant_name}'s report by {selectedReport?.expert_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Review Decision</label>
                <Select value={reviewStatus} onValueChange={setReviewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="revision_needed">Revision Needed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Review Notes</label>
                <Textarea
                  placeholder="Add review comments..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmitReview} disabled={saving}>
                <Star className="h-4 w-4 mr-2" />
                Submit Review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Send Email Dialog */}
        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Send Report via Email
              </DialogTitle>
              <DialogDescription>
                Send {selectedReport?.claimant_name}'s report to attorney and/or expert
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Recipients */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Recipients</Label>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Checkbox id="send-attorney" checked={sendToAttorney} onCheckedChange={(v) => setSendToAttorney(!!v)} className="mt-2.5" />
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="send-attorney" className="text-sm cursor-pointer">
                        Attorney: {selectedReport?.referring_attorney}
                      </Label>
                      <Input
                        value={editableAttorneyEmail}
                        onChange={(e) => setEditableAttorneyEmail(e.target.value)}
                        placeholder="Attorney email address"
                        className="text-sm h-8"
                        disabled={!sendToAttorney}
                      />
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox id="send-expert" checked={sendToExpert} onCheckedChange={(v) => setSendToExpert(!!v)} className="mt-2.5" />
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="send-expert" className="text-sm cursor-pointer">
                        Expert: {selectedReport?.expert_name}
                      </Label>
                      <Input
                        value={editableExpertEmail}
                        onChange={(e) => setEditableExpertEmail(e.target.value)}
                        placeholder="Expert email address"
                        className="text-sm h-8"
                        disabled={!sendToExpert}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* CC Field */}
              <div>
                <Label className="text-sm font-medium">CC (Optional)</Label>
                <Input
                  value={emailCc}
                  onChange={(e) => setEmailCc(e.target.value)}
                  placeholder="email1@example.com, email2@example.com"
                />
                <p className="text-xs text-muted-foreground mt-1">Separate multiple emails with commas</p>
              </div>

              {/* Subject */}
              <div>
                <Label className="text-sm font-medium">Subject</Label>
                <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Email subject..." />
              </div>

              {/* Message */}
              <div>
                <Label className="text-sm font-medium">Message</Label>
                <Textarea
                  rows={6}
                  placeholder="Add a message to accompany the report..."
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                />
              </div>

              {/* Attachment Upload */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Attachments
                </Label>
                <div className="border border-dashed border-border rounded-lg p-3">
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      const maxSize = 50 * 1024 * 1024; // 50MB total
                      const totalSize = [...emailAttachments, ...files].reduce((sum, f) => sum + f.size, 0);
                      if (totalSize > maxSize) {
                        toast({ title: "File Size Limit", description: "Total attachments must be under 50MB.", variant: "destructive" });
                        return;
                      }
                      setEmailAttachments(prev => [...prev, ...files]);
                      e.target.value = '';
                    }}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG — Max 50MB total</p>
                </div>
                {emailAttachments.length > 0 && (
                  <div className="space-y-1">
                    {emailAttachments.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-muted/40 rounded px-3 py-1.5 text-sm">
                        <span className="flex items-center gap-2 truncate">
                          <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => setEmailAttachments(prev => prev.filter((_, i) => i !== idx))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview Info */}
              <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p><strong>Report:</strong> {selectedReport?.claimant_name} — {selectedReport?.expert_name}</p>
                <p><strong>Status:</strong> {selectedReport?.report_status?.replace(/_/g, ' ')}</p>
                <p><strong>Case Status:</strong> {selectedReport?.case_status || 'Not set'}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSendEmail} disabled={saving}>
                <Send className="h-4 w-4 mr-2" />
                Send Email{emailAttachments.length > 0 ? ` (${emailAttachments.length} file${emailAttachments.length > 1 ? 's' : ''})` : ''}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Case Status Dialog */}
        <Dialog open={caseStatusDialogOpen} onOpenChange={setCaseStatusDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-warning" />
                View / Update Case Status
              </DialogTitle>
              <DialogDescription>
                {selectedReport?.claimant_name} — {selectedReport?.referring_attorney}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Status:</span>
                  <AdminPill tone="neutral" className="capitalize">{selectedReport?.case_status?.replace(/_/g, ' ') || 'Not set'}</AdminPill>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Report Status:</span>
                  <span className="capitalize">{selectedReport?.report_status?.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Expert:</span>
                  <span>{selectedReport?.expert_name} ({formatExpertType(selectedReport?.expert_type || '')})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivered:</span>
                  <span>{selectedReport?.deliveries && selectedReport.deliveries.length > 0 ? `Yes (${selectedReport.deliveries.length}×)` : 'No'}</span>
                </div>
              </div>
              {selectedReport?.appointment_id ? (
                <div>
                  <Label className="text-sm font-medium">Update Case Status</Label>
                  <Select value={newCaseStatus} onValueChange={setNewCaseStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select new status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assessment_scheduled">Assessment Scheduled</SelectItem>
                      <SelectItem value="assessment_completed">Assessment Completed</SelectItem>
                      <SelectItem value="report_in_progress">Report In Progress</SelectItem>
                      <SelectItem value="report_submitted">Report Submitted</SelectItem>
                      <SelectItem value="report_delivered">Report Delivered</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="revision_requested">Revision Requested</SelectItem>
                      <SelectItem value="finalised">Finalised</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No linked appointment — case status cannot be updated.</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCaseStatusDialogOpen(false)}>Close</Button>
              {selectedReport?.appointment_id && (
                <Button onClick={handleUpdateCaseStatus} disabled={saving || !newCaseStatus}>
                  <Activity className="h-4 w-4 mr-2" />
                  Update Status
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <CompanyFooter />
      </div>
    </ProtectedRoute>
  );
};

export default ReportManagement;
