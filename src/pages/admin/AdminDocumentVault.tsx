import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  FolderLock, FileText, Shield, Eye, Upload, Lock, Download, Search, RefreshCw,
  CheckCircle2, XCircle, Clock, Filter, Trash2, MoreHorizontal, EyeOff, ExternalLink, ShieldCheck, AlertTriangle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

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
}

const AdminDocumentVault: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
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

  // Preview state
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  const createSignedUrl = async (filePath: string, expiresIn: number = 300): Promise<string> => {
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
          medical_experts:expert_id(first_name, last_name)
        `)
        .order('created_at', { ascending: false });

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
    const [claimantsRes, attorneysRes, expertsRes, appointmentsRes] = await Promise.all([
      supabase.from('claimants').select('id, first_name, last_name, auto_id').order('first_name'),
      supabase.from('referring_attorneys').select('id, name').order('name'),
      supabase.from('medical_experts').select('id, first_name, last_name').eq('status', 'active').order('first_name'),
      supabase.from('appointments').select('id, appointment_date, expert_id, claimant_id, referring_attorney_id, claimants(first_name, last_name, auto_id), medical_experts!inner(first_name, last_name)').is('deleted_at', null).order('appointment_date', { ascending: false }).limit(200),
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
  }, []);

  useEffect(() => { fetchDocuments(); fetchDropdowns(); }, [fetchDocuments, fetchDropdowns]);

  // Filtering
  const filteredDocs = documents.filter(d => {
    const typeLabel = getDocTypeLabel(d.document_type).toLowerCase();
    const matchesSearch = !searchTerm ||
      d.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.claimant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.attorney_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      typeLabel.includes(searchTerm.toLowerCase()) ||
      d.document_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || d.document_type === typeFilter;
    const matchesStatus = statusFilter === 'all' || d.approval_status === statusFilter;

    if (activeTab === 'pending') return matchesSearch && matchesType && d.approval_status === 'pending';
    if (activeTab === 'approved') return matchesSearch && matchesType && d.approval_status === 'approved';
    if (activeTab === 'declined') return matchesSearch && matchesType && d.approval_status === 'declined';
    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = {
    total: documents.length,
    pending: documents.filter(d => d.approval_status === 'pending').length,
    approved: documents.filter(d => d.approval_status === 'approved').length,
    declined: documents.filter(d => d.approval_status === 'declined').length,
  };

  // Upload handler
  const handleUpload = async () => {
    if (!uploadFile || !uploadDocType || !user) {
      toast({ title: 'Missing Fields', description: 'Please select a file and document type.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const filePath = `vault/${uploadClaimantId || 'general'}/${Date.now()}_${uploadFile.name}`;
      const { error: storageErr } = await supabase.storage.from('attorney-documents').upload(filePath, uploadFile);
      if (storageErr) throw storageErr;

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
          // Check if expert_report already exists for this appointment
          if (resolvedAppointmentId) {
            const { data: existingReport } = await supabase
              .from('expert_reports')
              .select('id')
              .eq('appointment_id', resolvedAppointmentId)
              .maybeSingle();

            if (existingReport) {
              // Update existing report
              await supabase
                .from('expert_reports')
                .update({
                  report_status: 'completed',
                  report_submitted_date: new Date().toISOString(),
                  notes: uploadNotes || 'Report uploaded via Document Vault',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingReport.id);
            } else {
              // Create new expert_report record
              await supabase.from('expert_reports').insert({
                appointment_id: resolvedAppointmentId,
                expert_id: resolvedExpertId,
                claimant_id: resolvedClaimantId,
                report_status: 'completed',
                report_submitted_date: new Date().toISOString(),
                notes: uploadNotes || 'Report uploaded via Document Vault',
              });
            }

            // Update appointment case_status to 'report submitted'
            await supabase
              .from('appointments')
              .update({ case_status: 'report submitted', updated_at: new Date().toISOString() })
              .eq('id', resolvedAppointmentId);
          } else {
            // No appointment linked — still create expert_report record
            await supabase.from('expert_reports').insert({
              expert_id: resolvedExpertId,
              claimant_id: resolvedClaimantId,
              report_status: 'completed',
              report_submitted_date: new Date().toISOString(),
              notes: uploadNotes || 'Report uploaded via Document Vault (no appointment linked)',
            });
          }
        } catch (syncErr: any) {
          console.error('Expert report sync error:', syncErr);
          // Don't fail the upload — just warn
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
    setUploadAppointmentId('');
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
      const signedUrl = await createSignedUrl(doc.file_path, 300);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-success/10 text-success border-success/20 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'declined': return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]"><XCircle className="h-3 w-3 mr-1" />Declined</Badge>;
      default: return <Badge className="bg-warning/10 text-warning border-warning/20 text-[10px]"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const getAccessBadge = (level: string) => {
    switch (level) {
      case 'confidential': return <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px]"><Lock className="h-3 w-3 mr-1" />Confidential</Badge>;
      case 'restricted': return <Badge variant="outline" className="text-warning border-warning/30 text-[10px]"><Shield className="h-3 w-3 mr-1" />Restricted</Badge>;
      case 'internal': return <Badge variant="outline" className="text-primary border-primary/30 text-[10px]"><Eye className="h-3 w-3 mr-1" />Internal</Badge>;
      default: return <Badge variant="outline" className="text-muted-foreground text-[10px]">Public</Badge>;
    }
  };

  const allowedUploadTypes = isAdminOrEmployee ? ADMIN_UPLOAD_TYPES : ATTORNEY_UPLOAD_TYPES;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Secure Document Vault</h1>
          <p className="text-sm text-muted-foreground">Role-based document storage with approval control</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchDocuments} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-1" />
            Upload Document
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Documents', value: stats.total, icon: FileText, color: 'text-primary' },
          { label: 'Pending Review', value: stats.pending, icon: Clock, color: 'text-warning' },
          { label: 'Approved', value: stats.approved, icon: CheckCircle2, color: 'text-success' },
          { label: 'Declined', value: stats.declined, icon: XCircle, color: 'text-destructive' },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* POPIA Compliance Banner */}
      {isAdminOrEmployee && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 px-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">POPIA Compliance Active</p>
              <p className="text-xs text-muted-foreground">
                All document access is logged per the Protection of Personal Information Act (POPIA).
                Review documents before approving to ensure compliance with data protection requirements.
                Personal information must be handled with care — only approve documents that meet POPIA standards.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by filename, claimant, attorney..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Document Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {ADMIN_UPLOAD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
          {isAdminOrEmployee && (
            <TabsTrigger value="pending" className="text-warning">
              Pending ({stats.pending})
            </TabsTrigger>
          )}
          <TabsTrigger value="approved">Approved ({stats.approved})</TabsTrigger>
          {isAdminOrEmployee && (
            <TabsTrigger value="declined">Declined ({stats.declined})</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card className="border-border/50">
            <CardContent className="p-0">
              {loading ? (
                <div className="text-center py-12 text-muted-foreground">Loading documents...</div>
              ) : filteredDocs.length === 0 ? (
                <div className="text-center py-12">
                  <FolderLock className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No documents found</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Claimant</TableHead>
                        <TableHead>Attorney</TableHead>
                        <TableHead>Status</TableHead>
                        {isAdminOrEmployee && <TableHead>Access</TableHead>}
                        {isAdminOrEmployee && <TableHead>Visibility</TableHead>}
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDocs.map(doc => (
                        <TableRow key={doc.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                              <div>
                                <p className="font-medium text-sm truncate max-w-[200px]">{doc.file_name}</p>
                                {doc.file_size && (
                                  <p className="text-[10px] text-muted-foreground">{(doc.file_size / 1024).toFixed(0)} KB</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">{getDocTypeLabel(doc.document_type)}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{getDocumentSource(doc)}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{doc.claimant_name || '—'}</TableCell>
                          <TableCell className="text-sm">{doc.attorney_name || '—'}</TableCell>
                          <TableCell>{getStatusBadge(doc.approval_status)}</TableCell>
                          {isAdminOrEmployee && <TableCell>{getAccessBadge(doc.access_level)}</TableCell>}
                          {isAdminOrEmployee && (
                            <TableCell>
                              <div className="flex gap-1">
                                {!doc.is_visible_to_attorney && (
                                  <Badge variant="outline" className="text-[9px] text-destructive border-destructive/20">
                                    <EyeOff className="h-2.5 w-2.5 mr-0.5" />Atty
                                  </Badge>
                                )}
                                {!doc.is_visible_to_expert && (
                                  <Badge variant="outline" className="text-[9px] text-warning border-warning/20">
                                    <EyeOff className="h-2.5 w-2.5 mr-0.5" />Expert
                                  </Badge>
                                )}
                                {doc.is_visible_to_attorney && doc.is_visible_to_expert && (
                                  <span className="text-[10px] text-muted-foreground">All</span>
                                )}
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="text-sm text-muted-foreground">
                            {format(parseISO(doc.created_at), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {/* View: admin/employee can preview before deciding */}
                              {isAdminOrEmployee && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handlePreview(doc)} title="View document">
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {/* Download: attorneys can only download Expert Reports */}
                              {(!isAttorney || doc.document_type === 'Expert Report') && doc.approval_status === 'approved' && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(doc)} title="Download">
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {/* Review: admin/employee only for pending docs */}
                              {isAdminOrEmployee && doc.approval_status === 'pending' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-success"
                                    onClick={() => { setSelectedDoc(doc); setReviewAction('approved'); setReviewDialogOpen(true); }}
                                    title="Approve"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    onClick={() => { setSelectedDoc(doc); setReviewAction('declined'); setReviewDialogOpen(true); }}
                                    title="Decline"
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                              {/* Delete: admin only */}
                              {isAdmin && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(doc)} title="Delete">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
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
                <SelectTrigger><SelectValue placeholder="Select document type" /></SelectTrigger>
                <SelectContent>
                  {allowedUploadTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Link to Claimant</Label>
              <Select value={uploadClaimantId} onValueChange={setUploadClaimantId}>
                <SelectTrigger><SelectValue placeholder="Select claimant (optional)" /></SelectTrigger>
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
                <SelectTrigger><SelectValue placeholder="Select attorney (optional)" /></SelectTrigger>
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
                    <SelectTrigger><SelectValue placeholder="Select expert" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Expert</SelectItem>
                      {experts.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm text-primary">
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
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACCESS_LEVELS.map(l => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label} — {l.desc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-4">
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
                  <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-sm text-warning">
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
              />
              <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX, XLS, JPG, PNG</p>
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={uploadNotes}
                onChange={e => setUploadNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadDocType}>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
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
            <div className="bg-muted/30 rounded-lg p-3 space-y-1 text-sm">
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
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
            <Button
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
      {/* Document Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={(open) => { setPreviewDialogOpen(open); if (!open) { setPreviewUrl(null); setSelectedDoc(null); } }}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Document Preview
            </DialogTitle>
            <DialogDescription className="flex items-center justify-between">
              <span>{selectedDoc?.file_name}</span>
              {selectedDoc && (
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedDoc.approval_status)}
                  <Badge variant="secondary" className="text-[10px]">{selectedDoc.document_type}</Badge>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Document info */}
          {selectedDoc && (
            <div className="bg-muted/30 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Claimant</p>
                <p className="font-medium">{selectedDoc.claimant_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Attorney</p>
                <p className="font-medium">{selectedDoc.attorney_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Uploaded</p>
                <p className="font-medium">{format(parseISO(selectedDoc.created_at), 'dd MMM yyyy HH:mm')}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Size</p>
                <p className="font-medium">{selectedDoc.file_size ? `${(selectedDoc.file_size / 1024).toFixed(0)} KB` : 'N/A'}</p>
              </div>
            </div>
          )}

          {/* POPIA notice */}
          <div className="bg-warning/5 border border-warning/20 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-warning">
            <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
            <span>This access has been recorded per POPIA requirements. Handle personal information responsibly.</span>
          </div>

          {/* Preview area */}
          <div className="border border-border rounded-lg overflow-hidden bg-background" style={{ height: '55vh' }}>
            {previewLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Loading preview...
              </div>
            ) : previewUrl ? (
              selectedDoc?.file_type?.includes('pdf') || selectedDoc?.file_name?.endsWith('.pdf') ? (
                <iframe src={previewUrl} className="w-full h-full" title="Document Preview" />
              ) : selectedDoc?.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(selectedDoc?.file_name || '') ? (
                <div className="flex items-center justify-center h-full p-4">
                  <img src={previewUrl} alt={selectedDoc?.file_name} className="max-w-full max-h-full object-contain rounded" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                  <FileText className="h-16 w-16 opacity-30" />
                  <p className="text-sm">Preview not available for this file type ({selectedDoc?.file_type || 'unknown'})</p>
                  <Button variant="outline" size="sm" onClick={() => previewUrl && window.open(previewUrl, '_blank')}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </Button>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Failed to load preview
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            {selectedDoc && (
              <Button variant="outline" size="sm" onClick={() => selectedDoc && handleDownload(selectedDoc)}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
            {selectedDoc?.approval_status === 'pending' && isAdminOrEmployee && (
              <>
                <Button
                  variant="destructive"
                  size="sm"
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDocumentVault;
