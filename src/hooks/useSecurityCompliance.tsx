import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';

interface SecurityEventData {
  eventType: string;
  resourceType: string;
  action: string;
  resourceId?: string;
  details?: any;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export const useSecurityCompliance = () => {
  const { isAdmin } = usePermissions();
  const [loading, setLoading] = useState(false);

  // Log security events with proper validation
  const logSecurityEvent = useCallback(async (eventData: SecurityEventData) => {
    if (!isAdmin()) {
      console.warn('Attempted to log security event without admin privileges');
      return false;
    }

    try {
      const { data, error } = await supabase.rpc('log_security_event', {
        p_event_type: eventData.eventType,
        p_resource_type: eventData.resourceType,
        p_action: eventData.action,
        p_resource_id: eventData.resourceId || null,
        p_details: eventData.details || null,
        p_risk_level: eventData.riskLevel || 'low'
      });

      if (error) {
        console.error('Error logging security event:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Security event logging failed:', error);
      return false;
    }
  }, [isAdmin]);

  // Check data retention compliance
  const checkDataRetention = useCallback(async () => {
    if (!isAdmin()) {
      toast.error('Admin privileges required');
      return null;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc('check_data_retention_compliance');
      
      if (error) {
        console.error('Error checking compliance:', error);
        toast.error('Failed to check data retention compliance');
        return null;
      }

      // Log the compliance check
      await logSecurityEvent({
        eventType: 'compliance_audit',
        resourceType: 'system',
        action: 'data_retention_check',
        details: { results_count: data?.length || 0 },
        riskLevel: 'low'
      });

      return data;
    } catch (error) {
      console.error('Compliance check failed:', error);
      toast.error('Data retention check failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAdmin, logSecurityEvent]);

  // Validate PII access for a specific user
  const validatePIIAccess = useCallback(async (targetUserId: string, dataType: string) => {
    try {
      const { data, error } = await supabase.rpc('can_access_pii', {
        target_user_id: targetUserId,
        data_type: dataType
      });

      if (error) {
        console.error('Error validating PII access:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('PII access validation failed:', error);
      return false;
    }
  }, []);

  // Get secure user data with proper masking
  const getSecureUserData = useCallback(async () => {
    if (!isAdmin()) {
      toast.error('Admin privileges required');
      return null;
    }

    try {
      // Use existing function to get referring attorneys list securely
      const { data, error } = await supabase.rpc('get_referring_attorneys_list');
      
      if (error) {
        console.error('Error fetching secure data:', error);
        toast.error('Failed to load secure data');
        return null;
      }

      // Log the secure data access
      await logSecurityEvent({
        eventType: 'admin_data_access',
        resourceType: 'law_firms',
        action: 'secure_data_list_access',
        details: { record_count: Array.isArray(data) ? data.length : 0 },
        riskLevel: 'medium'
      });

      return data;
    } catch (error) {
      console.error('Secure data fetch failed:', error);
      toast.error('Failed to load secure data');
      return null;
    }
  }, [isAdmin, logSecurityEvent]);

  // Mask sensitive data for display
  const maskSensitiveData = useCallback(async (dataType: string, originalValue: string, accessLevel = 'basic') => {
    try {
      const { data, error } = await supabase.rpc('mask_pii_data', {
        data_type: dataType,
        original_value: originalValue,
        access_level: accessLevel
      });

      if (error) {
        console.error('Error masking data:', error);
        return '[PROTECTED DATA]';
      }

      return data || '[PROTECTED DATA]';
    } catch (error) {
      console.error('Data masking failed:', error);
      return '[PROTECTED DATA]';
    }
  }, []);

  // Validate user role securely
  const validateUserRole = useCallback(async (requiredRole: string) => {
    try {
      const { data, error } = await supabase.rpc('check_user_role', {
        required_role: requiredRole
      });

      if (error) {
        console.error('Error validating user role:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Role validation failed:', error);
      return false;
    }
  }, []);

  return {
    loading,
    logSecurityEvent,
    checkDataRetention,
    validatePIIAccess,
    getSecureUserData,
    maskSensitiveData,
    validateUserRole
  };
};