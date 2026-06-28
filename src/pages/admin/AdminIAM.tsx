import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Shield, KeyRound, Smartphone, ListChecks } from 'lucide-react';
import UserManagement from '@/pages/UserManagement';
import PermissionManagement from '@/pages/PermissionManagement';
import { MFASetup } from '@/components/MFASetup';
import { PasskeysManager } from '@/components/security/PasskeysManager';
import { TrustedDevices } from '@/components/security/TrustedDevices';

const AdminIAM: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Access &amp; Identity Management</h1>
        <p className="text-sm text-muted-foreground">
          Role-based permissions, authentication policies and device security
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" /> Users</TabsTrigger>
          <TabsTrigger value="roles" className="gap-2"><ListChecks className="h-4 w-4" /> Roles &amp; Permissions</TabsTrigger>
          <TabsTrigger value="mfa" className="gap-2"><Shield className="h-4 w-4" /> Two-Factor</TabsTrigger>
          <TabsTrigger value="passkeys" className="gap-2"><KeyRound className="h-4 w-4" /> Passkeys</TabsTrigger>
          <TabsTrigger value="devices" className="gap-2"><Smartphone className="h-4 w-4" /> Devices</TabsTrigger>
        </TabsList>

        <TabsContent value="users"><UserManagement /></TabsContent>
        <TabsContent value="roles"><PermissionManagement /></TabsContent>
        <TabsContent value="mfa"><MFASetup /></TabsContent>
        <TabsContent value="passkeys"><PasskeysManager /></TabsContent>
        <TabsContent value="devices"><TrustedDevices /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminIAM;
