import React from 'react';
import PortalSupportWidget from '@/components/support/PortalSupportWidget';

// Renders inside ExpertPortalRoute, which already wraps every
// /expert-portal/* route in ExpertPortalLayout — do not wrap in the
// layout here too (that double-nesting previously rendered the
// sidebar/header/chat widget twice on this page).
const ExpertSupport: React.FC = () => {
  return <PortalSupportWidget portalLabel="Expert Portal" />;
};

export default ExpertSupport;
