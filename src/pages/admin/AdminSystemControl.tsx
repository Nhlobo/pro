import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, GitBranch, Database, Settings } from 'lucide-react';
import VisibilityControlTab from '@/components/admin/system-control/VisibilityControlTab';
import WorkflowControlTab from '@/components/admin/system-control/WorkflowControlTab';
import DataControlTab from '@/components/admin/system-control/DataControlTab';

const AdminSystemControl: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          System Control Center
        </h1>
        <p className="text-sm text-muted-foreground">
          Control visibility, workflows, and data across all portals
        </p>
      </div>

      <Tabs defaultValue="visibility" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="visibility" className="flex items-center gap-1.5 text-xs">
            <Eye className="h-3.5 w-3.5" />
            Visibility
          </TabsTrigger>
          <TabsTrigger value="workflow" className="flex items-center gap-1.5 text-xs">
            <GitBranch className="h-3.5 w-3.5" />
            Workflow
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-1.5 text-xs">
            <Database className="h-3.5 w-3.5" />
            Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visibility">
          <VisibilityControlTab />
        </TabsContent>
        <TabsContent value="workflow">
          <WorkflowControlTab />
        </TabsContent>
        <TabsContent value="data">
          <DataControlTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSystemControl;
