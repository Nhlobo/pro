import React from 'react';
import UserManagement from '@/pages/UserManagement';
import AdminPageHeader from '@/components/portal/AdminPageHeader';
import { ShieldCheck } from 'lucide-react';

const AdminIAM: React.FC = () => {
  return (
    <div className="brand-legal-theme space-y-4 md:space-y-6">
      <AdminPageHeader
        title="Access & Identity Management"
        description="Role-based permissions and user administration"
        icon={ShieldCheck}
        color="orange"
      />
      <UserManagement />
    </div>
  );
};

export default AdminIAM;
