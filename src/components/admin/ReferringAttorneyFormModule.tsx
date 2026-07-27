import React from 'react';
import ReferringAttorneyForm from '@/pages/ReferringAttorneyForm';

interface ReferringAttorneyFormModuleProps {
  attorneyId?: string;
  onSaved?: () => void;
}

/** Embeds the Referring Attorney form as the CRM's "New Attorney" tab, and is
 *  also reused inside the "Add New Attorney" / "Edit Attorney" sliding
 *  panels on the attorney list. */
const ReferringAttorneyFormModule: React.FC<ReferringAttorneyFormModuleProps> = ({ attorneyId, onSaved }) => {
  return (
    <div className="mt-2">
      <ReferringAttorneyForm embedded attorneyId={attorneyId} onSaved={onSaved} />
    </div>
  );
};

export default ReferringAttorneyFormModule;
