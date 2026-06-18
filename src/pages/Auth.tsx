import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail } from 'lucide-react';
import consultationImage from '@/assets/consultation-image.png';
import familyBackground from '@/assets/family-background.png';
import { setSessionToken } from '@/lib/sessionToken';

type Step = 'credentials' | 'otp';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<Step>('credentials');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) localStorage.removeItem(key);
    });
  };

  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      cleanupAuthState();
      const { data, error } = await supabase.functions.invoke('auth-request-login-otp', {
        body: { email: email.trim(), password },
      });
      if (error || !data?.success) {
        setError((data?.error as string) || 'Invalid credentials');
        return;
      }
      setStep('otp');
      toast({ title: 'Verification code sent', description: 'Check your email for a 6-digit code.' });
    } catch {
      setError('Unexpected error. Please try again.');
    } finally { setLoading(false); }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data, error } = await supabase.functions.invoke('auth-verify-login-otp', {
        body: { email: email.trim(), password, otp },
      });
      if (error || !data?.success) {
        setError((data?.error as string) || 'Invalid code');
        return;
      }
      // Set the session into Supabase client.
      const session = data.session as { access_token: string; refresh_token: string };
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      setSessionToken(data.session_token);

      if (!data.security_setup_completed || data.must_reset_password) {
        navigate('/security-setup', { replace: true });
      } else {
        window.location.href = '/';
      }
    } catch {
      setError('Unexpected error. Please try again.');
    } finally { setLoading(false); }
  };

  const resendOtp = async () => {
    setLoading(true);
    try {
      await supabase.functions.invoke('auth-resend-otp', { body: { email: email.trim() } });
      toast({ title: 'Code resent' });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-kutlwano-blue/8 via-background to-kutlwano-teal/6 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{ backgroundImage: `url(${familyBackground})` }} />
      <div className="absolute inset-0 bg-gradient-to-r from-kutlwano-blue/5 to-kutlwano-teal/5" />

      <Helmet>
        <title>Sign In - Medico-Legal Pro</title>
        <meta name="description" content="Sign in securely to the Medico-Legal Pro portal." />
      </Helmet>

      <div className="w-full max-w-6xl mx-auto grid lg:grid-cols-2 gap-8 items-center relative z-10">
        <div className="hidden lg:flex flex-col items-center justify-center space-y-6 animate-fade-in">
          <div className="relative group">
            <img src={consultationImage} alt="Professional Consultation" className="w-full h-auto rounded-2xl shadow-2xl" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal bg-clip-text text-transparent">We touch a file</h2>
            <p className="text-4xl font-bold text-foreground">We change lives.</p>
          </div>
        </div>

        <Card className="w-full backdrop-blur-sm bg-card/95 border-kutlwano-blue/20 shadow-2xl animate-scale-in">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <img src="/lovable-uploads/7401e32a-2457-4a00-9d60-c1ff9fcfc4fc.png" alt="Kutlwano & Associate" className="h-12 w-12" />
            </div>
            <CardTitle className="text-2xl">{step === 'credentials' ? 'Welcome Back' : 'Verify your identity'}</CardTitle>
            <CardDescription>
              {step === 'credentials'
                ? 'Sign in to access your Medico-Legal Pro portal'
                : 'Enter the 6-digit code we just emailed you.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'credentials' ? (
              <form onSubmit={submitCredentials} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Continue
                </Button>
                <div className="text-center">
                  <button type="button" className="text-sm text-primary underline" onClick={() => navigate('/forgot-password')}>
                    Forgot password?
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={submitOtp} className="space-y-4">
                <p className="text-sm flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" /> Code sent to {email}</p>
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification code</Label>
                  <Input id="otp" inputMode="numeric" maxLength={6} value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} required />
                </div>
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Verify & sign in
                </Button>
                <div className="flex justify-between text-sm">
                  <button type="button" className="text-primary underline" onClick={resendOtp} disabled={loading}>Resend code</button>
                  <button type="button" className="text-muted-foreground underline" onClick={() => { setStep('credentials'); setOtp(''); setError(''); }}>
                    Use different account
                  </button>
                </div>
              </form>
            )}

            <div className="mt-6 pt-4 border-t text-center text-sm text-muted-foreground">
              <p>For assistance, please contact support</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
