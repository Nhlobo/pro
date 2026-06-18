import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { passwordPolicyMessage } from "@/lib/passwordPolicy";

const ResetPassword = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState<string>("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = params.get("token");
    if (!t) { setError("Missing reset token"); return; }
    setToken(t);
  }, [params]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (pw !== pw2) { setError("Passwords do not match"); return; }
    const policyError = passwordPolicyMessage(pw);
    if (policyError) { setError(policyError); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("auth-complete-password-reset", {
        body: { token, newPassword: pw },
      });
      if (error || !data?.success) {
        setError(data?.error || "Unable to reset password. The link may have expired.");
        return;
      }
      setDone(true);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>Choose a new password. You will then sign in with your new password and a verification code.</CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-4 text-sm">
              <p>Password updated. Please sign in.</p>
              <Button className="w-full" onClick={() => navigate("/auth")}>Go to sign in</Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label>New password</Label>
                <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Confirm new password</Label>
                <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum 12 characters, with upper-case, lower-case, number and special character.
              </p>
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <Button type="submit" className="w-full" disabled={loading || !token}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
