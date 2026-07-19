import React from 'react';
import ReferringAttorneyForm from '@/pages/ReferringAttorneyForm';

/** Embeds the Referring Attorney form as the CRM's "New Attorney" tab. */
const ReferringAttorneyFormModule: React.FC = () => {
  return (
    <div className="mt-2">
      <ReferringAttorneyForm embedded />
    </div>
  );
};

export default ReferringAttorneyFormModule;
