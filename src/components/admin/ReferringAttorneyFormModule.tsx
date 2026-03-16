import React from 'react';
import ReferringAttorneyForm from '@/pages/ReferringAttorneyForm';

const ReferringAttorneyFormModule: React.FC = () => {
  return (
    <div className="mt-2 [&>div>div:first-child]:hidden [&>nav]:hidden">
      <ReferringAttorneyForm />
    </div>
  );
};

export default ReferringAttorneyFormModule;
