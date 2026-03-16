import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HeadsetIcon, Megaphone, HelpCircle } from 'lucide-react';
import AdminTicketManager from '@/components/support/AdminTicketManager';
import AdminAnnouncementManager from '@/components/support/AdminAnnouncementManager';
import AdminFAQManager from '@/components/support/AdminFAQManager';

const AdminSupportHub: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Support & Communications Hub</h1>
        <p className="text-sm text-muted-foreground">Manage tickets, announcements, and FAQ for experts and attorneys</p>
      </div>

      <Tabs defaultValue="tickets" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tickets" className="gap-2">
            <HeadsetIcon className="h-4 w-4" /> Tickets
          </TabsTrigger>
          <TabsTrigger value="announcements" className="gap-2">
            <Megaphone className="h-4 w-4" /> Announcements
          </TabsTrigger>
          <TabsTrigger value="faq" className="gap-2">
            <HelpCircle className="h-4 w-4" /> FAQ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets">
          <AdminTicketManager />
        </TabsContent>
        <TabsContent value="announcements">
          <AdminAnnouncementManager />
        </TabsContent>
        <TabsContent value="faq">
          <AdminFAQManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSupportHub;
