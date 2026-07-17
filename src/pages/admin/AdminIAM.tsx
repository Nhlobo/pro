import React from 'react';
import UserManagement from '@/pages/UserManagement';

// The Admin Portal top bar already renders this page's title and a
// "Back to Operations Dashboard" control (see AdminPortalLayout), so this
// screen no longer renders its own duplicate page header — that used to
// stack a second title ("Access & Identity Management") above
// UserManagement's own header ("All Users") plus a second, differently
// -targeted "Dashboard" button. `embedded` tells UserManagement to drop
// that redundant button and let the portal chrome own back-navigation.
const AdminIAM: React.FC = () => {
  return (
    <div className="brand-legal-theme">
      <UserManagement embedded />
    </div>
  );
};

export default AdminIAM;
