import React from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import PortalFeatureUnavailable from '@/components/portal/PortalFeatureUnavailable';

// Previously read aod_documents / aod_payments directly (Supabase-auth
// RLS). No case-link-scoped read path for payment/AOD records exists
// yet for OTP-authenticated external sessions.
const AttorneyPayments: React.FC = () => (
  <AttorneyPortalLayout>
    <PortalFeatureUnavailable
      title="AOD & Payments"
      description="Payment and AOD records aren't connected to the external portal session yet."
    />
  </AttorneyPortalLayout>
);

export default AttorneyPayments;
