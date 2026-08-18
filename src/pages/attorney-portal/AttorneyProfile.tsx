import React from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { AttorneyNotLinkedState } from '@/components/portal/AttorneyNotLinkedState';
import { useAttorneyLinkStatus } from '@/hooks/useAttorneyLinkStatus';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  PortalPage,
  PortalHeader,
  PortalCard,
  PortalCardHeader,
  PortalCardBody,
  PortalLoadingState,
} from '@/components/attorney-portal/ui/PortalPrimitives';
import { User, Building2, Mail, Phone, MapPin, ShieldCheck } from 'lucide-react';

/**
 * Attorney Portal — Profile.
 *
 * Deliberately NOT a copy of ExpertProfile.tsx (which also manages fee
 * review requests and an availability calendar — none of which apply
 * to a referring attorney). This page has two distinct data sources,
 * shown as two separate sections so it's clear which is which:
 *
 *   1. The firm record (`referring_attorneys`) — read-only here. This
 *      is the CRM record staff/sales rely on; an attorney shouldn't be
 *      able to silently rewrite it from the portal.
 *   2. Their portal login identity (`external_portal_accounts`) — also
 *      read-only for now. Self-service email changes are intentionally
 *      NOT wired up yet: changing the address OTPs get sent to needs
 *      its own re-verification step (confirm the new inbox before it
 *      becomes live), the same way the admin-side flow now requires a
 *      valid, checked address before a link goes out. Shipping a
 *      one-step "type a new email, done" self-service change here
 *      would let a mistyped or momentarily-accessed session silently
 *      redirect all future logins to an address the real attorney
 *      doesn't control. Until that's designed, changes go through
 *      admin (External Portal Management → Access Links already
 *      supports assigning a new, validated email).
 */
const AttorneyProfile: React.FC = () => {
  const linkStatus = useAttorneyLinkStatus();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['attorney-portal', 'profile', user?.id],
    queryFn: async () => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('referring_attorney_id, email, first_name, last_name')
        .eq('id', user!.id)
        .single();
      if (profileError) throw profileError;
      if (!profile?.referring_attorney_id) return { firm: null, account: null, profile };

      const [{ data: firm }, { data: account }] = await Promise.all([
        supabase
          .from('referring_attorneys')
          .select('name, contact_person, email, phone, address, province')
          .eq('id', profile.referring_attorney_id)
          .maybeSingle(),
        supabase
          .from('external_portal_accounts' as any)
          .select('full_name, email, status')
          .eq('portal_type', 'attorney')
          .eq('referring_attorney_id', profile.referring_attorney_id)
          .is('deleted_at', null)
          .maybeSingle(),
      ]);

      return { firm, account, profile };
    },
    enabled: !!user && linkStatus === 'linked',
    staleTime: 60_000,
  });

  if (linkStatus === 'checking') return <PortalLoadingState label="Loading…" />;
  if (linkStatus === 'not_linked') return <AttorneyNotLinkedState />;

  return (
    <AttorneyPortalLayout>
      <PortalPage>
        <PortalHeader eyebrow="Attorney Portal" title="Profile" description="Your firm record and portal login details." icon={User} />

        {isLoading ? (
          <PortalLoadingState label="Loading profile…" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <PortalCard>
              <PortalCardHeader title="Firm Record" description="Managed by our team — contact your account manager to update these details." icon={Building2} />
              <PortalCardBody className="space-y-3">
                <ProfileRow icon={Building2} label="Firm name" value={data?.firm?.name} />
                <ProfileRow icon={User} label="Contact person" value={data?.firm?.contact_person} />
                <ProfileRow icon={Mail} label="Firm email" value={data?.firm?.email} />
                <ProfileRow icon={Phone} label="Phone" value={data?.firm?.phone} />
                <ProfileRow icon={MapPin} label="Address" value={[data?.firm?.address, data?.firm?.province].filter(Boolean).join(', ')} />
              </PortalCardBody>
            </PortalCard>

            <PortalCard>
              <PortalCardHeader title="Portal Login" description="How you sign in to this portal. Email changes go through your account manager." icon={ShieldCheck} />
              <PortalCardBody className="space-y-3">
                <ProfileRow icon={User} label="Display name" value={data?.account?.full_name} />
                <ProfileRow icon={Mail} label="Login email" value={data?.account?.email} />
                <ProfileRow icon={ShieldCheck} label="Account status" value={data?.account?.status ? data.account.status.charAt(0).toUpperCase() + data.account.status.slice(1) : undefined} />
              </PortalCardBody>
            </PortalCard>
          </div>
        )}
      </PortalPage>
    </AttorneyPortalLayout>
  );
};

const ProfileRow: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; value?: string | null }> = ({
  icon: Icon,
  label,
  value,
}) => (
  <div className="flex items-start gap-2.5">
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="truncate text-sm font-medium text-slate-900">{value || '—'}</p>
    </div>
  </div>
);

export default AttorneyProfile;
