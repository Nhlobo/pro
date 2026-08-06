import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  target_audience: string;
  priority: string;
  is_published: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const ANNOUNCEMENTS_KEY = ['announcements'] as const;

// Hard ceiling on any one request. Without it a stalled fetch leaves the
// Support Hub spinning on "Loading announcements…" forever.
const REQUEST_TIMEOUT_MS = 20_000;
const ROW_CAP = 500;

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error('Request timed out')), ms);
  return controller.signal;
}

/**
 * Announcements data layer. Backed by react-query so the Support Hub
 * overview strip and the Announcements workspace share one cache/one
 * request, with a bounded timeout and a real error surface instead of a
 * silent empty list.
 */
export const useAnnouncements = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading: loading, error, refetch } = useQuery({
    queryKey: ANNOUNCEMENTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .range(0, ROW_CAP - 1)
        .abortSignal(timeoutSignal(REQUEST_TIMEOUT_MS));

      if (error) throw error;
      return (data as unknown as Announcement[]) || [];
    },
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY });
  }, [queryClient]);

  const fetchAnnouncements = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const createAnnouncement = async (announcement: { title: string; content: string; target_audience: string; priority: string }) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('announcements')
      .insert({ ...announcement, created_by: user.id } as any)
      .select()
      .single();

    if (error) {
      toast({ title: 'Error creating announcement', description: error.message, variant: 'destructive' });
      return null;
    }
    toast({ title: 'Announcement created' });
    invalidate();
    return data;
  };

  const publishAnnouncement = async (id: string, publish: boolean) => {
    const updates: any = { is_published: publish, updated_at: new Date().toISOString() };
    if (publish) updates.published_at = new Date().toISOString();

    const { error } = await supabase.from('announcements').update(updates).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: publish ? 'Announcement published' : 'Announcement unpublished' });
      invalidate();
    }
  };

  const deleteAnnouncement = async (id: string) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Announcement deleted' });
      invalidate();
    }
  };

  return {
    announcements: data || [],
    loading,
    error: error as Error | null,
    fetchAnnouncements,
    createAnnouncement,
    publishAnnouncement,
    deleteAnnouncement,
  };
};
