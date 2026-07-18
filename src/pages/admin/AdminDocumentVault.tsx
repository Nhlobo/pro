import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import {
  FolderLock, FileText, Shield, Eye, Upload, Lock, Download, Search, RefreshCw,
  CheckCircle2, XCircle, Clock, Filter, Trash2, EyeOff, ExternalLink, ShieldCheck,
  Users, Scale, Stethoscope,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { uploadFileResumable } from '@/lib/resumableUpload';
import { upsertExpertReport } from '@/utils/expertReports';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
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
  AdminSectionLabel,
} from '@/components/admin/ui/AdminUI';

// ============================================================================
// Business logic, data shapes, and Supabase access below are UNCHANGED from
// the previous implementation. Only the presentational layer (the JSX in the
// returned markup, plus small pure display helpers like getStatusBadge/
// getAccessBadge) was redesigned to match the shared Admin Portal UI system
// used across Finance, Expert Payment Planner, Appointment Engine, Email, and
// System Control.
// ============================================================================

// Document types by role
// Storage buckets to try when accessing files (order matters — most common first)
const STORAGE_BUCKETS = ['attorney-documents', 'documents', 'expert-documents', 'aod-documents', 'case-management-reports'];

const ATTORNEY_UPLOAD_TYPES = [
  'Medical Records',
  'Instruction Letter',
  'Summons',
  'ID Copy',
  'RAF1 Form',
  'RAF4 Form',
  'Police Report',
  'Hospital Records',
  'Supporting Document',
  'Other',
];

const ADMIN_UPLOAD_TYPES = [
  ...ATTORNEY_UPLOAD_TYPES,
  'Expert Report',
  'Expert AOD Agreement',
  'Expert CV',
  'Expert Qualifications',
  'Expert HPCSA Certificate',
  'Assessment Notes',
  'Internal Memo',
  'Legal Document',
  'Statement',
  'Invoice',
  'Court Order',
  'Correspondence',
];

// Map old DB document_type values to display labels
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  'instruction_letter': 'Instruction Letter',
  'claimant_id_copy': 'ID Copy',
  'medical_records': 'Medical Records',
  'xray': 'X-Ray',
  'medico_report': 'Expert Report',
  'expert_report_sent': 'Expert Report (Sent)',
  'Supporting Document': 'Supporting Document',
};

const getDocTypeLabel = (type: string) => DOCUMENT_TYPE_LABELS[type] || type;

// Determine document source from file_path
const getDocumentSource = (doc: DocumentRecord): string => {
  if (doc.file_path?.startsWith('vault/')) return 'Manual Upload';
  if (doc.file_path?.startsWith('documents/')) return 'Attorney Upload';
  if (doc.file_path?.startsWith('expert/') || doc.document_type === 'expert_report_sent') return 'Expert';
  if (doc.file_path?.startsWith('reports/')) return 'System Report';
  return 'System';
};

const ACCESS_LEVELS = [
  { value: 'public', label: 'Public', desc: 'Visible to all' },
  { value: 'internal', label: 'Internal', desc: 'Admin & Employees only' },
  { value: 'restricted', label: 'Restricted', desc: 'Admin only' },
  { value: 'confidential', label: 'Confidential', desc: 'Restricted + hidden from attorneys' },
];

interface DocumentRecord {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string;
  upload_date: string;
  upload_time: string;
  notes: string | null;
  claimant_id: string | null;
  referring_attorney_id: string | null;
  expert_id: string | null;
  appointment_id: string | null;
  approval_status: string;
  access_level: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  is_visible_to_attorney: boolean;
  is_visible_to_expert: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  claimant_name?: string;
  attorney_name?: string;
  expert_name?: string;
  expert_type?: string;
  expert_specializations?: string[];
}

