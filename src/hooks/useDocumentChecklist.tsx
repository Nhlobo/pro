import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';

export const REQUIRED_DOCUMENTS = [
  { type: 'id_document', label: 'ID Document', description: 'Claimant ID or Passport copy' },
  { type: 'med_records', label: 'Medical Records', description: 'Medical history and treatment records' },
  { type: 'hospital_file', label: 'Hospital File', description: 'Hospital admission and discharge records' },
  { type: 'police_report', label: 'Police Report', description: 'Accident report from police' },
  { type: 'raf1_raf4', label: 'RAF1 or RAF4', description: 'Road Accident Fund forms' },
  { type: 'affidavits', label: 'Supporting Affidavits', description: 'Witness statements and affidavits' },
];

export interface DocumentChecklistItem {
  id: string;
  claimant_id: string;
  appointment_id?: string;
  document_type: string;
  is_submitted: boolean;
  document_id?: string;
  submitted_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ClaimantWithChecklist {
  id: string;
  auto_id: string;
  first_name: string;
  last_name: string;
  checklist: DocumentChecklistItem[];
  submittedCount: number;
  totalRequired: number;
}

export const useDocumentChecklist = () => {
  const [claimants, setClaimants] = useState<ClaimantWithChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isPageLocked, isActiveTab } = useAppointmentSync();
  const initialFetchDone = useRef(false);

  const fetchChecklist = useCallback(async () => {
    // Don't refetch if page is locked (user is actively working)
    if (isPageLocked && initialFetchDone.current) {
      console.log('DocumentChecklist: Page locked, skipping refresh');
      return;
    }
    
    setLoading(true);
    try {
      // Fetch claimants
      const { data: claimantsData, error: claimantsError } = await supabase
        .from('claimants')
        .select('id, auto_id, first_name, last_name')
        .order('created_at', { ascending: false });

      if (claimantsError) throw claimantsError;

      // Fetch all checklist items
      const { data: checklistData, error: checklistError } = await supabase
        .from('document_checklist')
        .select('*');

      if (checklistError) throw checklistError;

      // Map claimants with their checklist
      const claimantsWithChecklist: ClaimantWithChecklist[] = (claimantsData || []).map(claimant => {
        const claimantChecklist = (checklistData || []).filter(
          item => item.claimant_id === claimant.id
        ) as DocumentChecklistItem[];

        // Create full checklist with all required documents
        const fullChecklist = REQUIRED_DOCUMENTS.map(doc => {
          const existing = claimantChecklist.find(c => c.document_type === doc.type);
          return existing || {
            id: '',
            claimant_id: claimant.id,
            document_type: doc.type,
            is_submitted: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        });

        return {
          ...claimant,
          checklist: fullChecklist,
          submittedCount: fullChecklist.filter(c => c.is_submitted).length,
          totalRequired: REQUIRED_DOCUMENTS.length
        };
      });

      setClaimants(claimantsWithChecklist);
      initialFetchDone.current = true;
    } catch (error) {
      console.error('Error fetching document checklist:', error);
      toast({
        title: 'Error',
        description: 'Failed to load document checklist',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast, isPageLocked]);

  const updateChecklistItem = async (
    claimantId: string, 
    documentType: string, 
    isSubmitted: boolean,
    documentId?: string,
    notes?: string
  ) => {
    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from('document_checklist')
        .select('id')
        .eq('claimant_id', claimantId)
        .eq('document_type', documentType)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('document_checklist')
          .update({
            is_submitted: isSubmitted,
            document_id: documentId || null,
            submitted_at: isSubmitted ? new Date().toISOString() : null,
            notes
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('document_checklist')
          .insert({
            claimant_id: claimantId,
            document_type: documentType,
            is_submitted: isSubmitted,
            document_id: documentId || null,
            submitted_at: isSubmitted ? new Date().toISOString() : null,
            notes
          });

        if (error) throw error;
      }

      // Refresh data
      await fetchChecklist();

      toast({
        title: 'Updated',
        description: `Document status updated successfully`
      });
    } catch (error) {
      console.error('Error updating checklist:', error);
      toast({
        title: 'Error',
        description: 'Failed to update checklist',
        variant: 'destructive'
      });
    }
  };

  const initializeChecklistForClaimant = async (claimantId: string, appointmentId?: string) => {
    try {
      const items = REQUIRED_DOCUMENTS.map(doc => ({
        claimant_id: claimantId,
        appointment_id: appointmentId || null,
        document_type: doc.type,
        is_submitted: false
      }));

      const { error } = await supabase
        .from('document_checklist')
        .upsert(items, { onConflict: 'claimant_id,document_type' });

      if (error) throw error;
    } catch (error) {
      console.error('Error initializing checklist:', error);
    }
  };

  useEffect(() => {
    // Only fetch on initial load or when tab becomes active and not locked
    if (!initialFetchDone.current || (isActiveTab && !isPageLocked)) {
      fetchChecklist();
    }
  }, [fetchChecklist, isActiveTab, isPageLocked]);

  return {
    claimants,
    loading,
    updateChecklistItem,
    initializeChecklistForClaimant,
    refetch: fetchChecklist
  };
};
