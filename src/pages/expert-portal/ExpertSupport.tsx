import React from 'react';
import ExpertPortalLayout from '@/components/portal/ExpertPortalLayout';
import PortalSupportWidget from '@/components/support/PortalSupportWidget';

const ExpertSupport: React.FC = () => {
  return (
    <ExpertPortalLayout>
      <PortalSupportWidget />
    </ExpertPortalLayout>
  );
};

export default ExpertSupport;
