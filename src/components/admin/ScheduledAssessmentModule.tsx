import React from 'react';
import ScheduledAssessment from '@/pages/ScheduledAssessment';

/**
 * Wrapper that embeds the full Scheduled Assessment page
 * as a standalone module inside the Admin Appointment Engine.
 */
const ScheduledAssessmentModule: React.FC = () => {
  return (
    <div className="mt-2 [&>div>div:first-child]:hidden">
      <ScheduledAssessment />
    </div>
  );
};

export default ScheduledAssessmentModule;
