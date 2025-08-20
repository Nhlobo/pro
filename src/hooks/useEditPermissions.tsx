import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EditRequest {
  id: string;
  table_name: string;
  record_id: string;
  requested_by: string;
  approved_by?: string;
  request_reason?: string;
  requested_changes: any;
  original_data: any;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_at?: string;
  updated_at: string;
}

export const useEditPermissions = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editRequests, setEditRequests] = useState<EditRequest[]>([]);

  // Check if user can edit a record
  const canEdit = async (tableName: string, recordId: string, createdDate: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase.rpc('can_edit_record', {
        table_name: tableName,
        record_id: recordId,
        created_date: createdDate
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error checking edit permission:', error);
      return false;
    }
  };

  // Request edit permission for data older than 30 days
  const requestEditPermission = async (
    tableName: string,
    recordId: string,
    reason: string,
    requestedChanges: any,
    originalData: any
  ): Promise<boolean> => {
    if (!user) return false;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('request_edit_permission', {
        p_table_name: tableName,
        p_record_id: recordId,
        p_reason: reason,
        p_requested_changes: requestedChanges,
        p_original_data: originalData
      });

      if (error) throw error;
      
      toast.success('Edit request submitted successfully');
      await fetchEditRequests(); // Refresh the list
      return true;
    } catch (error: any) {
      console.error('Error requesting edit permission:', error);
      toast.error(error.message || 'Failed to submit edit request');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Fetch all edit requests (for admins or user's own requests)
  const fetchEditRequests = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('edit_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEditRequests(data || []);
    } catch (error) {
      console.error('Error fetching edit requests:', error);
    } finally {
      setLoading(false);
    }
  };

  // Process edit request (admin only)
  const processEditRequest = async (
    requestId: string,
    status: 'approved' | 'rejected',
    adminNotes?: string
  ): Promise<boolean> => {
    if (!user) return false;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('process_edit_request', {
        p_request_id: requestId,
        p_status: status,
        p_admin_notes: adminNotes
      });

      if (error) throw error;
      
      toast.success(`Edit request ${status} successfully`);
      await fetchEditRequests(); // Refresh the list
      return true;
    } catch (error: any) {
      console.error('Error processing edit request:', error);
      toast.error(error.message || `Failed to ${status} edit request`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Check if data is within 30-day edit window
  const isWithinEditWindow = (createdDate: string): boolean => {
    const created = new Date(createdDate);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return created > thirtyDaysAgo;
  };

  useEffect(() => {
    if (user) {
      fetchEditRequests();
    }
  }, [user]);

  return {
    loading,
    editRequests,
    canEdit,
    requestEditPermission,
    processEditRequest,
    isWithinEditWindow,
    refetch: fetchEditRequests
  };
};