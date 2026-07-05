import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, Lock, CheckCircle2 } from 'lucide-react';

const logoSrc = '/lovable-uploads/7401e32a-2457-4a00-9d60-c1ff9fcfc4fc.png';

type LinkStatus = 'checking' | 'valid' | 'invalid';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Landing page for the link sent by supabase.auth.resetPasswordForEmail()
 * (triggered from the "Forgot Password?" flow on /auth).
 *
 * Supabase's client automatically exchanges the token in the URL for a
 * temporary "recovery" session before this component ever renders
 * (detectSessionInUrl is on by default). We just have to:
 *  1. Confirm that recovery session actually landed (the link can be
 *     expired, already used, or malformed).
 *  2. Let the person set a new password via supabase.auth.updateUser().
 *  3. Sign them out of the temporary recovery session and send them to
 *     /auth to sign in fresh with the new password.
 *
 * No backend/database changes required — this only talks to the Supabase
 * Auth client already used everywhere else in the app.
 */
const ResetPassword = () => {
  const [linkStatus, setLinkStatus] = useState<LinkStatus>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let active = true;

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') {
        setLinkStatus('valid');
      }
    });

    // In case the PASSWORD_RECOVERY event already fired before this
    // component mounted its listener, fall back to checking directly.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setLinkStatus((current) => (current === 'checking' ? (data.session ? 'valid' : 'invalid') : current));
    });

    // Safety net: if nothing resolves within a few seconds, treat as invalid
    // rather than leaving the person staring at a spinner forever.
    const timeout = window.setTimeout(() => {
      setLinkStatus((current) => (current === 'checking' ? 'invalid' : current));
    }, 5000);

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  const isSubmitDisabled =
    submitting ||
    password.length < MIN_PASSWORD_LENGTH ||
    password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      setDone(true);
      toast({
        title: 'Password updated',
        description: 'Your password has been changed. Please sign in again.',
      });

      // The recovery session is a temporary, limited-purpose session —
      // sign out and send them to sign in fresh with the new password.
      await supabase.auth.signOut();
      window.setTimeout(() => navigate('/auth', { replace: true }), 1500);
    } catch {
      setError('Unable to update your password right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F5EE]">
      <Helmet>
        <title>Reset Password - Medico-Legal Pro</title>
        <meta name="description" content="Set a new password for your Medico-Legal Pro account." />
      </Helmet>

      <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-2">
        {/* Left brand panel — full-bleed teal→white gradient, matches /auth */}
        <aside className="relative hidden flex-col justify-between overflow-hidden gradient-nav p-10 text-white lg:flex">
          <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

          <div className="relative flex items-center gap-3">
            <div className="rounded-full bg-white/15 p-2 ring-2 ring-white/30 backdrop-blur">
              <img src={logoSrc} alt="Kutlwano & Associate" className="h-12 w-12 object-contain" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-wide">Medico-Legal Pro</div>
              <div className="text-xs text-white/80">Kutlwano &amp; Associate</div>
            </div>
          </div>

          <div className="relative space-y-4">
            <h1 className="text-4xl font-bold leading-tight xl:text-5xl">
              Choose a new<br />password.
            </h1>
            <p className="max-w-md text-sm text-white/85 xl:text-base">
              Set a fresh password to get back into your workspace securely.
            </p>
          </div>

          <div className="relative text-xs text-white/70">
            © {new Date().getFullYear()} Kutlwano &amp; Associate (Pty) Ltd
          </div>
        </aside>

        {/* Right form panel */}
        <main className="flex items-center justify-center bg-white p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
              <div className="rounded-full bg-gradient-to-br from-[#00BAAD] to-white p-2 ring-2 ring-[#00BAAD]/40 shadow-lg">
                <img src={logoSrc} alt="Kutlwano & Associate" className="h-14 w-14 object-contain" />
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">Medico-Legal Pro</div>
                <div className="text-xs text-slate-500">Kutlwano &amp; Associate</div>
              </div>
            </div>

            {linkStatus === 'checking' && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-[#00BAAD]" />
                <p className="text-sm text-slate-600">Checking your reset link...</p>
              </div>
            )}

            {linkStatus === 'invalid' && (
              <>
                <div className="mb-6">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00BAAD]">Staff access</div>
                  <h2 className="mt-2 text-2xl font-bold text-black">Link expired</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    This password reset link is invalid or has expired. Reset links are only valid for a
                    limited time and can only be used once.
                  </p>
                </div>
                <Link to="/auth">
                  <Button className="h-12 w-full rounded-none bg-black font-semibold uppercase tracking-wide text-white hover:bg-black/85">
                    Back to sign in
                  </Button>
                </Link>
              </>
            )}

            {linkStatus === 'valid' && !done && (
              <>
                <div className="mb-6">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00BAAD]">Staff access</div>
                  <h2 className="mt-2 text-2xl font-bold text-black">Set New Password</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Choose a new password for your account.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-sm font-semibold text-black">New Password</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Enter your new password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-12 rounded-none border-black/15 bg-white pl-11 pr-11 text-black placeholder:text-slate-500 focus-visible:ring-[#00BAAD]"
                        required
                        minLength={MIN_PASSWORD_LENGTH}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-black"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">At least {MIN_PASSWORD_LENGTH} characters.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-sm font-semibold text-black">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Re-enter your new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-12 rounded-none border-black/15 bg-white pl-11 pr-11 text-black placeholder:text-slate-500 focus-visible:ring-[#00BAAD]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-black"
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showConfirmPassword}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitDisabled}
                    className="h-12 w-full rounded-none bg-black font-semibold uppercase tracking-wide text-white hover:bg-black/85"
                  >
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Password
                  </Button>
                </form>
              </>
            )}

            {linkStatus === 'valid' && done && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-[#00BAAD]" />
                <h2 className="text-xl font-bold text-black">Password updated</h2>
                <p className="text-sm text-slate-600">Taking you back to sign in...</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ResetPassword;
