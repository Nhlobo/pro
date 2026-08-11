import React from 'react';
import ExpertPortalLayout from '@/components/portal/ExpertPortalLayout';
import MFASetup from '@/components/MFASetup';
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
 */
const ExpertSecurity: React.FC = () => {
  return (
    <ExpertPortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Security
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage the authenticator app used to sign in to your account.
          </p>
        </div>
        <MFASetup />
      </div>
    </ExpertPortalLayout>
  );
};

export default ExpertSecurity;
