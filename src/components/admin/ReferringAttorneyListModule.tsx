import React from 'react';
import ReferringAttorneyList from '@/pages/ReferringAttorneyList';

/** Embeds the Referring Attorney List page as the CRM's "All Attorneys" tab. */
const ReferringAttorneyListModule: React.FC = () => {
  return (
    <div className="mt-2">
      <ReferringAttorneyList embedded />
    </div>
  );
};

export default ReferringAttorneyListModule;
