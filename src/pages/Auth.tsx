import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { getDashboardPathForRole, isValidPortalRole } from '@/utils/authRoutes';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';

const logoSrc = '/lovable-uploads/7401e32a-2457-4a00-9d60-c1ff9fcfc4fc.png';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authMode, setAuthMode] = useState<'sign-in' | 'forgot-password'>('sign-in');
  const [resetLoading, setResetLoading] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const authLinkRowClass = useMemo(
    () => 'grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 sm:gap-3 sm:text-sm',
    []
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      emailInputRef.current?.focus({ preventScroll: true });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [authMode]);

  useEffect(() => {
    const ensureNoSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: roleData } = await supabase.rpc('get_current_user_role');
        navigate(getDashboardPathForRole(roleData as string | null), { replace: true });
      }
    };
    ensureNoSession();
  }, [navigate]);

  const cleanupAuthState = () => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
  };

  const handlePasswordKeyState = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      cleanupAuthState();
      const cleanEmail = email.trim();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('invalid login credentials')) {
          setError('Invalid email or password. Please check your credentials and try again.');
        } else if (msg.includes('confirm')) {
          localStorage.setItem('pendingConfirmationEmail', cleanEmail);
          navigate(`/email-confirmation?email=${encodeURIComponent(cleanEmail)}`, { replace: true });
        } else {
          setError(error.message);
        }
        return;
      }

      if (data.user) {
        if (data.user.email === 'boshomane@kutlwanoassociate.com') {
          toast({
            title: 'Welcome back, Mr. Boshomane!',
            description: 'You have full administrative access to the system.',
          });
          window.location.replace(getDashboardPathForRole('admin'));
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, user_type, first_name, last_name, position')
          .eq('id', data.user.id)
          .single();

        if (profile) {
          const userType = profile.user_type || 'user';
          const role = profile.role || 'user';
          const userName = profile.first_name
            ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ''}`
            : data.user.email?.split('@')[0];

          const { data: userRoleData } = await supabase.rpc('get_current_user_role');
          const secureRole = (userRoleData as string) || role;

          const hasValidRole = isValidPortalRole(secureRole) || isValidPortalRole(role);
          const hasValidUserType = isValidPortalRole(userType);

          if (hasValidRole || hasValidUserType) {
            if (userType === 'admin' || secureRole === 'admin' || role === 'admin') {
              toast({ title: `Welcome back, ${userName}!`, description: 'You have successfully signed in with admin privileges.' });
            } else if (userType === 'employee' || secureRole === 'employee' || role === 'employee') {
              const position = profile.position ? ` (${profile.position})` : '';
              toast({ title: `Welcome back, ${userName}${position}!`, description: 'You have successfully signed in as an employee.' });
            } else if (secureRole === 'sales_consultant' || userType === 'sales_consultant') {
              const position = profile.position ? ` (${profile.position})` : '';
              toast({ title: `Welcome back, ${userName}${position}!`, description: 'You have successfully signed in as a Sales Consultant.' });
            } else if (userType === 'referring_attorney' || secureRole === 'referring_attorney' || role === 'referring_attorney') {
              toast({ title: `Welcome back, ${userName}!`, description: 'You have successfully signed in. You can access your referring attorney data.' });
            } else if (secureRole === 'medical_expert' || userType === 'medical_expert') {
              toast({ title: `Welcome back, ${userName}!`, description: 'You have successfully signed in as a Medical Expert.' });
            } else {
              toast({ title: `Welcome back, ${userName}!`, description: 'You have successfully signed in.' });
            }
          } else {
            await supabase.auth.signOut();
            setError('Access not authorized. Please contact your administrator for assistance.');
            return;
          }

          window.location.replace(getDashboardPathForRole(secureRole, userType));
        } else if (profileError) {
          console.error('Profile fetch error:', profileError);
          await supabase.auth.signOut();
          setError('Unable to verify account permissions. Please contact support.');
          return;
        } else {
          await supabase.auth.signOut();
          setError('Account not found or access not authorized. Please contact support.');
          return;
        }
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Enter your work email address before requesting a password reset link.');
      return;
    }

    setResetLoading(true);
    setError('');

    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
      if (error) {
        setError(error.message);
        return;
      }
      toast({ title: 'Reset link sent', description: 'Check your email for the password reset link.' });
      setAuthMode('sign-in');
    } catch {
      setError('Unable to send a reset link right now. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const isSignInDisabled = loading || !email.trim() || !password.trim();
  const isResetDisabled = resetLoading || !email.trim();

  return (
    <div className="min-h-screen w-full bg-[#F7F5EE]">
      <Helmet>
        <title>Sign In - Medico-Legal Pro</title>
        <meta name="description" content="Sign in to access the Medico-Legal Pro portal — Kutlwano & Associate." />
      </Helmet>

      <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-2">
        {/* Left brand panel — full-bleed teal→white gradient */}
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
              We touch a file.<br />We change lives.
            </h1>
            <p className="max-w-md text-sm text-white/85 xl:text-base">
              Sign in with your authorised staff account to access your assigned workspace and manage medico-legal cases.
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

            <div className="mb-6">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00BAAD]">Staff access</div>
              <h2 className="mt-2 text-2xl font-bold text-black">
                {authMode === 'sign-in' ? 'Staff Sign In' : 'Forgot Password'}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {authMode === 'sign-in'
                  ? 'Welcome back. Please sign in to continue.'
                  : 'Enter your work email to receive a password reset link.'}
              </p>
            </div>

            {authMode === 'sign-in' ? (
              <form onSubmit={handleSignIn} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-black">Email Address</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="email"
                      ref={emailInputRef}
                      type="email"
                      autoComplete="email"
                      placeholder="you@firm.co.za"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 rounded-none border-black/15 bg-white pl-11 text-black placeholder:text-slate-500 focus-visible:ring-[#00BAAD]"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-black">Password</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyUp={handlePasswordKeyState}
                      onKeyDown={handlePasswordKeyState}
                      className="h-12 rounded-none border-black/15 bg-white pl-11 pr-11 text-black placeholder:text-slate-500 focus-visible:ring-[#00BAAD]"
                      required
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

                  {capsLockOn && (
                    <p className="text-xs font-medium text-amber-600">Caps Lock is on.</p>
                  )}
                </div>

                <div className={authLinkRowClass}>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('forgot-password'); setError(''); }}
                    className="truncate text-left font-semibold text-black hover:text-[#00BAAD] hover:underline"
                  >
                    Forgot Password?
                  </button>
                  <Link
                    to="/help"
                    className="truncate text-left font-semibold text-black hover:text-[#00BAAD] hover:underline sm:text-right"
                  >
                    Need help?
                  </Link>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={isSignInDisabled}
                  className="h-12 w-full rounded-none bg-black font-semibold uppercase tracking-wide text-white hover:bg-black/85"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>

                <PwaInstallPrompt />
              </form>
            ) : (
              <form onSubmit={handleForgotPasswordRequest} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-sm font-semibold text-black">Email Address</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="reset-email"
                      ref={emailInputRef}
                      type="email"
                      autoComplete="email"
                      placeholder="you@firm.co.za"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 rounded-none border-black/15 bg-white pl-11 text-black placeholder:text-slate-500 focus-visible:ring-[#00BAAD]"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Button
                    type="submit"
                    disabled={isResetDisabled}
                    className="h-12 rounded-none bg-black font-semibold uppercase tracking-wide text-white hover:bg-black/85"
                  >
                    {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Reset Link
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setAuthMode('sign-in'); setError(''); }}
                    className="h-12 rounded-none border-black/15 bg-transparent font-semibold uppercase tracking-wide text-black hover:bg-black/5"
                  >
                    Back
                  </Button>
                </div>
              </form>
            )}

            <div className="mt-8 border-t border-black/10 pt-4 text-center text-xs text-slate-500">
              <div className="flex items-center justify-center gap-3">
                <Link to="/privacy" className="hover:text-[#00BAAD]">Privacy</Link>
                <span>|</span>
                <Link to="/terms" className="hover:text-[#00BAAD]">Terms</Link>
                <span>|</span>
                <Link to="/help" className="hover:text-[#00BAAD]">Help</Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Auth;
