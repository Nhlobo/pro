import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  consumeAccessLink,
  requestRegistrationOtp,
  requestLoginOtp,
  verifyRegistrationOtp,
  verifyLoginOtp,
  type ApiError,
} from '@/services/externalPortal/externalPortalAuthClient';
import type { ExternalPortalType } from '@/types/externalPortal';
import { useBackNavigationTrap } from '@/hooks/useBackNavigationTrap';

const logoSrc = '/lovable-uploads/7401e32a-2457-4a00-9d60-c1ff9fcfc4fc.png';

/**
 * External Portal Sign In — the ONE shared sign-in flow for both
 * referring attorneys and medical experts.
 *
 * This is now purely a front door: link/OTP verification happens
 * against external_portal_accounts exactly as before, but a correct
 * code no longer opens a separate rebuilt portal. It bridges into a
 * REAL Supabase Auth session (supabase.auth.verifyOtp, using a token
 * external-portal-auth mints server-side) and lands the person on the
 * actual, unmodified /attorney-portal or /expert-portal — the same
 * pages, same data access, same everything a staff login gets.
 *
 * Two entry paths into the same OTP step:
 *  - `?token=...` in the URL -> one-time registration link (Admin
 *    creates access -> link emailed -> user opens it here).
 *  - No token -> returning user -> email + portal type -> OTP login.
 */

type Step = 'loading-link' | 'login-request' | 'otp' | 'link-error';

