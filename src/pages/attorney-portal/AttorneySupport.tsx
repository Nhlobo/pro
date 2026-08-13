import React from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { AttorneyNotLinkedState } from '@/components/portal/AttorneyNotLinkedState';
import { useAttorneyLinkStatus } from '@/hooks/useAttorneyLinkStatus';
import { HeadsetIcon } from 'lucide-react';
import PortalSupportWidget from '@/components/support/PortalSupportWidget';
import { PortalPage, PortalHeader, PortalLoadingState } from '@/components/attorney-portal/ui/PortalPrimitives';

/**
 * Support & Communications — gated on the same case-link check as every
 * other Attorney Portal page. Resolved before anything renders, so an
 * unlinked account never sees the real Support content (tickets,
 * announcements, FAQ) and then flip to the "not linked" state — it goes
 * straight to the not-linked state on first paint, same as Dashboard /
 * My Cases / Appointments / Case Status / Reports / Payments /
 * Agreements (see useAttorneyLinkStatus / AttorneyNotLinkedState).
 */
const AttorneySupport: React.FC = () => {
  const linkStatus = useAttorneyLinkStatus();

  if (linkStatus === 'checking') {
    return (
      <AttorneyPortalLayout>
        <PortalPage>
          <PortalHeader eyebrow="Attorney Portal" title="Support & Communications" icon={HeadsetIcon} />
          <PortalLoadingState label="Checking your account…" />
        </PortalPage>
      </AttorneyPortalLayout>
    );
  }

  if (linkStatus === 'not_linked') {
    return (
      <AttorneyPortalLayout>
        <PortalPage>
          <PortalHeader eyebrow="Attorney Portal" title="Support & Communications" icon={HeadsetIcon} />
          <AttorneyNotLinkedState description="Your account isn't linked to a firm's referrals yet, so there's nothing to show here. Contact an administrator or get help below." />
        </PortalPage>
      </AttorneyPortalLayout>
    );
  }

  return (
    <AttorneyPortalLayout>
      <PortalSupportWidget portalLabel="Attorney Portal" />
    </AttorneyPortalLayout>
  );
};

export default AttorneySupport;
