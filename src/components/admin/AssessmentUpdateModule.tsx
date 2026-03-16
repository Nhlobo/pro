import React from 'react';
import ReferringAttorneyUpdate from '@/pages/ReferringAttorneyUpdate';

/**
 * Wrapper that embeds the Referring Attorney Update (Assessment Update) page
 * as a standalone module inside the Admin Appointment Engine.
 */
const AssessmentUpdateModule: React.FC = () => {
  return (
    <div className="mt-2 [&>div>div:first-child]:hidden">
      <ReferringAttorneyUpdate />
    </div>
  );
};

export default AssessmentUpdateModule;
