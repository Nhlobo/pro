import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Lock, ArrowLeft, Eye, EyeOff, Loader2, CheckCircle2, ShieldCheck,
} from 'lucide-react';
import familyBackground from '@/assets/family-background.png';

type Step = 'create' | 'success';

const rules = (pw: string) => ({
  length: pw.length >= 8,
  upper: /[A-Z]/.test(pw),
  lower: /[a-z]/.test(pw),
  number: /\d/.test(pw),
  symbol: /[^A-Za-z0-9]/.test(pw),
});

const Rule: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <div className={`flex items-center gap-2 text-xs ${ok ? 'text-emerald-400' : 'text-muted-foreground'}`}>
    <CheckCircle2 className={`h-3.5 w-3.5 ${ok ? 'opacity-100' : 'opacity-40'}`} />
    {label}
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

const ResetPassword: React.FC = () => {
  const [step, setStep] = useState<Step>('create');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const navigate = useNavigate();

  // Supabase appends a `type=recovery` access token to the URL hash;
  // detectSessionInUrl on the client picks it up automatically.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setSessionReady(true);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const r = rules(password);
  const allPass = r.length && r.upper && r.lower && r.number && r.symbol;
  const matches = password.length > 0 && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!allPass) {
      setError('Password does not meet all requirements.');
      return;
    }
    if (!matches) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
        return;
      }
      setStep('success');
    } catch {
      setError('Could not update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1428] relative overflow-hidden">
      <Helmet>
        <title>Reset Password - Medico-Legal Pro</title>
      </Helmet>

      <div
        className="absolute inset-0 bg-cover bg-center opacity-25"
        style={{ backgroundImage: `url(${familyBackground})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a1428]/95 via-[#0a1428]/85 to-[#102347]/90" />

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 pb-24">
        <Card className="w-full max-w-md bg-[#0f1e3a]/90 backdrop-blur-md border-kutlwano-blue/20 text-foreground dark shadow-2xl">
          <CardContent className="p-8 space-y-6">
            {step === 'create' && (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/auth')}
                  className="flex items-center gap-2 text-sm text-kutlwano-blue hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Sign In
                </button>

                <div className="text-center space-y-3 pt-2">
                  <div className="mx-auto w-16 h-16 rounded-2xl border border-kutlwano-blue/30 bg-kutlwano-blue/10 flex items-center justify-center">
                    <Lock className="h-7 w-7 text-kutlwano-blue" />
                  </div>
                  <h1 className="text-2xl font-bold">Create New Password</h1>
                  <p className="text-sm text-muted-foreground">
                    Enter and confirm your new password to secure your account.
                  </p>
                </div>

                {!sessionReady && (
                  <Alert>
                    <AlertDescription>
                      Verifying your reset link… If this persists, request a new link from the sign-in page.
                    </AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs tracking-wider uppercase text-muted-foreground">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="pl-10 pr-10"
                        required
                      />
                      <button type="button" onClick={() => setShowPw((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-1 pt-1">
                      <Rule ok={r.length} label="Minimum 8 characters" />
                      <Rule ok={r.upper} label="At least one uppercase letter" />
                      <Rule ok={r.lower} label="At least one lowercase letter" />
                      <Rule ok={r.number} label="At least one number" />
                      <Rule ok={r.symbol} label="At least one special character" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs tracking-wider uppercase text-muted-foreground">Confirm New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showCf ? 'text' : 'password'}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Confirm new password"
                        className="pl-10 pr-10"
                        required
                      />
                      <button type="button" onClick={() => setShowCf((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showCf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={loading || !sessionReady}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Reset Password
                  </Button>
                </form>

                <div className="flex items-center justify-center gap-4 text-xs text-kutlwano-blue/80 pt-2">
                  <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Secure</span>
                  <span className="text-kutlwano-blue/40">•</span>
                  <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Confidential</span>
                  <span className="text-kutlwano-blue/40">•</span>
                  <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Protected</span>
                </div>
              </>
            )}

            {step === 'success' && (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/auth')}
                  className="flex items-center gap-2 text-sm text-kutlwano-blue hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Sign In
                </button>

                <div className="text-center space-y-3 pt-2">
                  <div className="mx-auto w-16 h-16 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                  </div>
                  <h1 className="text-2xl font-bold">Password Reset Successful</h1>
                  <p className="text-sm text-muted-foreground">
                    Your password has been updated successfully.<br />
                    You can now sign in with your new password.
                  </p>
                </div>

                <Button className="w-full" onClick={async () => {
                  await supabase.auth.signOut();
                  navigate('/auth');
                }}>
                  Continue to Sign In
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
};

export default ResetPassword;
