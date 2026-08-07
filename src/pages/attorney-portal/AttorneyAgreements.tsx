import React from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import PortalFeatureUnavailable from '@/components/portal/PortalFeatureUnavailable';

// Previously read aod_documents directly (Supabase-auth RLS). No
// case-link-scoped read path for agreement documents exists yet for
// OTP-authenticated external sessions.
const AttorneyAgreements: React.FC = () => (
  <AttorneyPortalLayout>
    <PortalFeatureUnavailable
      title="Agreements"
      description="Agreement documents aren't connected to the external portal session yet."
    />
  </AttorneyPortalLayout>
);

export default AttorneyAgreements;
