// src/hooks/useStaffNotifications.tsx
//
// INTERNAL STAFF notifications only — admin/employee. Deliberately
// separate from useNotifications.tsx (attorney/expert portal), so
// there is no shared hook, shared in-memory state, or shared realtime
// channel that a staff session and a portal session could ever
// collide on, however they're navigated between in the same browser.
//
// Beyond the RLS policy on `notifications` (`auth.uid() = user_id`,
// already correct and unchanged), this hook adds an explicit,
// redundant role check before ever rendering a result: it confirms
// the CURRENT session's own profile is actually admin/employee before
// trusting the fetched rows. RLS alone already prevents one user's
// auth.uid() from reading another user's row — this check exists for
// defense in depth against a different failure mode entirely: a
// stale/cached `user` reference in React state referring to the
// WRONG account after a fast account switch in the same tab. Re-
// confirming both identity (auth.getUser()) and role, fresh, at fetch
// time closes that off regardless of root cause.
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Notification } from '@/hooks/useNotifications';

export const useStaffNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const initialFetchDone = useRef(false);
  const fetchedForUserId = useRef<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData?.user?.id;
    if (!currentUserId) return;

    try {
      // Explicit, fresh role check — see module comment. Fails closed:
      // if this can't confirm staff, nothing is shown, rather than
      // falling through to "show whatever the query returns."
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, user_type')
        .eq('id', currentUserId)
        .single();

      if (profileError) throw profileError;

      const isStaff = profile?.user_type === 'admin'
        || profile?.role === 'admin'
        || profile?.role === 'employee';

      if (!isStaff) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const { data: recheckAuth } = await supabase.auth.getUser();
      if (recheckAuth?.user?.id !== currentUserId) return;

      const typedData = (data || []).map(n => ({
        ...n,
        type: n.type as 'info' | 'success' | 'warning' | 'error'
      }));

      setNotifications(typedData);
      setUnreadCount(typedData.filter(n => !n.is_read).length);
      fetchedForUserId.current = currentUserId;
      initialFetchDone.current = true;
    } catch (error) {
      console.error('Error fetching staff notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking staff notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all staff notifications as read:', error);
    }
  };

  useEffect(() => {
    if (fetchedForUserId.current !== null && fetchedForUserId.current !== (user?.id ?? null)) {
      setNotifications([]);
      setUnreadCount(0);
      initialFetchDone.current = false;
      fetchedForUserId.current = null;
    }

    if (!user?.id) {
      setLoading(false);
      return;
    }

    fetchNotifications();

    const channel = supabase
      .channel(`staff-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotification = {
            ...payload.new,
            type: payload.new.type as 'info' | 'success' | 'warning' | 'error'
          } as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications
  };
};