const AdminDocumentVault: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expertFilter, setExpertFilter] = useState('all');
  const [expertTypeFilter, setExpertTypeFilter] = useState('all');
  const [expertTypes, setExpertTypes] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('all');

  // Upload state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState('');
  const [uploadAccessLevel, setUploadAccessLevel] = useState('internal');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadClaimantId, setUploadClaimantId] = useState('');
  const [uploadAttorneyId, setUploadAttorneyId] = useState('');
  const [uploadExpertId, setUploadExpertId] = useState('');
  const [uploadAppointmentId] = useState(''); // Auto-detected, not user-selected
  const [uploadVisibleAttorney, setUploadVisibleAttorney] = useState(true);
  const [uploadVisibleExpert, setUploadVisibleExpert] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Review state
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'declined'>('approved');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // Preview state (sliding panel, not a popup dialog)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Desktop table: a slim scrollbar pinned above the table, mirrored with the
  // table's own horizontal scroll, so staff can reach the Actions/eye column
  // by scrolling sideways right away instead of scrolling all the way down
  // to the bottom scrollbar first.
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const isSyncingScroll = useRef(false);

  const syncScrollFromTop = () => {
    if (isSyncingScroll.current) return;
    if (!topScrollRef.current || !tableScrollRef.current) return;
    isSyncingScroll.current = true;
    tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    isSyncingScroll.current = false;
  };
  const syncScrollFromTable = () => {
    if (isSyncingScroll.current) return;
    if (!topScrollRef.current || !tableScrollRef.current) return;
    isSyncingScroll.current = true;
    topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    isSyncingScroll.current = false;
  };

  // Dropdowns
  const [claimants, setClaimants] = useState<{ id: string; name: string; auto_id: string }[]>([]);
  const [attorneys, setAttorneys] = useState<{ id: string; name: string }[]>([]);
  const [experts, setExperts] = useState<{ id: string; name: string }[]>([]);
  const [appointments, setAppointments] = useState<{ id: string; label: string; expert_id: string; claimant_id: string; referring_attorney_id: string }[]>([]);

  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, userRole } = usePermissions();
  const isAdminOrEmployee = userRole === 'admin' || userRole === 'employee';
  const isAttorney = userRole === 'referring_attorney';
  const isExpert = userRole === 'expert';
  const [currentExpertId, setCurrentExpertId] = useState<string | null>(null);

  // Fetch expert_id for expert users
  useEffect(() => {
    const loadExpertId = async () => {
      if (!isExpert || !user) return;
      const { data } = await supabase.from('profiles').select('expert_id').eq('id', user.id).single();
      if (data?.expert_id) setCurrentExpertId(data.expert_id);
    };
    loadExpertId();
  }, [isExpert, user]);

  // Helper: try to access a file across multiple storage buckets
  const resolveStorageBucket = async (filePath: string): Promise<string> => {
    for (const bucket of STORAGE_BUCKETS) {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(filePath, 10);
      if (data?.signedUrl) return bucket;
    }
    throw new Error(`File not found in any storage bucket: ${filePath}`);
  };

  const createSignedUrl = async (filePath: string, expiresIn: number = 604800): Promise<string> => {
    for (const bucket of STORAGE_BUCKETS) {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, expiresIn);
      if (data?.signedUrl) return data.signedUrl;
    }
    throw new Error(`File not found in any storage bucket: ${filePath}`);
  };

  const downloadFromBuckets = async (filePath: string): Promise<Blob> => {
    for (const bucket of STORAGE_BUCKETS) {
      const { data, error } = await supabase.storage.from(bucket).download(filePath);
      if (data) return data;
    }
    throw new Error(`File not found in any storage bucket: ${filePath}`);
  };

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('documents')
        .select(`
          *,
          claimants(first_name, last_name, auto_id),
          referring_attorneys:referring_attorney_id(name),
          medical_experts:expert_id(first_name, last_name, expert_type, specializations)
        `)
        .order('created_at', { ascending: false })
        .gte('created_at', '2025-01-01T00:00:00');

      // Attorneys: only see docs marked visible to attorney
      if (isAttorney) {
        query = query.eq('is_visible_to_attorney', true);
      }

      // Experts: only see docs visible to expert AND linked to their appointments
      if (isExpert && currentExpertId) {
        query = query.eq('is_visible_to_expert', true).eq('expert_id', currentExpertId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped: DocumentRecord[] = (data || []).map((d: any) => ({
        ...d,
        claimant_name: d.claimants ? `${d.claimants.first_name} ${d.claimants.last_name}` : '',
        attorney_name: d.referring_attorneys?.name || '',
        expert_name: d.medical_experts ? `${d.medical_experts.first_name} ${d.medical_experts.last_name}` : '',
        expert_type: d.medical_experts?.expert_type || '',
        expert_specializations: d.medical_experts?.specializations || [],
      }));

      setDocuments(mapped);
    } catch (err: any) {
      console.error('Error fetching documents:', err);
      toast({ title: 'Error', description: 'Failed to load documents.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, isAttorney, isExpert, currentExpertId]);

  const fetchDropdowns = useCallback(async () => {
    const [claimantsRes, attorneysRes, expertsRes, appointmentsRes, expertTypesRes] = await Promise.all([
      supabase.from('claimants').select('id, first_name, last_name, auto_id').order('first_name'),
      supabase.from('referring_attorneys').select('id, name').order('name'),
      supabase.from('medical_experts').select('id, first_name, last_name').eq('status', 'active').order('first_name'),
      supabase.from('appointments').select('id, appointment_date, expert_id, claimant_id, referring_attorney_id, claimants(first_name, last_name, auto_id), medical_experts!inner(first_name, last_name)').is('deleted_at', null).order('appointment_date', { ascending: false }).limit(200),
      supabase.from('medical_experts').select('expert_type').not('expert_type', 'is', null),
    ]);
    if (claimantsRes.data) {
      setClaimants(claimantsRes.data.map(c => ({ id: c.id, name: `${c.first_name} ${c.last_name}`, auto_id: c.auto_id })));
    }
    if (attorneysRes.data) {
      setAttorneys(attorneysRes.data.map(a => ({ id: a.id, name: a.name })));
    }
    if (expertsRes.data) {
      setExperts(expertsRes.data.map(e => ({ id: e.id, name: `${e.first_name} ${e.last_name}` })));
    }
    if (appointmentsRes.data) {
      setAppointments((appointmentsRes.data as any[]).map(a => ({
        id: a.id,
        label: `${a.claimants?.first_name || ''} ${a.claimants?.last_name || ''} (${a.claimants?.auto_id || ''}) - ${a.medical_experts?.first_name || ''} ${a.medical_experts?.last_name || ''}`,
        expert_id: a.expert_id,
        claimant_id: a.claimant_id,
        referring_attorney_id: a.referring_attorney_id,
      })));
    }
    if (expertTypesRes.data) {
      const types = [...new Set((expertTypesRes.data as any[]).map(e => e.expert_type).filter(Boolean))].sort();
      setExpertTypes(types);
    }
  }, []);

  useEffect(() => { fetchDocuments(); fetchDropdowns(); }, [fetchDocuments, fetchDropdowns]);

  // Filtering
  const isExpertDoc = (d: DocumentRecord) =>
    !!d.expert_id ||
    ['Expert CV', 'Expert Qualifications', 'Expert HPCSA Certificate', 'Expert Report', 'Expert AOD Agreement'].includes(d.document_type) ||
    d.document_type === 'expert_report_sent' || d.document_type === 'medico_report';

  const filteredDocs = documents.filter(d => {
    const typeLabel = getDocTypeLabel(d.document_type).toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      d.file_name.toLowerCase().includes(searchLower) ||
      d.claimant_name?.toLowerCase().includes(searchLower) ||
      d.attorney_name?.toLowerCase().includes(searchLower) ||
      d.expert_name?.toLowerCase().includes(searchLower) ||
      d.expert_type?.toLowerCase().includes(searchLower) ||
      d.expert_specializations?.some(s => s.toLowerCase().includes(searchLower)) ||
      typeLabel.includes(searchLower) ||
      d.document_type.toLowerCase().includes(searchLower);
    const matchesType = typeFilter === 'all' || d.document_type === typeFilter;
    const matchesStatus = statusFilter === 'all' || d.approval_status === statusFilter;
    const matchesExpert = expertFilter === 'all' || d.expert_id === expertFilter;
    const matchesExpertType = expertTypeFilter === 'all' || d.expert_type === expertTypeFilter;

    if (activeTab === 'pending') return matchesSearch && matchesType && matchesExpert && matchesExpertType && d.approval_status === 'pending';
    if (activeTab === 'approved') return matchesSearch && matchesType && matchesExpert && matchesExpertType && d.approval_status === 'approved';
    if (activeTab === 'declined') return matchesSearch && matchesType && matchesExpert && matchesExpertType && d.approval_status === 'declined';
    if (activeTab === 'experts') return matchesSearch && matchesType && matchesStatus && matchesExpert && matchesExpertType && isExpertDoc(d);
    return matchesSearch && matchesType && matchesStatus && matchesExpert && matchesExpertType;
  });

  const stats = {
    total: documents.length,
    pending: documents.filter(d => d.approval_status === 'pending').length,
    approved: documents.filter(d => d.approval_status === 'approved').length,
    declined: documents.filter(d => d.approval_status === 'declined').length,
    experts: documents.filter(isExpertDoc).length,
  };

  // Keep the top scrollbar's inner "track" the same width as the table so it
  // scrolls in lockstep. Deliberately depends only on primitives (row COUNT,
  // not the `filteredDocs` array itself) — `filteredDocs` is a brand-new
  // array reference on every render, and depending on it here would re-run
  // this effect (and rebuild the ResizeObserver) on every single re-render,
  // including the one that fires when the preview sheet opens — which is
  // exactly what was causing the lag/glitch when tapping the eye icon.
  useLayoutEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const update = () => setTableScrollWidth(el.scrollWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [filteredDocs.length, loading, isAdminOrEmployee, activeTab]);

  // Upload handler
  const handleUpload = async () => {
    if (!uploadFile || !uploadDocType || !user) {
      toast({ title: 'Missing Fields', description: 'Please select a file and document type.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const filePath = `vault/${uploadClaimantId || 'general'}/${Date.now()}_${uploadFile.name}`;
      await uploadFileResumable({ bucket: 'attorney-documents', path: filePath, file: uploadFile });

      // Auto-set visibility based on doc type
      let visibleToAttorney = uploadVisibleAttorney;
      let visibleToExpert = uploadVisibleExpert;

      // Expert Reports: only Admin + Attorney can see (not experts)
      if (uploadDocType === 'Expert Report') {
        visibleToAttorney = true;
        visibleToExpert = false;
      }
      // Expert AOD Agreement: invisible to attorneys
      if (uploadDocType === 'Expert AOD Agreement') {
        visibleToAttorney = false;
        visibleToExpert = true;
      }
      // Supporting docs: visible to both attorney and appointed expert
      const supportingDocTypes = ['Medical Records', 'ID Copy', 'Summons', 'Instruction Letter', 'RAF1 Form', 'RAF4 Form', 'Police Report', 'Hospital Records', 'Supporting Document'];
      if (supportingDocTypes.includes(uploadDocType)) {
        visibleToAttorney = true;
        visibleToExpert = true;
      }

      const resolvedClaimantId = uploadClaimantId && uploadClaimantId !== 'none' ? uploadClaimantId : null;
      const resolvedAttorneyId = uploadAttorneyId && uploadAttorneyId !== 'none' ? uploadAttorneyId : null;
      const resolvedExpertId = uploadExpertId && uploadExpertId !== 'none' ? uploadExpertId : null;
      // Auto-detect appointment based on claimant + expert or claimant + attorney
      let resolvedAppointmentId: string | null = null;
      if (resolvedClaimantId) {
        let appointmentQuery = supabase
          .from('appointments')
          .select('id')
          .eq('claimant_id', resolvedClaimantId)
          .is('deleted_at', null)
          .order('appointment_date', { ascending: false })
          .limit(1);

        if (resolvedExpertId) {
          appointmentQuery = appointmentQuery.eq('expert_id', resolvedExpertId);
        } else if (resolvedAttorneyId) {
          appointmentQuery = appointmentQuery.eq('referring_attorney_id', resolvedAttorneyId);
        }

        const { data: matchedAppointment } = await appointmentQuery.maybeSingle();
        if (matchedAppointment) {
          resolvedAppointmentId = matchedAppointment.id;
        }
      }

      const { error: insertErr } = await supabase.from('documents').insert({
        document_type: uploadDocType,
        file_name: uploadFile.name,
        file_path: filePath,
        file_size: uploadFile.size,
        file_type: uploadFile.type,
        uploaded_by: user.id,
        notes: uploadNotes || null,
        claimant_id: resolvedClaimantId,
        referring_attorney_id: resolvedAttorneyId,
        expert_id: resolvedExpertId,
        appointment_id: resolvedAppointmentId,
        approval_status: isAdminOrEmployee ? 'approved' : 'pending',
        access_level: uploadAccessLevel,
        is_visible_to_attorney: visibleToAttorney,
        is_visible_to_expert: visibleToExpert,
      });
      if (insertErr) throw insertErr;

      // If Expert Report, sync to expert_reports table for Report Management
      if (uploadDocType === 'Expert Report' && resolvedExpertId && resolvedClaimantId) {
        try {
          const result = resolvedAppointmentId
            ? await upsertExpertReport({
                appointment_id: resolvedAppointmentId,
                expert_id: resolvedExpertId,
                claimant_id: resolvedClaimantId,
                report_status: 'completed',
                report_submitted_date: new Date().toISOString(),
                notes: uploadNotes || 'Report uploaded via Document Vault',
              })
            : await upsertExpertReport({
                expert_id: resolvedExpertId,
                claimant_id: resolvedClaimantId,
                report_status: 'completed',
                report_submitted_date: new Date().toISOString(),
                notes: uploadNotes || 'Report uploaded via Document Vault (no appointment linked)',
              });

          if (!result.ok) {
            toast({
              title: 'Warning',
              description: result.error ?? 'Report uploaded but failed to sync to Report Management.',
            });
          } else {
            const actionLabel =
              result.action === 'inserted' ? 'created'
              : result.action === 'updated' ? 'updated'
              : 'synced';
            toast({
              title: 'Report Management synced',
              description: `Expert report entry ${actionLabel}.`,
            });
          }

          if (resolvedAppointmentId) {
            await supabase
              .from('appointments')
              .update({ case_status: 'report submitted', updated_at: new Date().toISOString() })
              .eq('id', resolvedAppointmentId);
          }
        } catch (syncErr: any) {
          console.error('Expert report sync error:', syncErr);
          toast({ title: 'Warning', description: 'Report uploaded but failed to sync to Report Management. Please check manually.' });
        }
      }

      // Auto-update scheduled assessment: update document checklist and appointment
      if (resolvedAppointmentId && resolvedClaimantId) {
        try {
          // Map upload doc type to checklist document_type
          const docTypeMap: Record<string, string> = {
            'Medical Records': 'medical_records',
            'Instruction Letter': 'instruction_letter',
            'ID Copy': 'claimant_id_copy',
            'RAF1 Form': 'raf1_form',
            'RAF4 Form': 'raf4_form',
            'Police Report': 'police_report',
            'Hospital Records': 'hospital_records',
            'Summons': 'summons',
            'Supporting Document': 'supporting_document',
          };

          const checklistType = docTypeMap[uploadDocType];
          if (checklistType) {
            // Update or create document checklist entry
            const { data: existingChecklist } = await supabase
              .from('document_checklist')
              .select('id')
              .eq('appointment_id', resolvedAppointmentId)
              .eq('claimant_id', resolvedClaimantId)
              .eq('document_type', checklistType)
              .maybeSingle();

            if (existingChecklist) {
              await supabase
                .from('document_checklist')
                .update({
                  is_submitted: true,
                  submitted_at: new Date().toISOString(),
                  notes: `Auto-updated via Document Vault upload`,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingChecklist.id);
            } else {
              await supabase.from('document_checklist').insert({
                appointment_id: resolvedAppointmentId,
                claimant_id: resolvedClaimantId,
                document_type: checklistType,
                is_submitted: true,
                submitted_at: new Date().toISOString(),
                notes: `Auto-created via Document Vault upload`,
              });
            }
          }

          // Update appointment updated_at to trigger sync
          await supabase
            .from('appointments')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', resolvedAppointmentId);

        } catch (checklistErr: any) {
          console.error('Document checklist auto-update error:', checklistErr);
        }
      }

      toast({ title: 'Document Uploaded', description: isAdminOrEmployee ? 'Document uploaded and auto-approved.' : 'Document uploaded and pending admin approval.' });
      setUploadDialogOpen(false);
      resetUploadForm();
      await fetchDocuments();
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({ title: 'Upload Failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadDocType('');
    setUploadAccessLevel('internal');
    setUploadNotes('');
    setUploadClaimantId('');
    setUploadAttorneyId('');
    setUploadExpertId('');
    // uploadAppointmentId is auto-detected, no reset needed
    setUploadVisibleAttorney(true);
    setUploadVisibleExpert(true);
  };

  // Review (Accept/Decline)
  const handleReview = async () => {
    if (!selectedDoc || !user) return;
    setReviewing(true);
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          approval_status: reviewAction,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null,
        })
        .eq('id', selectedDoc.id);
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        action_type: `document_${reviewAction}`,
        table_name: 'documents',
        record_id: selectedDoc.id,
        function_area: 'document_vault',
        user_id: user.id,
        description: `Document "${selectedDoc.file_name}" ${reviewAction}`,
        new_values: { approval_status: reviewAction, review_notes: reviewNotes },
      });

      toast({ title: `Document ${reviewAction === 'approved' ? 'Approved' : 'Declined'}`, description: `"${selectedDoc.file_name}" has been ${reviewAction}.` });
      setReviewDialogOpen(false);
      setReviewNotes('');
      await fetchDocuments();
    } catch (err: any) {
      console.error('Review error:', err);
      toast({ title: 'Error', description: 'Failed to review document.', variant: 'destructive' });
    } finally {
      setReviewing(false);
    }
  };

  // Download
  const handleDownload = async (doc: DocumentRecord) => {
    try {
      // Attorneys can only download Expert Reports
      if (isAttorney && doc.document_type !== 'Expert Report' && getDocTypeLabel(doc.document_type) !== 'Expert Report') {
        toast({ title: 'Access Denied', description: 'You can only download Expert Reports.', variant: 'destructive' });
        return;
      }

      // Experts can only download supporting documents linked to their appointments
      if (isExpert) {
        const expertReportTypes = ['Expert Report', 'medico_report', 'expert_report_sent', 'Expert AOD Agreement'];
        if (expertReportTypes.includes(doc.document_type)) {
          toast({ title: 'Access Denied', description: 'You cannot download this document type.', variant: 'destructive' });
          return;
        }
      }

      const blob = await downloadFromBuckets(doc.file_path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Download error:', err);
      toast({ title: 'Download Failed', description: err.message, variant: 'destructive' });
    }
  };

  // Delete (admin only)
  const handleDelete = async (doc: DocumentRecord) => {
    if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
    try {
      // Try to delete from whichever bucket has the file
      let deleted = false;
      for (const bucket of STORAGE_BUCKETS) {
        const { error } = await supabase.storage.from(bucket).remove([doc.file_path]);
        if (!error) { deleted = true; break; }
      }
      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Document removed.' });
      await fetchDocuments();
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to delete.', variant: 'destructive' });
    }
  };

  // Preview document (admin/employee only)
  const handlePreview = async (doc: DocumentRecord) => {
    setSelectedDoc(doc);
    setPreviewLoading(true);
    setPreviewDialogOpen(true);
    try {
      const signedUrl = await createSignedUrl(doc.file_path, 604800);
      setPreviewUrl(signedUrl);

      // Log POPIA-compliant access
      await supabase.from('audit_logs').insert({
        action_type: 'document_viewed',
        table_name: 'documents',
        record_id: doc.id,
        function_area: 'document_vault',
        user_id: user?.id || null,
        description: `Document viewed: "${doc.file_name}" (POPIA access log)`,
        new_values: { document_type: doc.document_type, claimant: doc.claimant_name, file_name: doc.file_name },
      });
    } catch (err: any) {
      console.error('Preview error:', err);
      toast({ title: 'Preview Failed', description: err.message, variant: 'destructive' });
      setPreviewDialogOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  // ---- Pure display helpers (presentation only, using the shared AdminPill) ----
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <AdminPill tone="success"><CheckCircle2 className="h-3 w-3" />Approved</AdminPill>;
      case 'declined':
        return <AdminPill tone="destructive"><XCircle className="h-3 w-3" />Declined</AdminPill>;
      default:
        return <AdminPill tone="warning"><Clock className="h-3 w-3" />Pending</AdminPill>;
    }
  };

  const getAccessBadge = (level: string) => {
    switch (level) {
      case 'confidential':
        return <AdminPill tone="destructive"><Lock className="h-3 w-3" />Confidential</AdminPill>;
      case 'restricted':
        return <AdminPill tone="warning"><Shield className="h-3 w-3" />Restricted</AdminPill>;
      case 'internal':
        return <AdminPill tone="teal"><Eye className="h-3 w-3" />Internal</AdminPill>;
      default:
        return <AdminPill tone="neutral">Public</AdminPill>;
    }
  };

  const allowedUploadTypes = isAdminOrEmployee ? ADMIN_UPLOAD_TYPES : ATTORNEY_UPLOAD_TYPES;

  // Tab definitions — visibility depends on role, same "module switcher" pattern
  // used on Finance / Appointment Engine / System Control.
  const tabDefs = [
    { value: 'all', label: 'All', badge: stats.total, show: true },
    { value: 'pending', label: 'Pending', badge: stats.pending, show: isAdminOrEmployee },
    { value: 'approved', label: 'Approved', badge: stats.approved, show: true },
    { value: 'declined', label: 'Declined', badge: stats.declined, show: isAdminOrEmployee },
    { value: 'experts', label: 'Experts', badge: stats.experts, show: isAdminOrEmployee },
  ].filter(t => t.show);

  return (
    <AdminPage className="max-w-7xl">
      <AdminHeader
        eyebrow="Documents"
        title="Secure Document Vault"
        description="Role-based document storage with approval control"
        icon={FolderLock}
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-none" onClick={fetchDocuments} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" className="gradient-teal rounded-none border" onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-1.5" />
              Upload Document
            </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <AdminStatCard label="Total Documents" value={stats.total} icon={FileText} loading={loading} />
        <AdminStatCard label="Pending Review" value={stats.pending} icon={Clock} loading={loading} />
        <AdminStatCard label="Approved" value={stats.approved} icon={CheckCircle2} loading={loading} />
        <AdminStatCard label="Declined" value={stats.declined} icon={XCircle} loading={loading} />
        {isAdminOrEmployee && (
          <AdminStatCard label="Expert Documents" value={stats.experts} icon={Shield} loading={loading} />
        )}
      </div>

      {/* POPIA Compliance Banner */}
      {isAdminOrEmployee && (
        <AdminCard className="border-[#00BAAD]/25 bg-[#00BAAD]/5">
          <AdminCardBody className="flex items-start gap-3 py-3">
            <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" style={{ color: '#00BAAD' }} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-black">POPIA Compliance Active</p>
              <p className="text-xs text-slate-500">
                All document access is logged per the Protection of Personal Information Act (POPIA).
                Review documents before approving to ensure compliance with data protection requirements.
                Personal information must be handled with care — only approve documents that meet POPIA standards.
              </p>
            </div>
          </AdminCardBody>
        </AdminCard>
      )}

      {/* Search & Filters */}
      <AdminCard>
        <AdminCardHeader icon={Filter} title="Search & Filters" description="Narrow down the document list below." />
        <AdminCardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Search</label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Filename, claimant, attorney, expert…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="rounded-none pl-8"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Document Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="mt-1 rounded-none"><SelectValue placeholder="Document Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {ADMIN_UPLOAD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Expert</label>
              <Select value={expertFilter} onValueChange={setExpertFilter}>
                <SelectTrigger className="mt-1 rounded-none"><SelectValue placeholder="Expert" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Experts</SelectItem>
                  {experts.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Expert Type</label>
              <Select value={expertTypeFilter} onValueChange={setExpertTypeFilter}>
                <SelectTrigger className="mt-1 rounded-none"><SelectValue placeholder="Expert Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Expert Types</SelectItem>
                  {expertTypes.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </AdminCardBody>
      </AdminCard>

      {/* Tabs + document list */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <AdminTabList sticky columns={tabDefs.length}>
          {tabDefs.map(t => (
            <AdminTabTrigger key={t.value} value={t.value} label={t.label} badge={t.badge || undefined} center />
          ))}
        </AdminTabList>

        <div className="mt-4">
          <TabsContent value={activeTab} className="mt-0 focus-visible:outline-none">
            <AdminCard>
              <AdminCardHeader
                icon={FileText}
                title="Documents"
                description={`${filteredDocs.length} document${filteredDocs.length === 1 ? '' : 's'}`}
              />
              {loading ? (
                <AdminLoadingState label="Loading documents…" />
              ) : filteredDocs.length === 0 ? (
                <AdminEmptyState
                  icon={FolderLock}
                  title="No documents found"
                  description="Try adjusting your search or filters, or upload a new document."
                />
              ) : (
                <>
                  {/* Desktop / wide-tablet table — avoids the column-overlap that a
                      cramped table produces on narrower screens. */}
                  <div className="hidden xl:block">
                    {/* Top scrollbar, mirrored with the table below, so staff can scroll
                        sideways to reach the Actions/eye column without first scrolling
                        all the way down to find the horizontal scrollbar. */}
                    <div
                      ref={topScrollRef}
                      onScroll={syncScrollFromTop}
                      className="overflow-x-auto overflow-y-hidden border-b border-black/10 bg-black/[0.02] [&::-webkit-scrollbar]:h-2.5"
                      style={{ scrollbarWidth: 'thin' }}
                    >
                      <div style={{ width: tableScrollWidth, height: 10 }} />
                    </div>
                    <div
                      ref={tableScrollRef}
                      onScroll={syncScrollFromTable}
                      className="max-h-[65vh] overflow-auto"
                    >
                    <Table className="text-xs [&_th]:h-9 [&_th]:px-3 [&_th]:py-1 [&_th]:text-[11px] [&_td]:px-3 [&_td]:py-2 [&_td]:align-middle">
                      <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.black/10%)]">
                        <TableRow>
                          <TableHead>Document</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Claimant</TableHead>
                          <TableHead>Attorney</TableHead>
                          <TableHead>Expert</TableHead>
                          <TableHead>Status</TableHead>
                          {isAdminOrEmployee && <TableHead>Access</TableHead>}
                          {isAdminOrEmployee && <TableHead>Visibility</TableHead>}
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDocs.map(doc => (
                          <TableRow key={doc.id} className="hover:bg-black/[0.02]">
                            <TableCell>
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-4 w-4 shrink-0" style={{ color: '#00BAAD' }} />
                                <div className="min-w-0">
                                  <p className="font-medium truncate max-w-[180px] text-black" title={doc.file_name}>{doc.file_name}</p>
                                  {doc.file_size && (
                                    <p className="text-[10px] text-slate-400">{(doc.file_size / 1024).toFixed(0)} KB</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <AdminPill tone="neutral">{getDocTypeLabel(doc.document_type)}</AdminPill>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-slate-500">{getDocumentSource(doc)}</TableCell>
                            <TableCell className="max-w-[140px] truncate" title={doc.claimant_name || undefined}>{doc.claimant_name || '—'}</TableCell>
                            <TableCell className="max-w-[140px] truncate" title={doc.attorney_name || undefined}>{doc.attorney_name || '—'}</TableCell>
                            <TableCell>
                              <div className="max-w-[140px] truncate">{doc.expert_name || '—'}</div>
                              {doc.expert_type && (
                                <AdminPill tone="teal" className="mt-1">{doc.expert_type}</AdminPill>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(doc.approval_status)}</TableCell>
                            {isAdminOrEmployee && <TableCell>{getAccessBadge(doc.access_level)}</TableCell>}
                            {isAdminOrEmployee && (
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {!doc.is_visible_to_attorney && (
                                    <AdminPill tone="destructive"><EyeOff className="h-2.5 w-2.5" />Atty</AdminPill>
                                  )}
                                  {!doc.is_visible_to_expert && (
                                    <AdminPill tone="warning"><EyeOff className="h-2.5 w-2.5" />Expert</AdminPill>
                                  )}
                                  {doc.is_visible_to_attorney && doc.is_visible_to_expert && (
                                    <span className="text-[10px] text-slate-400">All</span>
                                  )}
                                </div>
                              </TableCell>
                            )}
                            <TableCell className="whitespace-nowrap text-slate-500">
                              {format(parseISO(doc.created_at), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                {isAdminOrEmployee && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none hover:bg-black/5" style={{ color: '#00BAAD' }} onClick={() => handlePreview(doc)} title="View document">
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {(!isAttorney || doc.document_type === 'Expert Report') && doc.approval_status === 'approved' && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none hover:bg-black/5" onClick={() => handleDownload(doc)} title="Download">
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {isAdminOrEmployee && doc.approval_status === 'pending' && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 rounded-none text-success hover:bg-black/5"
                                      onClick={() => { setSelectedDoc(doc); setReviewAction('approved'); setReviewDialogOpen(true); }}
                                      title="Approve"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 rounded-none text-destructive hover:bg-black/5"
                                      onClick={() => { setSelectedDoc(doc); setReviewAction('declined'); setReviewDialogOpen(true); }}
                                      title="Decline"
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                                {isAdmin && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none text-destructive hover:bg-black/5" onClick={() => handleDelete(doc)} title="Delete">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </div>

                  {/* Mobile / tablet card list — same data, no horizontal scroll and no
                      cramped columns, so nothing overlaps on narrower screens. */}
                  <div className="divide-y divide-black/10 xl:hidden max-h-[70vh] overflow-y-auto">
                    {filteredDocs.map(doc => (
                      <div key={doc.id} className="flex flex-col gap-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-2">
                            <FileText className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#00BAAD' }} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-black" title={doc.file_name}>{doc.file_name}</p>
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                {getDocumentSource(doc)} · {format(parseISO(doc.created_at), 'dd MMM yyyy')}
                                {doc.file_size ? ` · ${(doc.file_size / 1024).toFixed(0)} KB` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {getStatusBadge(doc.approval_status)}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <AdminPill tone="neutral">{getDocTypeLabel(doc.document_type)}</AdminPill>
                          {isAdminOrEmployee && getAccessBadge(doc.access_level)}
                          {doc.expert_type && <AdminPill tone="teal">{doc.expert_type}</AdminPill>}
                          {isAdminOrEmployee && !doc.is_visible_to_attorney && (
                            <AdminPill tone="destructive"><EyeOff className="h-2.5 w-2.5" />Hidden from attorney</AdminPill>
                          )}
                          {isAdminOrEmployee && !doc.is_visible_to_expert && (
                            <AdminPill tone="warning"><EyeOff className="h-2.5 w-2.5" />Hidden from expert</AdminPill>
                          )}
                        </div>

                        {(doc.claimant_name || doc.attorney_name || doc.expert_name) && (
                          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                            {doc.claimant_name && (
                              <div className="min-w-0">
                                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                  <Users className="h-3 w-3" />Claimant
                                </p>
                                <p className="mt-0.5 truncate text-black" title={doc.claimant_name}>{doc.claimant_name}</p>
                              </div>
                            )}
                            {doc.attorney_name && (
                              <div className="min-w-0">
                                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                  <Scale className="h-3 w-3" />Attorney
                                </p>
                                <p className="mt-0.5 truncate text-black" title={doc.attorney_name}>{doc.attorney_name}</p>
                              </div>
                            )}
                            {doc.expert_name && (
                              <div className="min-w-0">
                                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                  <Stethoscope className="h-3 w-3" />Expert
                                </p>
                                <p className="mt-0.5 truncate text-black" title={doc.expert_name}>{doc.expert_name}</p>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-black/5 pt-2">
                          {isAdminOrEmployee && (
                            <Button variant="outline" size="sm" className="rounded-none" style={{ color: '#00BAAD', borderColor: 'rgba(0,186,173,0.4)' }} onClick={() => handlePreview(doc)}>
                              <Eye className="h-3.5 w-3.5 mr-1.5" />View
                            </Button>
                          )}
                          {(!isAttorney || doc.document_type === 'Expert Report') && doc.approval_status === 'approved' && (
                            <Button variant="outline" size="sm" className="rounded-none" onClick={() => handleDownload(doc)}>
                              <Download className="h-3.5 w-3.5 mr-1.5" />Download
                            </Button>
                          )}
                          {isAdminOrEmployee && doc.approval_status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                className="rounded-none bg-success text-white hover:bg-success/90"
                                onClick={() => { setSelectedDoc(doc); setReviewAction('approved'); setReviewDialogOpen(true); }}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="rounded-none"
                                onClick={() => { setSelectedDoc(doc); setReviewAction('declined'); setReviewDialogOpen(true); }}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1.5" />Decline
                              </Button>
                            </>
                          )}
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none text-destructive hover:bg-black/5" onClick={() => handleDelete(doc)} title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </AdminCard>
          </TabsContent>
        </div>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-lg rounded-none max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" style={{ color: '#00BAAD' }} />
              Upload Document
            </DialogTitle>
            <DialogDescription>
              {isAdminOrEmployee
                ? 'Upload and manage documents with full access control.'
                : 'Upload documents for admin review and approval.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Document Type *</Label>
              <Select value={uploadDocType} onValueChange={setUploadDocType}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="Select document type" /></SelectTrigger>
                <SelectContent>
                  {allowedUploadTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Link to Claimant</Label>
              <Select value={uploadClaimantId} onValueChange={setUploadClaimantId}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="Select claimant (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Claimant</SelectItem>
                  {claimants.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.auto_id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Link to Attorney</Label>
              <Select value={uploadAttorneyId} onValueChange={setUploadAttorneyId}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="Select attorney (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Attorney</SelectItem>
                  {attorneys.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Expert Report: show expert selector */}
            {uploadDocType === 'Expert Report' && isAdminOrEmployee && (
              <>
                <div>
                  <Label>Link to Expert *</Label>
                  <Select value={uploadExpertId} onValueChange={setUploadExpertId}>
                    <SelectTrigger className="rounded-none"><SelectValue placeholder="Select expert" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Expert</SelectItem>
                      {experts.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border p-3 text-sm" style={{ backgroundColor: 'rgba(0,186,173,0.06)', borderColor: 'rgba(0,186,173,0.25)', color: '#00807a' }}>
                  <FileText className="h-4 w-4 inline mr-1" />
                  Expert Reports will automatically sync to Report Management, update case status, and link to the matching scheduled assessment.
                </div>
              </>
            )}

            {isAdminOrEmployee && (
              <>
                <div>
                  <Label>Access Level</Label>
                  <Select value={uploadAccessLevel} onValueChange={setUploadAccessLevel}>
                    <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACCESS_LEVELS.map(l => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label} — {l.desc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={uploadVisibleAttorney}
                      onChange={e => setUploadVisibleAttorney(e.target.checked)}
                      className="rounded"
                    />
                    Visible to Attorneys
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={uploadVisibleExpert}
                      onChange={e => setUploadVisibleExpert(e.target.checked)}
                      className="rounded"
                    />
                    Visible to Experts
                  </label>
                </div>

                {uploadDocType === 'Expert AOD Agreement' && (
                  <div className="border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                    <Shield className="h-4 w-4 inline mr-1" />
                    Expert AOD Agreements are automatically hidden from attorneys.
                  </div>
                )}
              </>
            )}

            <div>
              <Label>File *</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                onChange={e => setUploadFile(e.target.files?.[0] || null)}
                className="rounded-none"
              />
              <p className="text-xs text-slate-500 mt-1">PDF, DOC, DOCX, XLS, JPG, PNG</p>
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={uploadNotes}
                onChange={e => setUploadNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={2}
                className="rounded-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
            <Button className="gradient-teal rounded-none border" onClick={handleUpload} disabled={uploading || !uploadFile || !uploadDocType}>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reviewAction === 'approved'
                ? <><CheckCircle2 className="h-5 w-5 text-success" /> Approve Document</>
                : <><XCircle className="h-5 w-5 text-destructive" /> Decline Document</>
              }
            </DialogTitle>
            <DialogDescription>
              {selectedDoc?.file_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border border-black/10 bg-black/[0.02] p-3 space-y-1 text-sm">
              <p><strong>Type:</strong> {selectedDoc?.document_type}</p>
              <p><strong>Claimant:</strong> {selectedDoc?.claimant_name || 'N/A'}</p>
              <p><strong>Attorney:</strong> {selectedDoc?.attorney_name || 'N/A'}</p>
              <p><strong>Uploaded:</strong> {selectedDoc?.created_at ? format(parseISO(selectedDoc.created_at), 'dd MMM yyyy HH:mm') : ''}</p>
            </div>
            <div>
              <Label>Review Notes (optional)</Label>
              <Textarea
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                placeholder={reviewAction === 'declined' ? 'Reason for declining...' : 'Notes...'}
                rows={3}
                className="rounded-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
            <Button
              className="rounded-none"
              onClick={handleReview}
              disabled={reviewing}
              variant={reviewAction === 'declined' ? 'destructive' : 'default'}
            >
              {reviewAction === 'approved'
                ? <><CheckCircle2 className="h-4 w-4 mr-2" />{reviewing ? 'Approving...' : 'Approve'}</>
                : <><XCircle className="h-4 w-4 mr-2" />{reviewing ? 'Declining...' : 'Decline'}</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview — sliding panel (matches the Expert Payment Planner
          row-detail pattern) instead of a centered popup, so it doesn't block
          the table behind it and feels consistent across the Admin Portal. */}
      <Sheet open={previewDialogOpen} onOpenChange={(open) => { setPreviewDialogOpen(open); if (!open) { setPreviewUrl(null); setSelectedDoc(null); } }}>
        <SheetContent side="right" className="flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none duration-200 data-[state=closed]:duration-150 sm:max-w-2xl">
          <SheetHeader className="border-b border-black/10 px-4 py-4 text-left sm:px-6">
            <SheetTitle className="flex items-center gap-2 text-black">
              <Eye className="h-4 w-4" style={{ color: '#00BAAD' }} />
              <span className="truncate">{selectedDoc?.file_name || 'Document Preview'}</span>
            </SheetTitle>
            <SheetDescription asChild>
              <div className="flex flex-wrap items-center gap-2">
                {selectedDoc && getStatusBadge(selectedDoc.approval_status)}
                {selectedDoc && <AdminPill tone="neutral">{getDocTypeLabel(selectedDoc.document_type)}</AdminPill>}
              </div>
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
            {/* Document info */}
            {selectedDoc && (
              <div>
                <AdminSectionLabel>Document Info</AdminSectionLabel>
                <div className="grid grid-cols-2 gap-3 border border-black/10 bg-black/[0.02] p-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Claimant</p>
                    <p className="font-medium truncate text-black">{selectedDoc.claimant_name || 'N/A'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Attorney</p>
                    <p className="font-medium truncate text-black">{selectedDoc.attorney_name || 'N/A'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Expert</p>
                    <p className="font-medium truncate text-black">{selectedDoc.expert_name || 'N/A'}</p>
                    {selectedDoc.expert_type && (
                      <p className="text-[10px] text-slate-500 truncate">{selectedDoc.expert_type}</p>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Uploaded</p>
                    <p className="font-medium text-black">{format(parseISO(selectedDoc.created_at), 'dd MMM yyyy HH:mm')}</p>
                  </div>
                </div>
              </div>
            )}

            {/* POPIA notice */}
            <div className="flex items-center gap-2 border border-warning/20 bg-warning/5 px-3 py-2 text-xs text-warning">
              <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
              <span>This access has been recorded per POPIA requirements. Handle personal information responsibly.</span>
            </div>

            {/* Preview area */}
            <div>
              <AdminSectionLabel>Preview</AdminSectionLabel>
              <div className="border border-black/10 overflow-hidden bg-white" style={{ height: '50vh' }}>
                {previewLoading ? (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <RefreshCw className="h-6 w-6 animate-spin mr-2" style={{ color: '#00BAAD' }} />
                    Loading preview...
                  </div>
                ) : previewUrl ? (
                  selectedDoc?.file_type?.includes('pdf') || selectedDoc?.file_name?.endsWith('.pdf') ? (
                    <iframe src={previewUrl} className="w-full h-full" title="Document Preview" />
                  ) : selectedDoc?.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(selectedDoc?.file_name || '') ? (
                    <div className="flex items-center justify-center h-full p-4">
                      <img src={previewUrl} alt={selectedDoc?.file_name} className="max-w-full max-h-full object-contain" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
                      <FileText className="h-16 w-16 opacity-30" />
                      <p className="text-sm text-center px-4">Preview not available for this file type ({selectedDoc?.file_type || 'unknown'})</p>
                      <Button variant="outline" size="sm" className="rounded-none" onClick={() => previewUrl && window.open(previewUrl, '_blank')}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open in New Tab
                      </Button>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    Failed to load preview
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sticky action footer */}
          <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-black/10 bg-white px-4 py-3 sm:px-6">
            {selectedDoc && (
              <Button variant="outline" size="sm" className="rounded-none" onClick={() => selectedDoc && handleDownload(selectedDoc)}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
            {selectedDoc?.approval_status === 'pending' && isAdminOrEmployee && (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-none"
                  onClick={() => {
                    setPreviewDialogOpen(false);
                    setReviewAction('declined');
                    setReviewDialogOpen(true);
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Decline
                </Button>
                <Button
                  size="sm"
                  className="gradient-teal rounded-none border"
                  onClick={() => {
                    setPreviewDialogOpen(false);
                    setReviewAction('approved');
                    setReviewDialogOpen(true);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AdminPage>
  );
};

export default AdminDocumentVault;
