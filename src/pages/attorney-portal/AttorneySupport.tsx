import React from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import PortalSupportWidget from '@/components/support/PortalSupportWidget';

const AttorneySupport: React.FC = () => {
  return (
    <AttorneyPortalLayout>
      <PortalSupportWidget portalLabel="Attorney Portal" />
    </AttorneyPortalLayout>
  );
};

export default AttorneySupport;
