import React from 'react';
import UserManagement from '@/pages/UserManagement';

const AdminIAM: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Access & Identity Management</h1>
        <p className="text-sm text-muted-foreground">Role-based permissions and user administration</p>
      </div>
      <UserManagement />
    </div>
  );
};

export default AdminIAM;
