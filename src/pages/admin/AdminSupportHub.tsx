// src/pages/admin/AdminSupportHub.tsx
import React, { useMemo, useState } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import {
  HeadsetIcon, Megaphone, HelpCircle, Inbox, Clock, CheckCircle2,
} from 'lucide-react';
import { useSupportTickets } from '@/hooks/useSupportTickets';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useFAQ } from '@/hooks/useFAQ';
import TicketsWorkspace from '@/components/admin/support-hub/TicketsWorkspace';
import AnnouncementsWorkspace from '@/components/admin/support-hub/AnnouncementsWorkspace';
import KnowledgeBaseWorkspace from '@/components/admin/support-hub/KnowledgeBaseWorkspace';
import {
  AdminPage,
  AdminHeader,
  AdminStatCard,
  AdminTabList,
  AdminTabTrigger,
} from '@/components/admin/ui/AdminUI';

const TABS = [
  { value: 'tickets', label: 'Tickets', icon: HeadsetIcon, Component: TicketsWorkspace },
  { value: 'announcements', label: 'Announcements', icon: Megaphone, Component: AnnouncementsWorkspace },
  { value: 'knowledge-base', label: 'Knowledge Base', icon: HelpCircle, Component: KnowledgeBaseWorkspace },
] as const;

type TabValue = (typeof TABS)[number]['value'];

/**
 * Support & Communications command center.
 *
 * Previous structure: three tabs, each mounting its own manager component
 * that only fetched its own data once selected — there was no way to see
 * "how's support doing" without clicking through every tab.
 *
 * New structure: an overview strip reads from all three domains up front
 * (tickets, announcements, FAQ — each still its own react-query-backed
 * hook, so this doesn't add any new Supabase calls beyond what the tabs
 * already made) and gives a single at-a-glance status line. The tabs below
 * are now workspaces — search/filter toolbars + the actual list — instead
 * of bare managers, and the ticket list is virtualized so the page stays
 * fast regardless of ticket volume.
 */
const AdminSupportHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabValue>('tickets');

  const { tickets } = useSupportTickets();
  const { announcements } = useAnnouncements();
  const { articles } = useFAQ();

  const overview = useMemo(() => {
    const open = tickets.filter(t => t.status === 'open').length;
    const inProgress = tickets.filter(t => t.status === 'in_progress').length;
    const resolved = tickets.filter(t => t.status === 'resolved').length;
    const published = announcements.filter(a => a.is_published).length;
    return { open, inProgress, resolved, published };
  }, [tickets, announcements]);

  return (
    <AdminPage className="max-w-7xl">
      <AdminHeader
        eyebrow="Support"
        title="Support & Communications Hub"
        description="Manage tickets, announcements, and the shared knowledge base for experts and attorneys"
        icon={HeadsetIcon}
      />

      {/* Cross-domain overview strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminStatCard label="Open Tickets" value={overview.open} icon={Inbox} />
        <AdminStatCard label="In Progress" value={overview.inProgress} icon={Clock} />
        <AdminStatCard label="Resolved" value={overview.resolved} icon={CheckCircle2} />
        <AdminStatCard
          label="Published Announcements"
          value={overview.published}
          icon={Megaphone}
          hint={`${articles.length} FAQ article${articles.length === 1 ? '' : 's'} in the knowledge base`}
        />
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
        <AdminTabList sticky columns={TABS.length}>
          {TABS.map((t) => (
            <AdminTabTrigger key={t.value} value={t.value} label={t.label} icon={t.icon} center />
          ))}
        </AdminTabList>

        <div className="mt-4">
          {TABS.map((t) => {
            const Component = t.Component;
            return (
              <TabsContent key={t.value} value={t.value} className="mt-0 focus-visible:outline-none">
                <Component />
              </TabsContent>
            );
          })}
        </div>
      </Tabs>
    </AdminPage>
  );
};

export default AdminSupportHub;
