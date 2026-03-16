import React from 'react';
import ClaimantForm from '@/pages/ClaimantForm';

const ClaimantFormModule: React.FC = () => {
  return (
    <div className="mt-2 [&>div>div:first-child]:hidden [&>nav]:hidden">
      <ClaimantForm />
    </div>
  );
};

export default ClaimantFormModule;
