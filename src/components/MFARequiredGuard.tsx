import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import MFASetup from '@/components/MFASetup';
import BrandedPageLoader from '@/components/BrandedPageLoader';

interface MFARequiredGuardProps {
  children: React.ReactNode;
  /** Role label for the blocking screen, e.g. "Referring Attorney" or "Medical Expert". */
  roleLabel: string;
}

/**
 * POPIA Sec. 19 — Mandatory Two-Factor Authentication for roles that
 * routinely access medical records, ID copies, medico-legal reports
 * and supporting case documents.
 *
 * Blocks the entire portal until the user has at least one verified
 * TOTP factor enrolled and the active session is AAL2.
 */
export const MFARequiredGuard: React.FC<MFARequiredGuardProps> = ({ children, roleLabel }) => {
  const [checking, setChecking] = useState(true);
  const [mfaSatisfied, setMfaSatisfied] = useState(false);
  const [needsChallenge, setNeedsChallenge] = useState(false);

  const evaluate = async () => {
    setChecking(true);
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const verifiedTotp = (factorsData?.totp || []).find((f: any) => f.status === 'verified');

      if (!verifiedTotp) {
        setMfaSatisfied(false);
        setNeedsChallenge(false);
        return;
      }

      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      // currentLevel must equal 'aal2' to be considered MFA-verified for this session
      if (aalData?.currentLevel === 'aal2') {
        setMfaSatisfied(true);
        setNeedsChallenge(false);
      } else {
        setMfaSatisfied(false);
        setNeedsChallenge(true);
      }
    } catch (e) {
      console.error('MFA evaluation failed', e);
      setMfaSatisfied(false);
      setNeedsChallenge(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    evaluate();
    const { data: sub } = supabase.auth.onAuthStateChange(() => evaluate());
    return () => sub.subscription.unsubscribe();
  }, []);

  if (checking) {
    return <BrandedPageLoader message="Verifying secure access…" />;
  }

  if (mfaSatisfied) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex items-start justify-center">
      <div className="w-full max-w-2xl space-y-4">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Two-Factor Authentication Required</AlertTitle>
          <AlertDescription>
            As a {roleLabel}, you access medical records, ID copies, medico-legal
            reports and supporting case documents. POPIA Sec. 19 requires you to
            enrol and verify two-factor authentication before continuing.
          </AlertDescription>
        </Alert>

        {needsChallenge ? (
          <Card>
            <CardHeader>
              <CardTitle>Verify Your Second Factor</CardTitle>
              <CardDescription>
                You have an authenticator enrolled, but this session has not been
                verified. Sign out and sign back in, completing the 6-digit code
                challenge to continue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Use your authenticator app (Google Authenticator, Authy, 1Password, etc.)
                to obtain the current 6-digit code during sign-in.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Enrol Two-Factor Authentication</CardTitle>
              <CardDescription>
                Scan the QR code below with your authenticator app, then enter the
                generated 6-digit code to complete enrolment. Access to the portal
                will unlock automatically once verified.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MFASetup />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MFARequiredGuard;
