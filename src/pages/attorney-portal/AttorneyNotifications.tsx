import React from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import PortalFeatureUnavailable from '@/components/portal/PortalFeatureUnavailable';

// Previously read the internal `notifications` table with realtime
// subscriptions scoped by auth.uid(). No equivalent exists yet for
// OTP-authenticated external sessions. Case-level updates are available
// via the Messages tab on individual cases in the meantime.
const AttorneyNotifications: React.FC = () => (
  <AttorneyPortalLayout>
    <PortalFeatureUnavailable
      title="Notifications"
      description="Notifications aren't connected to the external portal session yet — check individual cases for updates."
    />
  </AttorneyPortalLayout>
);

export default AttorneyNotifications;
