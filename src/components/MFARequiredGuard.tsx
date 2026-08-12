import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
  // The verified TOTP factor id this session needs to step up against.
  // Needed to actually run the 6-digit challenge below — without it we
  // can only tell the user a challenge is required, not let them do it.
  const [challengeFactorId, setChallengeFactorId] = useState<string | null>(null);
  const [challengeCode, setChallengeCode] = useState('');
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [challengeError, setChallengeError] = useState('');

  const evaluate = async () => {
    setChecking(true);
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const verifiedTotp = (factorsData?.totp || []).find((f: any) => f.status === 'verified');

      if (!verifiedTotp) {
        setMfaSatisfied(false);
        setNeedsChallenge(false);
        setChallengeFactorId(null);
        return;
      }

      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      // currentLevel must equal 'aal2' to be considered MFA-verified for this session
      if (aalData?.currentLevel === 'aal2') {
        setMfaSatisfied(true);
        setNeedsChallenge(false);
        setChallengeFactorId(null);
      } else {
        setMfaSatisfied(false);
        setNeedsChallenge(true);
        setChallengeFactorId(verifiedTotp.id);
      }
    } catch (e) {
      console.error('MFA evaluation failed', e);
      setMfaSatisfied(false);
      setNeedsChallenge(false);
      setChallengeFactorId(null);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    evaluate();
    const { data: sub } = supabase.auth.onAuthStateChange(() => evaluate());
    return () => sub.subscription.unsubscribe();
  }, []);

  // Runs the actual login-time second-factor check: challenge the
  // already-enrolled TOTP factor, verify the 6-digit code the user
  // typed, and — on success — re-evaluate so the session's new AAL2
  // level is picked up and the guard opens into the dashboard. This is
  // what used to be missing: the screen told the user a code was
  // needed but gave them nowhere to type it.
  const verifyChallenge = async () => {
    if (!challengeFactorId) return;
    if (!/^\d{6}$/.test(challengeCode)) {
      setChallengeError('Enter the 6-digit code from your authenticator app');
      return;
    }
    setChallengeBusy(true);
    setChallengeError('');
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: challengeFactorId });
      if (chErr || !ch) {
        setChallengeError(chErr?.message || 'Could not start verification. Please try again.');
        return;
      }
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: challengeFactorId,
        challengeId: ch.id,
        code: challengeCode,
      });
      if (verifyErr) {
        setChallengeError(verifyErr.message || 'Incorrect code. Please try again.');
        return;
      }
      toast.success('Verified');
      setChallengeCode('');
      await evaluate();
    } catch (e) {
      console.error('MFA challenge verification failed', e);
      setChallengeError('An unexpected error occurred. Please try again.');
    } finally {
      setChallengeBusy(false);
    }
  };

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
                You have an authenticator enrolled. Enter the current 6-digit code
                from your authenticator app (Google Authenticator, Authy, 1Password,
                etc.) to continue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">6-digit code</label>
                <Input
                  value={challengeCode}
                  onChange={(e) => {
                    setChallengeCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setChallengeError('');
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && challengeCode.length === 6) verifyChallenge(); }}
                  placeholder="123456"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  className="max-w-[160px] tracking-widest text-center"
                  disabled={challengeBusy}
                />
              </div>
              {challengeError && (
                <p className="text-sm text-destructive">{challengeError}</p>
              )}
              <Button disabled={challengeBusy || challengeCode.length !== 6} onClick={verifyChallenge}>
                {challengeBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Verify & continue
              </Button>
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
