import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell, FileText, ClipboardCheck, Activity, Loader2 } from 'lucide-react';
import { usePortalNotifications } from '@/hooks/externalPortal/useExternalPortalEngagement';
import { useExternalPortalSession } from '@/hooks/externalPortal/useExternalPortalSession';
import { formatDateTimeShort } from '@/utils/dateTime';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  document: FileText,
  report: ClipboardCheck,
  progress: Activity,
};

/**
 * Phase 5 — portal notification bell, shared by both portal shells.
 * The feed is derived server-side from live case data.
 */
const PortalNotificationBell: React.FC = () => {
  const { notifications, unreadCount, isLoading, markAllRead } = usePortalNotifications();
  const { session } = useExternalPortalSession();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);

  const basePath = session?.portal_type === 'attorney' ? '/external-portal/attorney/cases' : '/external-portal/expert/cases';

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && unreadCount > 0) markAllRead();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative rounded-none border-black/15" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-2 -top-2 h-5 min-w-5 justify-center rounded-full bg-[#00BAAD] px-1 text-[10px] text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] rounded-none p-0">
        <div className="flex items-center justify-between border-b border-black/10 px-3 py-2">
          <p className="text-sm font-semibold text-black">Notifications</p>
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" className="h-auto rounded-none px-1 text-xs" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading && (
            <p className="flex items-center gap-2 px-3 py-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          )}

          {!isLoading && notifications.length === 0 && (
            <p className="px-3 py-6 text-sm text-slate-500">You're all caught up.</p>
          )}

          {notifications.map((n) => {
            const Icon = ICONS[n.category] || Bell;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  markAllRead();
                  navigate(`${basePath}/${n.appointment_id}`);
                }}
                className={`flex w-full gap-2 border-b border-black/5 px-3 py-2.5 text-left hover:bg-slate-50 ${
                  n.is_read ? '' : 'bg-[#00BAAD]/5'
                }`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#00BAAD]" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-black">{n.title}</span>
                  <span className="block break-words text-xs text-slate-500">{n.message}</span>
                  <span className="block text-[11px] text-slate-400">{formatDateTimeShort(n.occurred_at)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default PortalNotificationBell;
