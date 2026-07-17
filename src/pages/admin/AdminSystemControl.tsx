// src/pages/admin/AdminSystemControl.tsx
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, GitBranch, Database, Settings, UserCog, Activity } from 'lucide-react';
import VisibilityControlTab from '@/components/admin/system-control/VisibilityControlTab';
import WorkflowControlTab from '@/components/admin/system-control/WorkflowControlTab';
import DataControlTab from '@/components/admin/system-control/DataControlTab';
import UserControlTab from '@/components/admin/system-control/UserControlTab';
import SystemHealthTab from '@/components/admin/system-control/SystemHealthTab';
import { AdminPage, AdminHeader } from '@/components/admin/ui/AdminUI';

/** Flat, rounded-none active/inactive treatment shared with every other Admin Portal tab pair. */
const flatTabTrigger =
  'flex shrink-0 items-center gap-1.5 rounded-none px-3 py-2 text-xs font-medium data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-none';

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
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:overflow-visible sm:px-0">
          <TabsList className="flex h-auto w-max min-w-full gap-1 rounded-none border border-black/10 bg-white p-1 sm:w-full sm:max-w-none sm:grid sm:grid-cols-5">
            <TabsTrigger value="users" className={`${flatTabTrigger} sm:justify-center`}>
              <UserCog className="h-3.5 w-3.5" />
              Per-User
            </TabsTrigger>
            <TabsTrigger value="visibility" className={`${flatTabTrigger} sm:justify-center`}>
              <Eye className="h-3.5 w-3.5" />
              Visibility
            </TabsTrigger>
            <TabsTrigger value="workflow" className={`${flatTabTrigger} sm:justify-center`}>
              <GitBranch className="h-3.5 w-3.5" />
              Workflow
            </TabsTrigger>
            <TabsTrigger value="data" className={`${flatTabTrigger} sm:justify-center`}>
              <Database className="h-3.5 w-3.5" />
              Data
            </TabsTrigger>
            <TabsTrigger value="health" className={`${flatTabTrigger} sm:justify-center`}>
              <Activity className="h-3.5 w-3.5" />
              Health
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="users">
          <UserControlTab />
        </TabsContent>
        <TabsContent value="visibility">
          <VisibilityControlTab />
        </TabsContent>
        <TabsContent value="workflow">
          <WorkflowControlTab />
        </TabsContent>
        <TabsContent value="data">
          <DataControlTab />
        </TabsContent>
        <TabsContent value="health">
          <SystemHealthTab />
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
};

export default AdminSystemControl;
