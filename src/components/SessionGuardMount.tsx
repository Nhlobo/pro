import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { clearSessionToken, getSessionToken } from "@/lib/sessionToken";
import { useToast } from "@/hooks/use-toast";

const IDLE_WARNING_MS = 25 * 60 * 1000; // 25 minutes
const IDLE_LOGOUT_MS = 30 * 60 * 1000;  // 30 minutes
const ABSOLUTE_MAX_MS = 8 * 60 * 60 * 1000; // 8 hours
const VALIDATE_INTERVAL_MS = 60 * 1000; // poll session-validity every 60s

export function SessionGuardMount() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [warned, setWarned] = useState(false);
  const lastActivity = useRef<number>(Date.now());
  const sessionStart = useRef<number>(Date.now());

  const forceLogout = async (reason: string) => {
    clearSessionToken();
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    toast({ title: "Session ended", description: reason, variant: "destructive" });
    navigate("/auth", { replace: true });
  };

  useEffect(() => {
    const onActivity = () => {
      lastActivity.current = Date.now();
      if (warned) setWarned(false);
    };
    const events = ["mousemove", "keydown", "click", "touchstart", "visibilitychange"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    // Idle / absolute timeout ticker
    const idleTimer = setInterval(() => {
      const now = Date.now();
      const idleFor = now - lastActivity.current;
      const aliveFor = now - sessionStart.current;
      if (aliveFor >= ABSOLUTE_MAX_MS) {
        forceLogout("Maximum 8-hour session reached. Please sign in again.");
        return;
      }
      if (idleFor >= IDLE_LOGOUT_MS) {
        forceLogout("You were signed out due to inactivity.");
        return;
      }
      if (!warned && idleFor >= IDLE_WARNING_MS) {
        setWarned(true);
        toast({
          title: "You will be signed out soon",
          description: "Move your mouse or press a key to stay signed in.",
        });
      }
    }, 30 * 1000);

    // Server-side single-session validation
    const validateTimer = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const token = getSessionToken();
      try {
        const { data, error } = await supabase.functions.invoke("auth-validate-session", {
          body: { sessionToken: token },
        });
        if (error) return;
        if (data && data.valid === false) {
          forceLogout("Your session is no longer active. Please sign in again.");
        }
      } catch { /* network blip — try again next tick */ }
    }, VALIDATE_INTERVAL_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(idleTimer);
      clearInterval(validateTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warned]);

  return null;
}
