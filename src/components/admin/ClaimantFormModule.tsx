import React from 'react';
import ClaimantForm from '@/pages/ClaimantForm';

/** Embeds the Claimant creation form as the CRM's "New Claimant" tab. */
const ClaimantFormModule: React.FC = () => {
  return (
    <div className="mt-2">
      <ClaimantForm embedded />
    </div>
  );
};

export default ClaimantFormModule;
