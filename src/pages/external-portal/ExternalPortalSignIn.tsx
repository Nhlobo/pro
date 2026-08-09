import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  consumeAccessLink,
  requestRegistrationOtp,
  requestLoginOtp,
  verifyRegistrationOtp,
  verifyLoginOtp,
  type ApiError,
} from '@/services/externalPortal/externalPortalAuthClient';
import type { ExternalPortalType } from '@/types/externalPortal';

/**
 * External Portal Sign In — the ONE shared sign-in flow for both the
 * Referring Attorney Portal and the Medical Expert Portal, per the
 * architecture requirement that both portal types use exactly the
 * same authentication flow.
 *
 * Two entry paths into the same OTP step:
 *  - `?token=...` in the URL -> one-time registration link (Phase 2 flow:
 *    Admin creates access -> link emailed -> user opens it here).
 *  - No token -> returning user -> email + portal type -> OTP login.
 *
 * This page never touches the app's normal Supabase auth session —
 * see useExternalPortalSession.
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

      window.localStorage.setItem('external_portal_session', JSON.stringify({
        session_token: result.session_token,
        expires_at: result.expires_at,
        portal_type: result.portal_type,
        full_name: result.account.full_name,
        email: result.account.email,
      }));
      toast.success(`Welcome, ${result.account.full_name}`);
      // Reconnected to the old External Portal (2026-08-07): route into
      // /attorney-portal or /expert-portal instead of the new module's
      // own /external-portal/home, which is now unwired.
      navigate(result.portal_type === 'expert' ? '/expert-portal' : '/attorney-portal', { replace: true });
    } catch (err) {
      toast.error((err as ApiError).message || 'Invalid or expired code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="brand-legal-theme flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Helmet><title>External Portal Sign In</title></Helmet>

      <Card className="w-full max-w-md rounded-none border-black/10 shadow-sm">
        <CardHeader className="items-center text-center">
          <ShieldCheck className="mb-2 h-8 w-8 text-[#00BAAD]" />
          <CardTitle>External Portal Sign In</CardTitle>
          <CardDescription>Referring Attorney &amp; Medical Expert access</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === 'loading-link' && (
            <div className="flex flex-col items-center gap-3 py-8 text-sm text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
              Validating your access link…
            </div>
          )}

          {step === 'link-error' && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-destructive">{linkError}</p>
              <Button variant="outline" className="rounded-none border-black/15" onClick={() => { setStep('login-request'); setLinkError(null); }}>
                Sign in with email instead
              </Button>
            </div>
          )}

          {step === 'login-request' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Portal</Label>
                <Select value={portalType} onValueChange={(v) => setPortalType(v as ExternalPortalType)}>
                  <SelectTrigger className="rounded-none border-black/15"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attorney">Referring Attorney</SelectItem>
                    <SelectItem value="expert">Medical Expert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  className="rounded-none border-black/15"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  onKeyDown={(e) => e.key === 'Enter' && handleRequestLoginOtp()}
                />
              </div>
              <Button
                className="w-full rounded-none bg-black text-white hover:bg-black/85"
                disabled={submitting}
                onClick={handleRequestLoginOtp}
              >
                {submitting ? 'Sending…' : 'Send Verification Code'}
              </Button>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-5">
              <p className="text-center text-sm text-slate-600">
                Enter the code sent to <span className="font-medium text-black">{maskedEmail || email}</span>
              </p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button
                className="w-full rounded-none bg-black text-white hover:bg-black/85"
                disabled={submitting}
                onClick={handleVerify}
              >
                {submitting ? 'Verifying…' : 'Verify & Sign In'}
              </Button>
              <button
                type="button"
                className="w-full text-center text-xs text-slate-500 underline disabled:opacity-50"
                disabled={resendCooldown > 0 || submitting}
                onClick={handleResend}
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't get a code? Resend"}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExternalPortalSignIn;
