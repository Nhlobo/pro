import React from 'react';
import AttorneyPitchlog from '@/pages/AttorneyPitchlog';

/**
 * Wrapper that embeds the full Attorney Pitchlog page
 * as a standalone module inside the Admin Appointment Engine.
 */
const AttorneyPitchlogModule: React.FC = () => {
  return (
    <div className="mt-2 [&>div>div:first-child]:hidden">
      <AttorneyPitchlog />
    </div>
  );
};

export default AttorneyPitchlogModule;
