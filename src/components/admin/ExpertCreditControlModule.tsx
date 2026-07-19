// src/components/admin/ExpertCreditControlModule.tsx
import React from 'react';
import { ExpertCreditControlContent } from '@/components/admin/ExpertCreditControlContent';

/**
 * Credit Control tab inside the Expert Network page. Renders the shared
 * content directly — no nested page shell, no CSS hacks hiding another
 * page's header/nav/footer. This is what previously caused the tab to
 * overlap the surrounding admin page and render at the wrong size.
 */
const ExpertCreditControlModule: React.FC = () => {
  return <ExpertCreditControlContent />;
};

export default ExpertCreditControlModule;
