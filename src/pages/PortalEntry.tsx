import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Public, unauthenticated entry point for attorney/expert access-code links
 * (e.g. /portal-entry?code=XXXX&type=attorney). Exchanges the code for a
 * real, scoped portal session via the start-portal-session edge function,
 * then hands the person off into the existing attorney-portal / expert-portal
 * UI — no separate "case access" experience to maintain.
 */
const PortalEntry: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Verifying your access link…');

  useEffect(() => {
    const code = searchParams.get('code');
    const personType = searchParams.get('type');

    if (!code || (personType !== 'attorney' && personType !== 'expert')) {
      setError('This link is missing required information. Please use the link exactly as it was sent to you.');
      return;
    }

    let cancelled = false;

    (async () => {
      const { data, error: fnError } = await supabase.functions.invoke('start-portal-session', {
        body: { access_code: code, person_type: personType },
      });

      if (cancelled) return;

      if (fnError || !data?.token_hash) {
        setError(data?.error || fnError?.message || 'This link could not be verified. Please contact our office for a new one.');
        return;
      }

      setStatus('Signing you in…');

      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'magiclink',
      });

      if (cancelled) return;

      if (otpError) {
        setError('We could not complete your sign-in. Please try the link again, or contact our office.');
        return;
      }

      navigate(data.redirect_path || '/dashboard', { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 flex flex-col items-center text-center gap-4">
          {error ? (
            <>
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div>
                <p className="font-medium">Unable to access your portal</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
              <Button variant="outline" onClick={() => navigate('/')}>Return home</Button>
            </>
          ) : (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{status}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PortalEntry;
