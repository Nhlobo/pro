import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Mail, Lock, ArrowLeft, Eye, EyeOff,
  ShieldCheck, CheckCircle2, User,
} from 'lucide-react';
import familyBackground from '@/assets/family-background.png';

type Step = 'sign-in' | 'forgot' | 'check-email';

const SecurityBadges = () => (
  <div className="flex items-center justify-center gap-4 text-xs text-kutlwano-blue/80 pt-2">
    <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Secure</span>
    <span className="text-kutlwano-blue/40">•</span>
    <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Confidential</span>
    <span className="text-kutlwano-blue/40">•</span>
    <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Protected</span>
  </div>
);

const Footer = () => (
  <div className="absolute bottom-0 left-0 right-0 border-t border-white/5 bg-background/40 backdrop-blur-sm">
    <div className="max-w-md mx-auto px-6 py-3 flex items-center justify-between text-xs text-muted-foreground">
      <span>© 2015–{new Date().getFullYear()} Kutlwano & Associates (Pty) Ltd. All rights reserved.</span>
      <div className="flex gap-3">
        <a href="#" className="hover:text-foreground transition">Privacy Policy</a>
        <span>|</span>
        <a href="#" className="hover:text-foreground transition">Terms of Use</a>
      </div>
    </div>
  </div>
);

const Auth = () => {
  const [step, setStep] = useState<Step>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSentTo, setResetSentTo] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) navigate('/');
    };
    check();
  }, [navigate]);

  const cleanupAuthState = () => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
  };

  // ---------- SIGN IN ----------
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const emailAddress = email.trim().toLowerCase();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailAddress,
        password,
      });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('invalid login credentials')) {
          setError('Invalid email or password. Please check your details or use Forgot Password to reset access.');
        } else if (msg.includes('confirm')) {
          localStorage.setItem('pendingConfirmationEmail', emailAddress);
          navigate(`/email-confirmation?email=${encodeURIComponent(emailAddress)}`);
        } else {
          setError(error.message);
        }
        return;
      }
      if (data.user) {
        if (data.user.email === 'boshomane@kutlwanoassociate.com') {
          toast({ title: 'Welcome back, Mr. Boshomane!', description: 'Full administrative access.' });
          window.location.href = '/';
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role, user_type, first_name, last_name, position')
          .eq('id', data.user.id)
          .maybeSingle();

        const userName = profile?.first_name
          ? `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}`
          : data.user.email?.split('@')[0];

        toast({ title: `Welcome back, ${userName}!`, description: 'You have successfully signed in.' });
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Sign-in failed:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ---------- FORGOT PASSWORD ----------
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const target = email.trim().toLowerCase();
      const { error } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setResetSentTo(target);
      setStep('check-email');
    } catch {
      setError('Could not send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ---------- RENDER ----------
  return (
    <div className="min-h-screen bg-[#0a1428] relative overflow-hidden">
      <Helmet>
        <title>Sign In - Medico-Legal Pro</title>
        <meta name="description" content="Secure sign-in to the Medico-Legal Pro portal." />
      </Helmet>

      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-25"
        style={{ backgroundImage: `url(${familyBackground})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a1428]/95 via-[#0a1428]/85 to-[#102347]/90" />

      {/* Card */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 pb-24">
        <Card className="w-full max-w-md bg-[#0f1e3a]/90 backdrop-blur-md border-kutlwano-blue/20 text-foreground dark shadow-2xl">
          <CardContent className="p-8 space-y-6">
            {step === 'sign-in' && (
              <>
                <div className="text-center space-y-2">
                  <div className="flex justify-center mb-2">
                    <img
                      src="/lovable-uploads/7401e32a-2457-4a00-9d60-c1ff9fcfc4fc.png"
                      alt="Kutlwano & Associates"
                      className="h-16 w-16"
                    />
                  </div>
                  <div className="text-center -mt-1">
                    <div className="text-base font-bold tracking-[0.15em] text-foreground">KUTLWANO</div>
                    <div className="text-[10px] tracking-[0.2em] text-muted-foreground">
                      &amp; ASSOCIATES (PTY) LTD
                    </div>
                    <div className="text-[10px] tracking-[0.3em] text-kutlwano-blue mt-0.5">
                      MEDICO-LEGAL SERVICES
                    </div>
                  </div>
                  <h1 className="text-2xl font-bold text-foreground pt-3">Welcome Back</h1>
                  <p className="text-sm text-muted-foreground">Sign in to access your account</p>
                </div>

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs tracking-wider uppercase text-muted-foreground">
                      Email Address
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs tracking-wider uppercase text-muted-foreground">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={rememberMe}
                        onCheckedChange={(v) => setRememberMe(Boolean(v))}
                      />
                      <span className="text-muted-foreground">Remember me</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => { setError(''); setStep('forgot'); }}
                      className="text-kutlwano-blue hover:underline font-medium"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                </form>
                <SecurityBadges />
              </>
            )}

            {step === 'forgot' && (
              <>
                <button
                  type="button"
                  onClick={() => { setError(''); setStep('sign-in'); }}
                  className="flex items-center gap-2 text-sm text-kutlwano-blue hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Sign In
                </button>

                <div className="text-center space-y-3 pt-2">
                  <div className="mx-auto w-16 h-16 rounded-2xl border border-kutlwano-blue/30 bg-kutlwano-blue/10 flex items-center justify-center">
                    <Mail className="h-7 w-7 text-kutlwano-blue" />
                  </div>
                  <h1 className="text-2xl font-bold">Reset Password</h1>
                  <p className="text-sm text-muted-foreground">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
                </div>

                <form onSubmit={handleForgot} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-email" className="text-xs tracking-wider uppercase text-muted-foreground">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Reset Link
                  </Button>
                </form>
                <SecurityBadges />
              </>
            )}

            {step === 'check-email' && (
              <>
                <button
                  type="button"
                  onClick={() => { setError(''); setStep('sign-in'); }}
                  className="flex items-center gap-2 text-sm text-kutlwano-blue hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Sign In
                </button>

                <div className="text-center space-y-3 pt-2">
                  <div className="mx-auto w-16 h-16 rounded-2xl border border-kutlwano-blue/30 bg-kutlwano-blue/10 flex items-center justify-center">
                    <Mail className="h-7 w-7 text-kutlwano-blue" />
                  </div>
                  <h1 className="text-2xl font-bold">Check Your Email</h1>
                  <p className="text-sm text-muted-foreground">We've sent a password reset link to</p>
                  <p className="font-semibold text-foreground">{resetSentTo}</p>
                  <p className="text-xs text-muted-foreground">The link will expire in 60 minutes.</p>
                </div>

                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-start gap-2 text-sm text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>If you don't see the email, check your spam or junk folder.</span>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { setError(''); setStep('sign-in'); }}
                >
                  Back to Sign In
                </Button>
                <SecurityBadges />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
};

export default Auth;
