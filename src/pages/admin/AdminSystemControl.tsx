import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, GitBranch, Database, Settings, UserCog, Activity } from 'lucide-react';
import VisibilityControlTab from '@/components/admin/system-control/VisibilityControlTab';
import WorkflowControlTab from '@/components/admin/system-control/WorkflowControlTab';
import DataControlTab from '@/components/admin/system-control/DataControlTab';
import UserControlTab from '@/components/admin/system-control/UserControlTab';
import SystemHealthTab from '@/components/admin/system-control/SystemHealthTab';

const AdminSystemControl: React.FC = () => {
  return (
    <div className="brand-legal-theme space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          System Control Center
        </h1>
        <p className="text-sm text-muted-foreground">
          Control visibility, workflows, and data across all portals
        </p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:overflow-visible sm:px-0">
          <TabsList className="flex w-max min-w-full gap-1 sm:grid sm:w-full sm:grid-cols-5 sm:gap-0 sm:max-w-3xl">
            <TabsTrigger value="users" className="flex shrink-0 items-center gap-1.5 text-xs">
              <UserCog className="h-3.5 w-3.5" />
              Per-User
            </TabsTrigger>
            <TabsTrigger value="visibility" className="flex shrink-0 items-center gap-1.5 text-xs">
              <Eye className="h-3.5 w-3.5" />
              Visibility
            </TabsTrigger>
            <TabsTrigger value="workflow" className="flex shrink-0 items-center gap-1.5 text-xs">
              <GitBranch className="h-3.5 w-3.5" />
              Workflow
            </TabsTrigger>
            <TabsTrigger value="data" className="flex shrink-0 items-center gap-1.5 text-xs">
              <Database className="h-3.5 w-3.5" />
              Data
            </TabsTrigger>
            <TabsTrigger value="health" className="flex shrink-0 items-center gap-1.5 text-xs">
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
    </div>
  );
};

export default AdminSystemControl;
