// src/pages/admin/AdminSystemControl.tsx
import React from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Eye, GitBranch, Database, Settings, UserCog, Activity } from 'lucide-react';
import VisibilityControlTab from '@/components/admin/system-control/VisibilityControlTab';
import WorkflowControlTab from '@/components/admin/system-control/WorkflowControlTab';
import DataControlTab from '@/components/admin/system-control/DataControlTab';
import UserControlTab from '@/components/admin/system-control/UserControlTab';
import SystemHealthTab from '@/components/admin/system-control/SystemHealthTab';
import { AdminPage, AdminHeader, AdminTabList, AdminTabTrigger } from '@/components/admin/ui/AdminUI';

const TABS = [
  { value: 'users', label: 'Per-User', icon: UserCog },
  { value: 'visibility', label: 'Visibility', icon: Eye },
  { value: 'workflow', label: 'Workflow', icon: GitBranch },
  { value: 'data', label: 'Data', icon: Database },
  { value: 'health', label: 'Health', icon: Activity },
] as const;

const AdminSystemControl: React.FC = () => {
  return (
    <AdminPage className="max-w-7xl">
      <AdminHeader
        eyebrow="System"
        title="System Control Center"
        description="Control visibility, workflows, and data across all portals"
        icon={Settings}
      />

      <Tabs defaultValue="users" className="w-full">
        {/* Sticky + even grid on desktop: 5 evenly-spaced destinations that
            stay in view while a long tab (e.g. Health) scrolls beneath. */}
        <AdminTabList sticky columns={5}>
          {TABS.map((t) => (
            <AdminTabTrigger key={t.value} value={t.value} label={t.label} icon={t.icon} center />
          ))}
        </AdminTabList>

        <div className="mt-4">
          <TabsContent value="users" className="mt-0 focus-visible:outline-none">
            <UserControlTab />
          </TabsContent>
          <TabsContent value="visibility" className="mt-0 focus-visible:outline-none">
            <VisibilityControlTab />
          </TabsContent>
          <TabsContent value="workflow" className="mt-0 focus-visible:outline-none">
            <WorkflowControlTab />
          </TabsContent>
          <TabsContent value="data" className="mt-0 focus-visible:outline-none">
            <DataControlTab />
          </TabsContent>
          <TabsContent value="health" className="mt-0 focus-visible:outline-none">
            <SystemHealthTab />
          </TabsContent>
        </div>
      </Tabs>
    </AdminPage>
  );
};

export default AdminSystemControl;
