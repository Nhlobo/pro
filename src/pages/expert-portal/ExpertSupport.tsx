import React, { useEffect, useState } from 'react';
import PortalSupportWidget from '@/components/support/PortalSupportWidget';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { HeadsetIcon } from 'lucide-react';
import { PortalPage, PortalHeader, PortalLoadingState } from '@/components/attorney-portal/ui/PortalPrimitives';
import { ExpertNotLinkedState } from '@/components/portal/ExpertNotLinkedState';

// Renders inside ExpertPortalRoute, which already wraps every
// /expert-portal/* route in ExpertPortalLayout — do not wrap in the
// layout here too (that double-nesting previously rendered the
// sidebar/header/chat widget twice on this page).
//
// Gated on the same expert-link check as every other Expert Portal
// page (see ExpertCases / ExpertSchedule / ExpertReportTracking). The
// check resolves before anything else renders — a brief "Checking
// your account…" state, never the real Support content followed by a
// bounce back to the not-linked state — same order Attorney Portal's
// Support page follows (see AttorneySupport / useAttorneyLinkStatus).
const ExpertSupport: React.FC = () => {
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [notLinked, setNotLinked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('expert_id')
        .eq('id', user.id)
        .single();
      if (cancelled) return;
      setNotLinked(!profile?.expert_id);
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (checking) {
    return (
      <PortalPage>
        <PortalHeader eyebrow="Expert Portal" title="Support & Communications" icon={HeadsetIcon} />
        <PortalLoadingState label="Checking your account…" />
      </PortalPage>
    );
  }

  if (notLinked) {
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
