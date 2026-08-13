import React from 'react';
import PortalSupportWidget from '@/components/support/PortalSupportWidget';
import { HeadsetIcon } from 'lucide-react';
import { PortalPage, PortalHeader, PortalLoadingState } from '@/components/attorney-portal/ui/PortalPrimitives';
import { ExpertNotLinkedState } from '@/components/portal/ExpertNotLinkedState';
import { useExpertLinkStatus } from '@/hooks/useExpertLinkStatus';

// Renders inside ExpertPortalRoute, which already wraps every
// /expert-portal/* route in ExpertPortalLayout — do not wrap in the
// layout here too (that double-nesting previously rendered the
// sidebar/header/chat widget twice on this page).
//
// Gated on the same shared expert-link check as every other Expert
// Portal page (useExpertLinkStatus). The check resolves before anything
// else renders — a brief "Checking your account…" state, never the real
// Support content followed by a bounce back to the not-linked state —
// same order Attorney Portal's Support page follows (AttorneySupport /
// useAttorneyLinkStatus).
const ExpertSupport: React.FC = () => {
  const linkStatus = useExpertLinkStatus();

  if (linkStatus === 'checking') {
    return (
      <PortalPage>
        <PortalHeader eyebrow="Expert Portal" title="Support & Communications" icon={HeadsetIcon} />
        <PortalLoadingState label="Checking your account…" />
      </PortalPage>
    );
  }

  if (linkStatus === 'not_linked') {
    return (
      <PortalPage>
        <PortalHeader eyebrow="Expert Portal" title="Support & Communications" icon={HeadsetIcon} />
        <ExpertNotLinkedState description="Your account is not linked to a medical expert profile, so there's nothing to show here. Contact an administrator or get help below." />
      </PortalPage>
    );
  }

  return <PortalSupportWidget portalLabel="Expert Portal" />;
};

export default ExpertSupport;