const ExternalPortalSignIn: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const linkToken = searchParams.get('token');
  const [step, setStep] = useState<Step>(linkToken ? 'loading-link' : 'login-request');
  const [linkError, setLinkError] = useState<string | null>(null);

  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [portalType, setPortalType] = useState<ExternalPortalType>('attorney');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // This is where sign-out (and any stale/expired external-portal session)
  // lands people. Back must never be able to step past this page into
  // whatever attorney/expert-portal (or, if the redirect target were ever
  // wrong, staff) screen was open before — trap it here instead.
  useBackNavigationTrap();

  // SECURITY: purge any session this tab already has the instant the
  // External Portal front door mounts — BEFORE the person has done
  // anything here.
  //
  // Root cause this closes: opening an External Portal link in a new
  // same-origin tab (via a link/window.open from an already-authenticated
  // Internal Staff tab) can have the browser clone that tab's
  // `sessionStorage` — which is exactly where the Supabase session lives
  // (see `src/integrations/supabase/client.ts`) — into the new tab. That
  // new tab then silently starts out "signed in" as the staff member, on
  // what's supposed to be the External Portal's own sign-in screen. If
  // anything in this tab subsequently called `signOut()` on that
  // inherited session, it would revoke it with Supabase — logging the
  // *staff member* out of the Internal System in their original tab too.
  // This is a real incident that happened.
  //
  // The fix: this screen must never trust or act on a session it did not
  // itself create via the OTP exchange below. `scope: 'local'` only
  // clears *this tab's* copy — it does not call Supabase to revoke the
  // token, so a legitimate session open elsewhere (the staff member's
  // original tab) is completely unaffected. Only the bridge session
  // created by a successful OTP verification (further down, in
  // `handleVerify`) is ever allowed to persist here.
  useEffect(() => {
    supabase.auth.signOut({ scope: 'local' }).catch(() => {
      /* nothing to clear, or storage unavailable — either way, fine */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Registration flow: validate the link on mount and trigger the first OTP.
  useEffect(() => {
    if (!linkToken) return;
    (async () => {
      try {
        const result = await consumeAccessLink(linkToken);
        setMaskedEmail(result.masked_email);
        setPortalType(result.portal_type);
        setStep('otp');
      } catch (err) {
        const apiErr = err as ApiError;
        setLinkError(apiErr.message || 'This link is invalid or has expired.');
        setStep('link-error');
      }
    })();
  }, [linkToken]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const handleRequestLoginOtp = async () => {
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    setSubmitting(true);
    try {
      await requestLoginOtp(email.trim(), portalType);
      toast.success('If that account exists, a verification code has been sent.');
      setStep('otp');
      setResendCooldown(30);
    } catch (err) {
      toast.error((err as ApiError).message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setSubmitting(true);
    try {
      if (linkToken) {
        const result = await requestRegistrationOtp(linkToken);
        setMaskedEmail(result.masked_email);
      } else {
        await requestLoginOtp(email.trim(), portalType);
      }
      toast.success('A new code has been sent.');
      setResendCooldown(30);
    } catch (err) {
      toast.error((err as ApiError).message || 'Could not resend the code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (code.trim().length < 4) {
      toast.error('Enter the code you received');
      return;
    }
    setSubmitting(true);
    try {
      const result = linkToken
        ? await verifyRegistrationOtp(linkToken, code.trim())
        : await verifyLoginOtp(email.trim(), portalType, code.trim());

      // Exchange the bridge token for a REAL Supabase session — from
      // this point on, this person is logged in exactly like any
      // staff attorney/expert, and lands on the actual unmodified
      // portal pages (not a separate rebuilt one).
      const { error: sessionError } = await supabase.auth.verifyOtp({
        email: result.bridge_email,
        token: result.bridge_token,
        type: 'magiclink',
      });

      if (sessionError) {
        toast.error('We verified your code, but could not complete sign-in. Please try again.');
        setSubmitting(false);
        return;
      }

      toast.success(`Welcome, ${result.account.full_name}`);
      navigate(result.portal_path, { replace: true });
    } catch (err) {
      toast.error((err as ApiError).message || 'Invalid or expired code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-kutlwano-blue/8 via-background to-kutlwano-teal/6 p-4">
      <Helmet><title>Portal Sign In — Medico-Legal Assessment System</title></Helmet>

      {/* Background decoration — matches the staff sign-in page exactly */}
      <div className="absolute inset-0 bg-gradient-to-r from-kutlwano-blue/5 to-kutlwano-teal/5" />
      <div className="absolute -translate-x-1/2 -translate-y-1/2 top-0 left-0 h-64 w-64 rounded-full bg-kutlwano-blue/10 blur-3xl sm:h-96 sm:w-96" />
      <div className="absolute translate-x-1/2 translate-y-1/2 bottom-0 right-0 h-64 w-64 rounded-full bg-kutlwano-teal/10 blur-3xl sm:h-96 sm:w-96" />
      <div className="absolute top-20 right-20 hidden h-32 w-32 rotate-45 rounded-lg border-2 border-kutlwano-blue/20 animate-[spin_20s_linear_infinite] sm:block" />
      <div className="absolute bottom-32 left-20 hidden h-24 w-24 rounded-full border-2 border-kutlwano-teal/20 animate-pulse sm:block" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-4">
      <Card className="w-full animate-scale-in border-kutlwano-blue/20 bg-card/95 shadow-2xl shadow-kutlwano-blue/10 backdrop-blur-sm">
        <CardHeader className="items-center text-center">
          <img src={logoSrc} alt="Kutlwano & Associate" className="mb-3 h-12 w-12 object-contain sm:h-14 sm:w-14" />
          <CardTitle className="text-xl sm:text-2xl">Portal Sign In</CardTitle>
          <CardDescription>Referring Attorney &amp; Medical Expert access</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === 'loading-link' && (
            <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-kutlwano-blue" />
              Validating your access link…
            </div>
          )}

          {step === 'link-error' && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-destructive">{linkError}</p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setStep('login-request'); setLinkError(null); }}
              >
                Sign in with email instead
              </Button>
            </div>
          )}

          {step === 'login-request' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Portal</Label>
                <Select value={portalType} onValueChange={(v) => setPortalType(v as ExternalPortalType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attorney">Referring Attorney</SelectItem>
                    <SelectItem value="expert">Medical Expert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="portal-email">Email</Label>
                <Input
                  id="portal-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  onKeyDown={(e) => e.key === 'Enter' && handleRequestLoginOtp()}
                />
              </div>
              <Button
                className="w-full bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal hover:opacity-90"
                disabled={submitting}
                onClick={handleRequestLoginOtp}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {submitting ? 'Sending…' : 'Send Verification Code'}
              </Button>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-5">
              <p className="text-center text-sm text-muted-foreground">
                Enter the code sent to <span className="font-medium text-foreground">{maskedEmail || email}</span>
              </p>
              <div className="flex justify-center overflow-x-auto">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal hover:opacity-90"
                disabled={submitting}
                onClick={handleVerify}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                {submitting ? 'Verifying…' : 'Verify & Sign In'}
              </Button>
              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-50"
                disabled={resendCooldown > 0 || submitting}
                onClick={handleResend}
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't get a code? Resend"}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Small, always-visible footer — deliberately points at the
          attorney/expert-specific legal pages (not the internal staff
          /privacy, /terms), and switches with the selected portal type
          so an expert never lands on attorney-worded copy or vice versa.
          These are public routes (see App.tsx) precisely so they're
          reachable from here, before anyone has signed in. */}
      <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2 text-center text-xs text-muted-foreground">
        <Link
          to={portalType === 'expert' ? '/expert-portal/legal/privacy' : '/attorney-portal/legal/privacy'}
          className="hover:text-foreground hover:underline"
        >
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <Link
          to={portalType === 'expert' ? '/expert-portal/legal/terms' : '/attorney-portal/legal/terms'}
          className="hover:text-foreground hover:underline"
        >
          Terms
        </Link>
        <span aria-hidden="true">·</span>
        <Link
          to={portalType === 'expert' ? '/expert-portal/legal/help' : '/attorney-portal/legal/help'}
          className="hover:text-foreground hover:underline"
        >
          Help
        </Link>
      </footer>
      </div>
    </div>
  );
};

export default ExternalPortalSignIn;
