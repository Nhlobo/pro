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
    <div className="space-y-4 md:space-y-6">
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
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
          <TabsList className="grid w-max min-w-full grid-cols-5 gap-1 sm:w-full sm:max-w-3xl sm:gap-0">
            <TabsTrigger value="users" className="flex items-center gap-1.5 whitespace-nowrap px-2.5 text-xs sm:px-3">
              <UserCog className="h-3.5 w-3.5 shrink-0" />
              Per-User
            </TabsTrigger>
            <TabsTrigger value="visibility" className="flex items-center gap-1.5 whitespace-nowrap px-2.5 text-xs sm:px-3">
              <Eye className="h-3.5 w-3.5 shrink-0" />
              Visibility
            </TabsTrigger>
            <TabsTrigger value="workflow" className="flex items-center gap-1.5 whitespace-nowrap px-2.5 text-xs sm:px-3">
              <GitBranch className="h-3.5 w-3.5 shrink-0" />
              Workflow
            </TabsTrigger>
            <TabsTrigger value="data" className="flex items-center gap-1.5 whitespace-nowrap px-2.5 text-xs sm:px-3">
              <Database className="h-3.5 w-3.5 shrink-0" />
              Data
            </TabsTrigger>
            <TabsTrigger value="health" className="flex items-center gap-1.5 whitespace-nowrap px-2.5 text-xs sm:px-3">
              <Activity className="h-3.5 w-3.5 shrink-0" />
              Health
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="users" className="overflow-x-hidden">
          <UserControlTab />
        </TabsContent>
        <TabsContent value="visibility" className="overflow-x-hidden">
          <VisibilityControlTab />
        </TabsContent>
        <TabsContent value="workflow" className="overflow-x-hidden">
          <WorkflowControlTab />
        </TabsContent>
        <TabsContent value="data" className="overflow-x-hidden">
          <DataControlTab />
        </TabsContent>
        <TabsContent value="health" className="overflow-x-hidden">
          <SystemHealthTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSystemControl;
