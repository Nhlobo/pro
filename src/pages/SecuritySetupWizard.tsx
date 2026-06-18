import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, KeyRound, Mail, CheckCircle2 } from "lucide-react";
import { passwordPolicyMessage } from "@/lib/passwordPolicy";

type Step = 1 | 2 | 3 | 4;

const SecuritySetupWizard = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activationToken, setActivationToken] = useState<string | null>(null);
  const [legacyMode, setLegacyMode] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [otp, setOtp] = useState("");

  useEffect(() => {
    const t = sessionStorage.getItem("mlp_activation_token");
    const e = sessionStorage.getItem("mlp_activation_email");
    if (t) { setActivationToken(t); setEmail(e || ""); return; }
    // Legacy user — needs an existing supabase session
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth", { replace: true }); return; }
      setLegacyMode(true);
      setEmail(session.user.email || "");
    })();
  }, [navigate]);

  const invokeWizard = async (body: Record<string, unknown>) => {
    const payload = { ...body, ...(activationToken ? { activationToken } : {}) };
    return await supabase.functions.invoke("auth-setup-wizard", { body: payload });
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (pw !== pw2) { setError("Passwords do not match"); return; }
    const policyError = passwordPolicyMessage(pw);
    if (policyError) { setError(policyError); return; }
    setLoading(true);
    const { data, error } = await invokeWizard({ action: "set-password", password: pw });
    setLoading(false);
    if (error || !data?.success) { setError(data?.error || "Failed to set password"); return; }
    // Send OTP for email verification
    setLoading(true);
    const { data: d2, error: e2 } = await invokeWizard({ action: "send-setup-otp" });
    setLoading(false);
    if (e2 || !d2?.success) { setError(d2?.error || "Failed to send code"); return; }
    setStep(3);
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { data, error } = await invokeWizard({ action: "verify-setup-otp", otp });
    setLoading(false);
    if (error || !data?.success) { setError(data?.error || "Invalid code"); return; }
    sessionStorage.removeItem("mlp_activation_token");
    sessionStorage.removeItem("mlp_activation_email");
    setStep(4);
  };

  const finish = async () => {
    // For activation flow we are not signed in yet — send to login.
    if (activationToken && !legacyMode) {
      navigate("/auth", { replace: true });
      return;
    }
    // Legacy: re-fetch session and go home
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2"><ShieldCheck className="h-8 w-8 text-primary" /></div>
          <CardTitle>Security Setup</CardTitle>
          <CardDescription>
            Step {step} of 4 — {step === 1 ? "Welcome" : step === 2 ? "Create password" : step === 3 ? "Verify email" : "All set"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          {step === 1 && (
            <div className="space-y-4 text-sm">
              <p>For your security we'll guide you through a short setup:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Create a strong password</li>
                <li>Verify your work email with a one-time code</li>
              </ul>
              <p>This only takes a minute and you won't see it again.</p>
              <Button className="w-full" onClick={() => setStep(2)}>Get started</Button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={submitPassword} className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> New password</Label>
                <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Confirm new password</Label>
                <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum 12 characters with upper-case, lower-case, number and special character.
              </p>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue
              </Button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={submitOtp} className="space-y-4">
              <p className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" /> A 6-digit code has been emailed to {email || "your work email"}.</p>
              <div className="space-y-2">
                <Label>Verification code</Label>
                <Input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} required maxLength={6} inputMode="numeric" />
              </div>
              <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify
              </Button>
              <Button type="button" variant="ghost" className="w-full" disabled={loading}
                onClick={async () => {
                  setError("");
                  setLoading(true);
                  await invokeWizard({ action: "send-setup-otp" });
                  setLoading(false);
                }}>
                Resend code
              </Button>
            </form>
          )}

          {step === 4 && (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
              <p className="text-sm">Your account is fully set up.</p>
              <Button className="w-full" onClick={finish}>Continue</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SecuritySetupWizard;
