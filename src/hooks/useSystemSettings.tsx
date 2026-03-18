import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: Record<string, any>;
  category: string;
  description: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useSystemSettings = (category?: string) => {
  const queryClient = useQueryClient();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['system-settings', category],
    queryFn: async () => {
      let query = supabase.from('system_settings').select('*');
      if (category) query = query.eq('category', category);
      const { data, error } = await query.order('setting_key');
      if (error) throw error;
      return (data || []) as unknown as SystemSetting[];
    },
  });

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Record<string, any> }) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ 
          setting_value: value as any, 
          updated_at: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id 
        })
        .eq('setting_key', key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      toast.success('Setting updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update setting: ' + error.message);
    },
  });

  const getSetting = (key: string): Record<string, any> | undefined => {
    return settings.find(s => s.setting_key === key)?.setting_value;
  };

  return { settings, isLoading, updateSetting, getSetting };
};

export const useRecordLocks = () => {
  const queryClient = useQueryClient();

  const { data: locks = [], isLoading } = useQuery({
    queryKey: ['record-locks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('record_locks')
        .select('*')
        .eq('is_active', true)
        .order('locked_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Array<{
        id: string;
        table_name: string;
        record_id: string;
        locked_by: string | null;
        lock_reason: string | null;
        locked_at: string;
        expires_at: string | null;
        is_active: boolean;
      }>;
    },
  });

  const lockRecord = useMutation({
    mutationFn: async ({ table_name, record_id, lock_reason }: { table_name: string; record_id: string; lock_reason: string }) => {
      const { error } = await supabase.from('record_locks').upsert({
        table_name,
        record_id,
        lock_reason,
        locked_by: (await supabase.auth.getUser()).data.user?.id,
        is_active: true,
        locked_at: new Date().toISOString(),
      } as any, { onConflict: 'table_name,record_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['record-locks'] });
      toast.success('Record locked');
    },
    onError: (e: any) => toast.error('Failed to lock: ' + e.message),
  });

  const unlockRecord = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('record_locks').update({ is_active: false } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['record-locks'] });
      toast.success('Record unlocked');
    },
    onError: (e: any) => toast.error('Failed to unlock: ' + e.message),
  });

  return { locks, isLoading, lockRecord, unlockRecord };
};
