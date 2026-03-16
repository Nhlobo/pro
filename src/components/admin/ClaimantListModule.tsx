import React from 'react';
import ClaimantList from '@/pages/ClaimantList';

const ClaimantListModule: React.FC = () => {
  return (
    <div className="mt-2 [&>div>div:first-child]:hidden [&>nav]:hidden">
      <ClaimantList />
    </div>
  );
};

export default ClaimantListModule;
