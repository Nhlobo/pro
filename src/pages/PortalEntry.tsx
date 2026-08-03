import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BrandedPageLoader from '@/components/BrandedPageLoader';

const logoSrc = '/lovable-uploads/7401e32a-2457-4a00-9d60-c1ff9fcfc4fc.png';

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

  if (!error) {
    return <BrandedPageLoader message={status} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-4">
          <img src={logoSrc} alt="Kutlwano & Associate" className="h-12 w-12 object-contain" />
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div>
            <p className="font-medium">Unable to access your portal</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/')}>Return home</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PortalEntry;
