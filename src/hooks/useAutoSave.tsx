import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useAuditTrail } from './useAuditTrail';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';
import { toast } from 'sonner';

interface AutoSaveOptions {
  tableName: string;
  recordId: string;
  functionArea: string;
  debounceMs?: number;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
}

interface AutoSaveState {
  isSaving: boolean;
  lastSaved: Date | null;
  pendingChanges: Record<string, any>;
  error: string | null;
}

export const useAutoSave = (options: AutoSaveOptions) => {
  const {
    tableName,
    recordId,
    functionArea,
    debounceMs = 1500,
    onSaveSuccess,
    onSaveError
  } = options;

  const { user } = useAuth();
  const { logAuditTrail } = useAuditTrail();
  const { triggerSync } = useAppointmentSync();
  
  const [state, setState] = useState<AutoSaveState>({
    isSaving: false,
    lastSaved: null,
    pendingChanges: {},
    error: null
  });
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const originalDataRef = useRef<Record<string, any>>({});

  // Clear pending debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const setOriginalData = useCallback((data: Record<string, any>) => {
    originalDataRef.current = { ...data };
  }, []);

  const saveChanges = useCallback(async (changes: Record<string, any>) => {
    if (!user || !recordId || Object.keys(changes).length === 0) {
      return false;
    }

    setState(prev => ({ ...prev, isSaving: true, error: null }));

    try {
      const { error } = await supabase
        .from(tableName as any)
        .update({
          ...changes,
          updated_at: new Date().toISOString()
        })
        .eq('id', recordId);

      if (error) throw error;

      // Log to audit trail
      await logAuditTrail(
        tableName,
        recordId,
        'UPDATE',
        functionArea,
        originalDataRef.current,
        { ...originalDataRef.current, ...changes },
        `Auto-saved ${Object.keys(changes).length} field(s)`
      );

      // Update original data reference
      originalDataRef.current = { ...originalDataRef.current, ...changes };

      setState(prev => ({
        ...prev,
        isSaving: false,
        lastSaved: new Date(),
        pendingChanges: {},
        error: null
      }));

      // Trigger global sync for real-time updates
      triggerSync();
      
      onSaveSuccess?.();
      return true;
    } catch (error: any) {
      console.error('Auto-save error:', error);
      
      setState(prev => ({
        ...prev,
        isSaving: false,
        error: error.message
      }));

      toast.error('Auto-save failed', {
        description: error.message
      });

      onSaveError?.(error);
      return false;
    }
  }, [user, recordId, tableName, functionArea, logAuditTrail, triggerSync, onSaveSuccess, onSaveError]);

  const queueChange = useCallback((field: string, value: any) => {
    setState(prev => ({
      ...prev,
      pendingChanges: {
        ...prev.pendingChanges,
        [field]: value
      }
    }));

    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new debounce
    debounceRef.current = setTimeout(() => {
      setState(prev => {
        if (Object.keys(prev.pendingChanges).length > 0) {
          saveChanges(prev.pendingChanges);
        }
        return prev;
      });
    }, debounceMs);
  }, [debounceMs, saveChanges]);

  const queueChanges = useCallback((changes: Record<string, any>) => {
    setState(prev => ({
      ...prev,
      pendingChanges: {
        ...prev.pendingChanges,
        ...changes
      }
    }));

    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new debounce
    debounceRef.current = setTimeout(() => {
      setState(prev => {
        if (Object.keys(prev.pendingChanges).length > 0) {
          saveChanges(prev.pendingChanges);
        }
        return prev;
      });
    }, debounceMs);
  }, [debounceMs, saveChanges]);

  const forceSave = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (Object.keys(state.pendingChanges).length > 0) {
      return saveChanges(state.pendingChanges);
    }
    return true;
  }, [state.pendingChanges, saveChanges]);

  const clearPendingChanges = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setState(prev => ({ ...prev, pendingChanges: {} }));
  }, []);

  return {
    isSaving: state.isSaving,
    lastSaved: state.lastSaved,
    pendingChanges: state.pendingChanges,
    hasPendingChanges: Object.keys(state.pendingChanges).length > 0,
    error: state.error,
    queueChange,
    queueChanges,
    forceSave,
    clearPendingChanges,
    setOriginalData
  };
};
