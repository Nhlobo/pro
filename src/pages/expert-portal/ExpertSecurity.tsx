import React from 'react';
import MFASetup from '@/components/MFASetup';
import { PortalPage, PortalHeader } from '@/components/attorney-portal/ui/PortalPrimitives';
import { ShieldCheck } from 'lucide-react';

/**
 * Expert Portal — Security page.
 *
 * MFARequiredGuard shows MFASetup automatically the first time an
 * expert signs in without a verified authenticator, but once enrolled
 * that screen is gone for good — there was previously no button or
 * page anywhere in the Expert Portal to get back to it (check status,
 * re-enrol on a new phone, or disable). This page restores that access
 * point as a normal nav item instead of a one-time forced screen.
 *
 * Note: this page renders inside ExpertPortalRoute, which already wraps
 * every /expert-portal/* route in ExpertPortalLayout — it must not wrap
 * itself in the layout again, or the sidebar/header/chat widget render
 * twice (that was previously breaking this page's styling and
 * responsiveness).
 */
const ExpertSecurity: React.FC = () => {
  return (
    <PortalPage>
      <PortalHeader
        eyebrow="Expert Portal"
        title="Security"
        description="Manage the authenticator app used to sign in to your account."
        icon={ShieldCheck}
      />
      <MFASetup />
    </PortalPage>
  );
};

export default ExpertSecurity;
