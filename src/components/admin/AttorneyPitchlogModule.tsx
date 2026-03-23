import React from 'react';
import AttorneyPitchlog from '@/pages/AttorneyPitchlog';

interface AttorneyPitchlogModuleProps {
  defaultTab?: string;
}

/**
 * Wrapper that embeds the full Attorney Pitchlog page
 * as a standalone module inside the Admin Attorney CRM.
 */
const AttorneyPitchlogModule: React.FC<AttorneyPitchlogModuleProps> = ({ defaultTab }) => {
  return (
    <div className="mt-2 [&>div>div:first-child]:hidden">
      <AttorneyPitchlog defaultTab={defaultTab} />
    </div>
  );
};

export default AttorneyPitchlogModule;
