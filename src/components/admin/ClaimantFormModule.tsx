import React from 'react';
import ClaimantForm from '@/pages/ClaimantForm';

interface ClaimantFormModuleProps {
  onSaved?: () => void;
}

/** Embeds the Claimant creation form as the CRM's "New Claimant" tab, and is
 *  also reused inside the "Add New Claimant" sliding panel on the claimant
 *  list. */
const ClaimantFormModule: React.FC<ClaimantFormModuleProps> = ({ onSaved }) => {
  return (
    <div className="mt-2">
      <ClaimantForm embedded onSaved={onSaved} />
    </div>
  );
};

export default ClaimantFormModule;
