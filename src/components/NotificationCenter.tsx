import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Check, CheckCheck, AlertCircle, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { GlassBackdrop } from '@/components/ui/glass-backdrop';
import { formatDistanceToNow } from 'date-fns';

type Portal = 'admin' | 'attorney' | 'expert';

// Which portal the bell is currently open in — the NotificationCenter is
// shared across all three layouts, so the same notification has to land
// on a different page depending on where it was clicked. Previously this
// always resolved to the internal /admin/* routes, so an attorney or
// expert clicking a notification got sent to a page their own account
// isn't linked/permissioned for, which is what produced the "opens the
// real page, then bounces back" glitch.
const getPortalFromPath = (pathname: string): Portal => {
  if (pathname.startsWith('/attorney-portal')) return 'attorney';
  if (pathname.startsWith('/expert-portal')) return 'expert';
  return 'admin';
};

// Map a notification to the page that should open when the user clicks
// it, resolved per-portal. Prefers related_table when available, falls
// back to category. Returns null when there's no sensible destination
// in the current portal (e.g. an admin-only page) — the bell still marks
// the notification read, it just doesn't navigate anywhere.
const getNotificationRoute = (n: Notification, portal: Portal): string | null => {
  const id = n.related_record_id;
  const key = n.related_table || n.category;

  switch (key) {
    case 'appointments':
    case 'appointment':
      if (portal === 'admin') return '/admin/appointments';
      if (portal === 'attorney') return '/attorney-portal/appointments';
      if (portal === 'expert') return '/expert-portal/schedule';
      return null;
    case 'appointment_requests':
    case 'appointment_request':
      if (portal === 'admin') return '/appointment-request-dashboard';
      if (portal === 'attorney') return '/attorney-portal/appointments';
      if (portal === 'expert') return '/expert-portal/schedule';
      return null;
    case 'referring_attorneys':
    case 'attorney':
      if (portal === 'admin') return id ? `/referring-attorney/${id}` : '/admin/attorney-crm';
      if (portal === 'attorney') return '/attorney-portal';
      return null;
    case 'claimants':
      if (portal === 'admin') return '/claimant-list';
      if (portal === 'attorney') return '/attorney-portal/cases';
      if (portal === 'expert') return '/expert-portal/cases';
      return null;
    case 'expert_reports':
    case 'reports':
    case 'report':
      if (portal === 'admin') return '/admin/reports';
      if (portal === 'attorney') return '/attorney-portal/reports';
      if (portal === 'expert') return '/expert-portal/reports';
      return null;
    case 'documents':
    case 'aod_documents':
    case 'document':
      if (portal === 'admin') return '/admin/documents';
      if (portal === 'attorney') return '/attorney-portal/agreements';
      return null;
    case 'payments':
    case 'aod_payments':
    case 'payment':
      if (portal === 'admin') return '/admin/finance';
      if (portal === 'attorney') return '/attorney-portal/payments';
      return null;
    case 'support_tickets':
      if (portal === 'admin') return '/admin/support';
      if (portal === 'attorney') return '/attorney-portal/support';
      if (portal === 'expert') return '/expert-portal/support';
      return null;
    case 'pitchlog_followup':
      return portal === 'admin' ? '/attorney-pitchlog' : null;
    case 'email_queue':
      return portal === 'admin' ? '/email-queue' : null;
    default:
      return null;
  }
};


const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    default:
      return <Info className="h-4 w-4 text-kutlwano-blue" />;
  }
};

const getCategoryBadge = (category?: string) => {
  if (!category) return null;
  
  const colors: Record<string, string> = {
    'appointment': 'bg-kutlwano-blue/10 text-kutlwano-blue',
    'appointment_request': 'bg-indigo-500/10 text-indigo-600',
    'attorney': 'bg-emerald-500/10 text-emerald-600',
    'report': 'bg-success/10 text-success',
    'document': 'bg-warning/10 text-warning',
    'payment': 'bg-purple-500/10 text-purple-500',
    'pitchlog_followup': 'bg-orange-500/10 text-orange-600',
    'email_queue': 'bg-destructive/10 text-destructive',
  };

  return (
    <Badge variant="outline" className={`text-xs ${colors[category] || ''}`}>
      {category}
    </Badge>
  );
};

export const NotificationCenter: React.FC = () => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) markAsRead(notification.id);
    const portal = getPortalFromPath(location.pathname);
    const route = getNotificationRoute(notification, portal);
    if (route) {
      setOpen(false);
      navigate(route);
    }
  };

  return (
    <>
      <GlassBackdrop show={open} onClick={() => setOpen(false)} zIndex={40} />
      <Popover open={open} onOpenChange={setOpen}>

      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-destructive text-destructive-foreground text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs">
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                    !notification.is_read ? 'bg-muted/30' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}

                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm font-medium truncate ${
                          !notification.is_read ? 'text-foreground' : 'text-muted-foreground'
                        }`}>
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <div className="h-2 w-2 rounded-full bg-kutlwano-blue flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {getCategoryBadge(notification.category || undefined)}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
      </Popover>
    </>
  );
};
