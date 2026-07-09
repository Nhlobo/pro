// src/pages/admin/AdminSupportHub.tsx
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HeadsetIcon, Megaphone, HelpCircle } from 'lucide-react';
import AdminTicketManager from '@/components/support/AdminTicketManager';
import AdminAnnouncementManager from '@/components/support/AdminAnnouncementManager';
import AdminFAQManager from '@/components/support/AdminFAQManager';
import { AdminPage, AdminHeader } from '@/components/admin/ui/AdminUI';

const AdminSupportHub: React.FC = () => {
  return (
    <AdminPage>
      <AdminHeader
        eyebrow="Support"
        title="Support & Communications Hub"
        description="Manage tickets, announcements, and FAQ for experts and attorneys"
      />

      <Tabs defaultValue="tickets" className="w-full">
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <TabsList className="flex h-auto w-max min-w-full gap-1 rounded-none border border-black/10 bg-white p-1 sm:w-full sm:max-w-md">
            <TabsTrigger value="tickets" className="flex shrink-0 items-center gap-1.5 rounded-none px-3 py-2 text-xs data-[state=active]:bg-black data-[state=active]:text-white sm:text-sm">
              <HeadsetIcon className="h-4 w-4 flex-shrink-0" /> <span>Tickets</span>
            </TabsTrigger>
            <TabsTrigger value="announcements" className="flex shrink-0 items-center gap-1.5 rounded-none px-3 py-2 text-xs data-[state=active]:bg-black data-[state=active]:text-white sm:text-sm">
              <Megaphone className="h-4 w-4 flex-shrink-0" /> <span>Announcements</span>
            </TabsTrigger>
            <TabsTrigger value="faq" className="flex shrink-0 items-center gap-1.5 rounded-none px-3 py-2 text-xs data-[state=active]:bg-black data-[state=active]:text-white sm:text-sm">
              <HelpCircle className="h-4 w-4 flex-shrink-0" /> <span>FAQ</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-4">
          <TabsContent value="tickets">
            <AdminTicketManager />
          </TabsContent>
          <TabsContent value="announcements">
            <AdminAnnouncementManager />
          </TabsContent>
          <TabsContent value="faq">
            <AdminFAQManager />
          </TabsContent>
        </div>
      </Tabs>
    </AdminPage>
  );
};

export default AdminSupportHub;
