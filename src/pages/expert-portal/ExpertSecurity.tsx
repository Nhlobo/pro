import React, { useEffect, useState } from 'react';
import MFASetup from '@/components/MFASetup';
import { PortalPage, PortalHeader, PortalLoadingState } from '@/components/attorney-portal/ui/PortalPrimitives';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ExpertNotLinkedState } from '@/components/portal/ExpertNotLinkedState';

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
 * Gated on the same expert-link check as every other Expert Portal
 * page (see ExpertCases / ExpertSchedule / ExpertSupport). Resolved
 * before anything else renders — a brief "Checking your account…"
 * state, never the real Security content flashing first.
 *
 * Note: this page renders inside ExpertPortalRoute, which already wraps
 * every /expert-portal/* route in ExpertPortalLayout — it must not wrap
 * itself in the layout again, or the sidebar/header/chat widget render
 * twice (that was previously breaking this page's styling and
 * responsiveness).
 */
const ExpertSecurity: React.FC = () => {
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
        <PortalHeader eyebrow="Expert Portal" title="Security" icon={ShieldCheck} />
        <PortalLoadingState label="Checking your account…" />
      </PortalPage>
    );
  }

  if (notLinked) {
    return (
      <PortalPage>
        <PortalHeader eyebrow="Expert Portal" title="Security" icon={ShieldCheck} />
        <ExpertNotLinkedState description="Your account is not linked to a medical expert profile, so there's nothing to show here. Contact an administrator or get help below." />
      </PortalPage>
    );
  }

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
