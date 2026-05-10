import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useAuditTrail } from './useAuditTrail';
import { toast } from 'sonner';

interface SaveState {
  status: 'idle' | 'saving' | 'saved' | 'error' | 'offline';
  lastSaved: Date | null;
  unsavedFields: string[];
  error: string | null;
}

interface PersistenceOptions {
  tableName: string;
  recordId?: string;
  functionArea: string;
  autoSaveDelay?: number; // milliseconds
  enableLocalBackup?: boolean;
  onSaveSuccess?: (data: any) => void;
  onSaveError?: (error: Error) => void;
}

interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

const LOCAL_STORAGE_PREFIX = 'medicolegal_draft_';

export const useDataPersistence = (options: PersistenceOptions) => {
  const {
    tableName,
    recordId,
    functionArea,
    autoSaveDelay = 2000,
    enableLocalBackup = true,
    onSaveSuccess,
    onSaveError
  } = options;

  const { user } = useAuth();
  const { logAuditTrail } = useAuditTrail();
  
  const [saveState, setSaveState] = useState<SaveState>({
    status: 'idle',
    lastSaved: null,
    unsavedFields: [],
    error: null
  });
  
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [originalData, setOriginalData] = useState<Record<string, any>>({});
  const [changeHistory, setChangeHistory] = useState<FieldChange[]>([]);
  
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isOnlineRef = useRef(navigator.onLine);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true;
      setSaveState(prev => ({ ...prev, status: prev.status === 'offline' ? 'idle' : prev.status }));
      // Try to sync any pending local data
      syncLocalBackup();
    };

    const handleOffline = () => {
      isOnlineRef.current = false;
      setSaveState(prev => ({ ...prev, status: 'offline' }));
      toast.warning('You are offline. Changes will be saved locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load existing record data if recordId is provided
  useEffect(() => {
    if (recordId) {
      loadRecord();
    } else {
      // Check for local backup of draft
      loadLocalBackup();
    }
  }, [recordId]);

  // Auto-save on field changes with debounce
  useEffect(() => {
    if (saveState.unsavedFields.length === 0) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      if (isOnlineRef.current) {
        saveData();
      } else {
        saveToLocalBackup();
      }
    }, autoSaveDelay);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [formData, saveState.unsavedFields]);

  // Auto-save to local backup on unload (no confirmation popup per user request)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveState.unsavedFields.length > 0) {
        saveToLocalBackup();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveState.unsavedFields, formData]);

  const getLocalStorageKey = useCallback(() => {
    return `${LOCAL_STORAGE_PREFIX}${tableName}_${recordId || 'new'}_${user?.id || 'anon'}`;
  }, [tableName, recordId, user?.id]);

  const loadRecord = async () => {
    if (!recordId) return;

    try {
      const { data, error } = await supabase
        .from(tableName as any)
        .select('*')
        .eq('id', recordId)
        .single();

      if (error) throw error;

      if (data) {
        const recordData = data as Record<string, any>;
        setFormData(recordData);
        setOriginalData(recordData);
        setSaveState(prev => ({
          ...prev,
          lastSaved: recordData.updated_at ? new Date(recordData.updated_at) : null
        }));
      }
    } catch (error) {
      console.error('Error loading record:', error);
      toast.error('Failed to load record data');
    }
  };

  const loadLocalBackup = useCallback(() => {
    if (!enableLocalBackup) return;

    try {
      const key = getLocalStorageKey();
      const backup = localStorage.getItem(key);
      
      if (backup) {
        const parsed = JSON.parse(backup);
        setFormData(parsed.data);
        setSaveState(prev => ({
          ...prev,
          unsavedFields: Object.keys(parsed.data)
        }));
        toast.info('Recovered unsaved changes from your previous session.');
      }
    } catch (error) {
      console.error('Error loading local backup:', error);
    }
  }, [enableLocalBackup, getLocalStorageKey]);

  const saveToLocalBackup = useCallback(() => {
    if (!enableLocalBackup) return;

    try {
      const key = getLocalStorageKey();
      localStorage.setItem(key, JSON.stringify({
        data: formData,
        timestamp: new Date().toISOString(),
        tableName,
        recordId
      }));
    } catch (error) {
      console.error('Error saving to local backup:', error);
    }
  }, [enableLocalBackup, formData, getLocalStorageKey, tableName, recordId]);

  const syncLocalBackup = useCallback(async () => {
    if (!enableLocalBackup) return;

    try {
      const key = getLocalStorageKey();
      const backup = localStorage.getItem(key);
      
      if (backup) {
        const parsed = JSON.parse(backup);
        setFormData(parsed.data);
        
        // Attempt to save to database
        await saveData(parsed.data);
        
        // Clear local backup on successful sync
        localStorage.removeItem(key);
        toast.success('Synced offline changes successfully.');
      }
    } catch (error) {
      console.error('Error syncing local backup:', error);
    }
  }, [enableLocalBackup, getLocalStorageKey]);

  const clearLocalBackup = useCallback(() => {
    try {
      const key = getLocalStorageKey();
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing local backup:', error);
    }
  }, [getLocalStorageKey]);

  const updateField = useCallback((field: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Track change history
      const change: FieldChange = {
        field,
        oldValue: prev[field],
        newValue: value,
        timestamp: new Date()
      };
      
      setChangeHistory(prevHistory => [...prevHistory, change]);
      
      // Mark field as unsaved
      setSaveState(prevState => ({
        ...prevState,
        status: 'idle',
        unsavedFields: prevState.unsavedFields.includes(field)
          ? prevState.unsavedFields
          : [...prevState.unsavedFields, field]
      }));
      
      return newData;
    });
  }, []);

  const updateFields = useCallback((fields: Record<string, any>) => {
    setFormData(prev => {
      const newData = { ...prev, ...fields };
      
      // Track change history for all fields
      const changes: FieldChange[] = Object.entries(fields).map(([field, value]) => ({
        field,
        oldValue: prev[field],
        newValue: value,
        timestamp: new Date()
      }));
      
      setChangeHistory(prevHistory => [...prevHistory, ...changes]);
      
      // Mark all fields as unsaved
      setSaveState(prevState => ({
        ...prevState,
        status: 'idle',
        unsavedFields: [...new Set([...prevState.unsavedFields, ...Object.keys(fields)])]
      }));
      
      return newData;
    });
  }, []);

  const saveData = useCallback(async (dataToSave?: Record<string, any>) => {
    const data = dataToSave || formData;
    
    if (!user) {
      toast.error('You must be logged in to save data');
      return false;
    }

    if (!isOnlineRef.current) {
      saveToLocalBackup();
      return false;
    }

    setSaveState(prev => ({ ...prev, status: 'saving', error: null }));

    try {
      let result;
      const timestamp = new Date().toISOString();
      
      if (recordId) {
        // Update existing record
        const { data: updatedData, error } = await supabase
          .from(tableName as any)
          .update({ ...data, updated_at: timestamp })
          .eq('id', recordId)
          .select()
          .single();

        if (error) throw error;
        result = updatedData;

        // Log to audit trail
        await logAuditTrail(
          tableName,
          recordId,
          'UPDATE',
          functionArea,
          originalData,
          data,
          `Updated ${Object.keys(data).length} field(s)`
        );
      } else {
        // Insert new record
        const { data: insertedData, error } = await supabase
          .from(tableName as any)
          .insert({ ...data, created_at: timestamp, updated_at: timestamp })
          .select()
          .single();

        if (error) throw error;
        result = insertedData;

        // Log to audit trail
        await logAuditTrail(
          tableName,
          result.id,
          'CREATE',
          functionArea,
          null,
          data,
          'Created new record'
        );
      }

      setSaveState({
        status: 'saved',
        lastSaved: new Date(),
        unsavedFields: [],
        error: null
      });

      setOriginalData(result);
      clearLocalBackup();
      
      toast.success('Saved successfully', {
        description: `Last saved: ${new Date().toLocaleTimeString()}`
      });

      onSaveSuccess?.(result);
      return true;
    } catch (error: any) {
      console.error('Error saving data:', error);
      
      setSaveState(prev => ({
        ...prev,
        status: 'error',
        error: error.message
      }));

      // Save to local backup as fallback
      saveToLocalBackup();
      
      toast.error('Failed to save', {
        description: 'Changes saved locally. Will retry when connection is restored.'
      });

      onSaveError?.(error);
      return false;
    }
  }, [formData, recordId, tableName, functionArea, user, originalData, logAuditTrail, clearLocalBackup, saveToLocalBackup, onSaveSuccess, onSaveError]);

  const forceSave = useCallback(async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    return saveData();
  }, [saveData]);

  const resetForm = useCallback(() => {
    setFormData({});
    setOriginalData({});
    setChangeHistory([]);
    setSaveState({
      status: 'idle',
      lastSaved: null,
      unsavedFields: [],
      error: null
    });
    clearLocalBackup();
  }, [clearLocalBackup]);

  const revertChanges = useCallback(() => {
    setFormData(originalData);
    setSaveState(prev => ({
      ...prev,
      unsavedFields: [],
      status: 'idle'
    }));
    clearLocalBackup();
    toast.info('Changes reverted to last saved version.');
  }, [originalData, clearLocalBackup]);

  return {
    formData,
    setFormData: updateFields,
    updateField,
    saveState,
    changeHistory,
    saveData: forceSave,
    resetForm,
    revertChanges,
    isOnline: isOnlineRef.current,
    hasUnsavedChanges: saveState.unsavedFields.length > 0
  };
};
