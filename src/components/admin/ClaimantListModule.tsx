import React from 'react';
import ClaimantList from '@/pages/ClaimantList';

/**
 * Embeds the full Claimant List page as a tab inside the Admin Attorney CRM.
 * `embedded` tells the page itself to drop its standalone chrome (back
 * button, footer) rather than relying on brittle CSS to hide elements that
 * may not even be direct children.
 */
const ClaimantListModule: React.FC = () => {
  return (
    <div className="mt-2">
      <ClaimantList embedded />
    </div>
  );
};

export default ClaimantListModule;
