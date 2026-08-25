// src/hooks/useNotifications.tsx
//
// PORTAL notifications only — attorney and expert. Internal staff use
// the separate useStaffNotifications.tsx hook. Kept deliberately
// separate rather than one shared hook serving both contexts, so a
// staff session and a portal session can never share any in-memory
// state, cache, or realtime channel with each other, however they're
// navigated between in the same browser.
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category?: string;
  related_record_id?: string;
  related_table?: string;
  is_read: boolean;
  email_sent: boolean;
  created_at: string;
  read_at?: string;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { isPageLocked, isActiveTab } = useAppointmentSync();
  const initialFetchDone = useRef(false);
  // Tracks whose data is currently in state, so a stale-closure fetch
  // that resolves after the user has already changed (e.g. a fast
  // logout/login in the same tab) can never overwrite the new user's
  // notifications with the previous user's results.
  const fetchedForUserId = useRef<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    // Never trust a potentially-stale `user` object from context alone
    // for whose data to query — re-confirm against Supabase directly
    // at the moment of the fetch. This is the concrete fix for
    // "the bell shows the previous session's notifications": if
    // `user` from useAuth() hasn't finished updating yet after an
    // account switch, this still queries (and only accepts results
    // for) the actual current session, not a cached reference.
    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData?.user?.id;
    if (!currentUserId) return;

    // Don't refetch if page is locked (user is actively working)
    if (isPageLocked && initialFetchDone.current) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // If the session changed again while this request was in
      // flight, discard the result rather than applying stale data.
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
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [isPageLocked]);

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
      console.error('Error marking notification as read:', error);
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
      console.error('Error marking all notifications as read:', error);
    }
  };

  useEffect(() => {
    // Whenever the logged-in user changes (including going from "some
    // user" to "no user" on logout), immediately clear whatever was
    // in state — never leave a previous session's notifications
    // visible even for the brief window before the new fetch resolves.
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

    if (!initialFetchDone.current || (isActiveTab && !isPageLocked)) {
      fetchNotifications();
    }

    // Channel name scoped to this specific user's id — a shared,
    // generic channel name across every mounted instance of this hook
    // (staff, attorney, expert, all layouts) was a real latent risk:
    // if a previous instance's cleanup ever ran even slightly late
    // during a fast client-side navigation/account switch, a
    // same-named channel from the new instance could subscribe before
    // the old one fully released, and event delivery isn't guaranteed
    // to respect component boundaries the way state is.
    const channel = supabase
      .channel(`portal-notifications-${user.id}`)
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
  }, [user?.id, isActiveTab, isPageLocked, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications
  };
};
