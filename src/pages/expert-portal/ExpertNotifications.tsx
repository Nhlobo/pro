import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExpertNotLinkedState } from '@/components/portal/ExpertNotLinkedState';
import { useExpertLinkStatus } from '@/hooks/useExpertLinkStatus';
import { useNotifications, Notification as PortalNotification } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Bell, Calendar, FileText, CreditCard, AlertCircle,
  CheckCircle2, Clock, Mail, Eye, FileWarning
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getNotificationRoute } from '@/lib/notificationRouting';
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

/**
 * Expert Portal — Notifications.
 *
 * Same page AttorneyNotifications.tsx is — the bell in the header
 * (NotificationCenter) is only a quick popover; this is the full list
 * with filtering, a "mark all as read" action, and a KPI strip, reached
 * from the sidebar the same way the Attorney Portal's is. Previously
 * this page didn't exist for the Expert Portal at all, so an expert
 * could see the bell but had nowhere to go for the full history.
 *
 * Renders inside ExpertPortalRoute, which already wraps every
 * /expert-portal/* route in ExpertPortalLayout — do not wrap in the
 * layout here too.
 */

type Notification = PortalNotification;

type NotificationsTab = 'all' | 'unread' | 'reports' | 'payments' | 'missing_docs';

const ExpertNotifications: React.FC = () => {
  const linkStatus = useExpertLinkStatus();
  const navigate = useNavigate();
  const {
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  } = useNotifications();
  const [activeTab, setActiveTab] = useState<NotificationsTab>('all');

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) markAsRead(notification.id);
    const route = getNotificationRoute(notification, 'expert');
    if (route) navigate(route);
  };

  const getNotificationIcon = (type: string, category: string | null) => {
    if (category === 'report_ready' || type.includes('report_ready')) return <FileText className="h-4 w-4 text-success" />;
    if (category === 'report' || type.includes('report')) return <FileText className="h-4 w-4" style={{ color: BRAND_TEAL }} />;
    if (category === 'payment' || type.includes('payment')) return <CreditCard className="h-4 w-4 text-success" />;
    if (category === 'missing_document' || type.includes('missing')) return <FileWarning className="h-4 w-4 text-destructive" />;
    if (category === 'appointment' || type.includes('appointment')) return <Calendar className="h-4 w-4" style={{ color: BRAND_TEAL }} />;
    if (type === 'alert' || type === 'warning') return <AlertCircle className="h-4 w-4 text-warning" />;
    return <Bell className="h-4 w-4 text-slate-400" />;
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !n.is_read;
    if (activeTab === 'reports') return n.category === 'report' || n.category === 'report_ready' || n.type.includes('report');
    if (activeTab === 'payments') return n.category === 'payment' || n.type.includes('payment');
    if (activeTab === 'missing_docs') return n.category === 'missing_document' || n.type.includes('missing');
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const reportCount = notifications.filter(n => n.category === 'report' || n.category === 'report_ready' || n.type.includes('report')).length;
  const paymentCount = notifications.filter(n => n.category === 'payment' || n.type.includes('payment')).length;
  const missingDocCount = notifications.filter(n => n.category === 'missing_document' || n.type.includes('missing')).length;

  const TAB_ITEMS: { key: NotificationsTab; label: string; badge?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread', badge: unreadCount },
    { key: 'reports', label: 'Reports' },
    { key: 'payments', label: 'Payments' },
    { key: 'missing_docs', label: 'Missing Docs' },
  ];

  if (linkStatus === 'checking') {
    return (
      <PortalPage>
        <PortalHeader eyebrow="Expert Portal" title="Notifications" icon={Bell} />
        <PortalLoadingState label="Checking your account…" />
      </PortalPage>
    );
  }

  if (linkStatus === 'not_linked') {
    return (
      <PortalPage>
        <PortalHeader eyebrow="Expert Portal" title="Notifications" icon={Bell} />
        <ExpertNotLinkedState description="Your account is not linked to a medical expert profile, so there's nothing to show here. Contact an administrator or get help below." />
      </PortalPage>
    );
  }

  return (
    <PortalPage>
      <PortalHeader
        eyebrow="Expert Portal"
        title="Notifications"
        description="Report readiness, payments, and missing document alerts"
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

      <PortalStatStrip
        loading={loading}
        className="sm:grid-cols-5 lg:grid-cols-5"
        tiles={[
          { label: 'Total', value: notifications.length, icon: Bell },
          { label: 'Unread', value: unreadCount, icon: Mail, urgent: unreadCount > 0 },
          { label: 'Reports', value: reportCount, icon: FileText },
          { label: 'Payments', value: paymentCount, icon: CreditCard },
          { label: 'Missing Docs', value: missingDocCount, icon: FileWarning, urgent: missingDocCount > 0 },
        ]}
      />

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
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'cursor-pointer border px-4 py-3 transition-colors hover:border-black/25',
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
                            onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
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
  );
};

export default ExpertNotifications;
