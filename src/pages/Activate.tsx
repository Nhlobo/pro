import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, KeyRound } from "lucide-react";
import { passwordPolicyMessage } from "@/lib/passwordPolicy";
import { toast } from "@/hooks/use-toast";

type Status = "validating" | "ready" | "submitting" | "invalid";

const Activate = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");

  const [status, setStatus] = useState<Status>("validating");
  const [info, setInfo] = useState<{ email?: string; first_name?: string }>({});
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("auth-activate-account", { body: { token } });
        if (error || !data?.valid) { setStatus("invalid"); return; }
        setInfo({ email: data.email, first_name: data.first_name });
        setStatus("ready");
      } catch {
        setStatus("invalid");
      }
    })();
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (pw !== pw2) { setError("Passwords do not match"); return; }
    const policyError = passwordPolicyMessage(pw);
    if (policyError) { setError(policyError); return; }
    setStatus("submitting");
    const { data, error } = await supabase.functions.invoke("auth-setup-wizard", {
      body: { action: "complete-activation", activationToken: token, password: pw },
    });
    if (error || !data?.success) {
      setError(data?.error || "Activation failed. The link may have expired.");
      setStatus("ready");
      return;
    }
    toast({
      title: "Account activated successfully",
      description: "Please sign in using your email and new password.",
    });
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2"><ShieldCheck className="h-8 w-8 text-primary" /></div>
          <CardTitle>
            {status === "invalid" ? "Activation Link Invalid" : "Activate Your Account"}
          </CardTitle>
          <CardDescription>
            {status === "validating" && "Verifying your activation link…"}
            {status === "ready" && `Welcome${info.first_name ? `, ${info.first_name}` : ""}. Create a password to finish setting up your account${info.email ? ` (${info.email})` : ""}.`}
            {status === "submitting" && "Activating your account…"}
            {status === "invalid" && "This activation link is invalid or has expired. Please ask an administrator to resend it."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "validating" && (
            <div className="text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          )}

          {(status === "ready" || status === "submitting") && (
            <form onSubmit={onSubmit} className="space-y-4">
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> New password</Label>
                <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required autoFocus />
              </div>
              <div className="space-y-2">
                <Label>Confirm new password</Label>
                <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum 12 characters with upper-case, lower-case, number and special character.
              </p>
              <Button type="submit" className="w-full" disabled={status === "submitting"}>
                {status === "submitting" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Activate Account
              </Button>
            </form>
          )}

          {status === "invalid" && (
            <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
              Back to sign in
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Activate;
