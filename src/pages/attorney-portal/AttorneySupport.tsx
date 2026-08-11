import React, { useState, useEffect } from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Bell, Calendar, FileText, CreditCard, AlertCircle,
  CheckCircle2, Clock, Mail, Eye, FileWarning
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { BRAND_TEAL } from '@/components/admin/ui/AdminUI';
import {
  PortalPage,
  PortalHeader,
  SyncStatus,
  PortalStatStrip,
  PortalCard,
  PortalCardHeader,
  PortalCardBody,
  PortalPill,
  PortalEmptyState,
  PortalLoadingState,
} from '@/components/attorney-portal/ui/PortalPrimitives';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string | null;
  is_read: boolean;
  created_at: string;
  related_table: string | null;
  related_record_id: string | null;
}

type NotificationsTab = 'all' | 'unread' | 'reports' | 'invoices' | 'missing_docs';

const AttorneyNotifications: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<NotificationsTab>('all');

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const cleanup = subscribeToNotifications();
      return cleanup;
    }
  }, [user]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (data) setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToNotifications = () => {
    const channel = supabase
      .channel('notifications-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user?.id}`
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user?.id)
      .eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const getNotificationIcon = (type: string, category: string | null) => {
    if (category === 'report_ready' || type.includes('report_ready')) return <FileText className="h-4 w-4 text-success" />;
    if (category === 'report' || type.includes('report')) return <FileText className="h-4 w-4" style={{ color: BRAND_TEAL }} />;
    if (category === 'invoice' || type.includes('invoice')) return <CreditCard className="h-4 w-4" style={{ color: BRAND_TEAL }} />;
    if (category === 'missing_document' || type.includes('missing')) return <FileWarning className="h-4 w-4 text-destructive" />;
    if (category === 'appointment' || type.includes('appointment')) return <Calendar className="h-4 w-4" style={{ color: BRAND_TEAL }} />;
    if (category === 'payment' || type.includes('payment')) return <CreditCard className="h-4 w-4 text-success" />;
    if (type === 'alert' || type === 'warning') return <AlertCircle className="h-4 w-4 text-warning" />;
    return <Bell className="h-4 w-4 text-slate-400" />;
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !n.is_read;
    if (activeTab === 'reports') return n.category === 'report' || n.category === 'report_ready' || n.type.includes('report');
    if (activeTab === 'invoices') return n.category === 'invoice' || n.category === 'payment' || n.type.includes('invoice') || n.type.includes('payment');
    if (activeTab === 'missing_docs') return n.category === 'missing_document' || n.type.includes('missing');
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const reportCount = notifications.filter(n => n.category === 'report' || n.category === 'report_ready' || n.type.includes('report')).length;
  const invoiceCount = notifications.filter(n => n.category === 'invoice' || n.category === 'payment' || n.type.includes('invoice') || n.type.includes('payment')).length;
  const missingDocCount = notifications.filter(n => n.category === 'missing_document' || n.type.includes('missing')).length;

  const TAB_ITEMS: { key: NotificationsTab; label: string; badge?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread', badge: unreadCount },
    { key: 'reports', label: 'Reports' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'missing_docs', label: 'Missing Docs' },
  ];

  return (
    <AttorneyPortalLayout>
      <PortalPage>
        <PortalHeader
          eyebrow="Attorney Portal"
          title="Notifications"
          description="Report readiness, invoices, and missing document alerts"
          icon={Bell}
          actions={
            <>
              <SyncStatus loading={loading} onRefresh={fetchNotifications} label="Live data" />
              {unreadCount > 0 && (
                <Button variant="outline" className="rounded-none gap-2" onClick={markAllAsRead}>
                  <CheckCircle2 className="h-4 w-4" />
                  Mark All as Read
                </Button>
              )}
            </>
          }
        />

        {/* KPI ledger — one bordered panel, matches Dashboard/My Cases/Appointments/Case Status/Reports/Payments/Agreements */}
        <PortalStatStrip
          loading={loading}
          className="sm:grid-cols-5 lg:grid-cols-5"
          tiles={[
            { label: 'Total', value: notifications.length, icon: Bell },
            { label: 'Unread', value: unreadCount, icon: Mail, urgent: unreadCount > 0 },
            { label: 'Reports', value: reportCount, icon: FileText },
            { label: 'Invoices', value: invoiceCount, icon: CreditCard },
            { label: 'Missing Docs', value: missingDocCount, icon: FileWarning, urgent: missingDocCount > 0 },
          ]}
        />

        {/* Tabs — flat underline style, matches the rest of the portal */}
        <div className="flex flex-wrap gap-1 border-b border-black/10">
          {TAB_ITEMS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors',
                activeTab === t.key
                  ? 'border-[#00BAAD] text-[#00BAAD]'
                  : 'border-transparent text-slate-500 hover:text-black'
              )}
            >
              {t.label}
              {!!t.badge && <PortalPill tone="destructive" className="px-1.5 py-0">{t.badge}</PortalPill>}
            </button>
          ))}
        </div>

        <PortalCard>
          <PortalCardHeader icon={Bell} title="Notifications" description={`${filteredNotifications.length} notification(s) in view`} />
          <PortalCardBody className={loading || filteredNotifications.length === 0 ? 'p-0' : undefined}>
            {loading ? (
              <PortalLoadingState label="Loading notifications…" />
            ) : filteredNotifications.length === 0 ? (
              <PortalEmptyState icon={Bell} title="No notifications found" />
            ) : (
              <div className="max-h-[500px] space-y-2 overflow-y-auto">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'border px-4 py-3 transition-colors',
                      notification.is_read ? 'border-black/10 bg-black/[0.015]' : 'border-[#00BAAD]/30 bg-[#00BAAD]/5'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center border border-black/10 bg-white">
                        {getNotificationIcon(notification.type, notification.category)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-sm font-medium text-black">
                              {notification.title}
                            </h4>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {notification.message}
                            </p>
                          </div>
                          {!notification.is_read && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 rounded-none"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span className="text-[11px] text-slate-500">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                          {!notification.is_read && <PortalPill tone="teal">New</PortalPill>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PortalCardBody>
        </PortalCard>
      </PortalPage>
    </AttorneyPortalLayout>
  );
};

export default AttorneyNotifications;
