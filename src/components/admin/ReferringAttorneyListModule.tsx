import React from 'react';
import ReferringAttorneyList from '@/pages/ReferringAttorneyList';

const ReferringAttorneyListModule: React.FC = () => {
  return (
    <div className="mt-2 [&>div>div:first-child]:hidden [&>nav]:hidden">
      <ReferringAttorneyList />
    </div>
  );
};

export default ReferringAttorneyListModule;
