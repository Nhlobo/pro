import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";

const Activate = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ok" | "bad">("loading");
  const [info, setInfo] = useState<{ email?: string; first_name?: string }>({});

  useEffect(() => {
    const token = params.get("token");
    if (!token) { setStatus("bad"); return; }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("auth-activate-account", { body: { token } });
        if (error || !data?.valid) { setStatus("bad"); return; }
        setInfo({ email: data.email, first_name: data.first_name });
        setStatus("ok");
        sessionStorage.setItem("mlp_activation_token", token);
        sessionStorage.setItem("mlp_activation_email", data.email || "");
        // Forward to setup wizard
        navigate("/security-setup", { replace: true });
      } catch {
        setStatus("bad");
      }
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2"><ShieldCheck className="h-8 w-8 text-primary" /></div>
          <CardTitle>Account Activation</CardTitle>
          <CardDescription>
            {status === "loading" && "Verifying your activation link…"}
            {status === "ok" && `Welcome${info.first_name ? `, ${info.first_name}` : ""}. Redirecting…`}
            {status === "bad" && "This activation link is invalid or has expired."}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === "loading" && <Loader2 className="h-6 w-6 animate-spin mx-auto" />}
          {status === "bad" && (
            <button className="text-sm text-primary underline" onClick={() => navigate("/auth")}>
              Back to sign in
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Activate;
