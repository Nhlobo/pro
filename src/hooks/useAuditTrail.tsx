import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action_type: string;
  old_values?: any;
  new_values?: any;
  changed_fields?: any;
  user_id: string;
  user_email?: string;
  function_area: string;
  description?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export const useAuditTrail = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const logAuditTrail = async (
    tableName: string,
    recordId: string,
    actionType: 'CREATE' | 'UPDATE' | 'DELETE',
    functionArea: string,
    oldValues?: any,
    newValues?: any,
    description?: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc('log_audit_trail', {
        p_table_name: tableName,
        p_record_id: String(recordId),
        p_action_type: actionType,
        p_function_area: functionArea,
        p_old_values: oldValues,
        p_new_values: newValues,
        p_description: description
      });

      if (error) {
        console.error('Error logging audit trail:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error logging audit trail:', error);
      return false;
    }
  };

  const logCaseAccess = async (
    tableName: string,
    recordId: string,
    description?: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc('log_case_access', {
        p_table_name: tableName,
        p_record_id: String(recordId),
        p_description: description ?? null,
      });
      if (error) {
        console.warn('Failed to log case access:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Failed to log case access:', err);
      return false;
    }
  };

  const fetchAuditLogs = async (functionArea?: string, limit: number = 100) => {
    if (!user) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (functionArea) {
        query = query.eq('function_area', functionArea);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching audit logs:', error);
        toast.error('Failed to fetch audit logs');
        return;
      }

      setAuditLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'text-green-600 bg-green-100';
      case 'UPDATE':
        return 'text-blue-600 bg-blue-100';
      case 'DELETE':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getFunctionAreaLabel = (area: string) => {
    switch (area) {
      case 'claimant':
        return 'Claimant Management';
      case 'attorney':
        return 'Attorney Management';
      case 'expert':
        return 'Medical Expert';
      case 'assessment':
        return 'Assessment Schedule';
      default:
        return area;
    }
  };

  useEffect(() => {
    if (user) {
      fetchAuditLogs();
    }
  }, [user]);

  return {
    auditLogs,
    loading,
    logAuditTrail,
    logCaseAccess,
    fetchAuditLogs,
    getActionColor,
    getFunctionAreaLabel
  };
};