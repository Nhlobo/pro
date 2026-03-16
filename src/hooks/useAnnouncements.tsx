import { useState, useEffect, useCallback } from 'react';
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

export const useAnnouncements = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error loading announcements', description: error.message, variant: 'destructive' });
    } else {
      setAnnouncements((data as any[]) || []);
    }
    setLoading(false);
  }, [toast]);

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
    fetchAnnouncements();
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
      fetchAnnouncements();
    }
  };

  const deleteAnnouncement = async (id: string) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Announcement deleted' });
      fetchAnnouncements();
    }
  };

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  return { announcements, loading, fetchAnnouncements, createAnnouncement, publishAnnouncement, deleteAnnouncement };
};
