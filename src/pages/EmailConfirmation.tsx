import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Mail, RefreshCw, CheckCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const logoSrc = '/lovable-uploads/7401e32a-2457-4a00-9d60-c1ff9fcfc4fc.png';

// FIXED 2026-08-31: this page previously offered a "Send Magic Login Link"
// button that would email a passwordless sign-in link to whatever address
// was in `emailToUse` -- which can come straight from an unauthenticated
// `?email=` URL query param (see emailToUse below). That meant anyone could
// load this page with a stranger's email in the URL and get the system to
// send THEM a login-bypassing link, with zero verification. Removed
// entirely -- confirming a real email + password remains the only way in.
// Also restyled to match the actual brand shell used on the Sign In page
// (Auth.tsx) instead of generic, unbranded shadcn defaults.

const EmailConfirmation: React.FC = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [isResending, setIsResending] = useState(false);
  const emailParam = new URLSearchParams(location.search).get('email');
  const emailToUse = useMemo(() => {
    const email = user?.email || emailParam || localStorage.getItem('pendingConfirmationEmail') || '';
    return email.trim().toLowerCase() || undefined;
  }, [user?.email, emailParam]);

  const handleResendConfirmation = async () => {
    if (!emailToUse) {
      toast.error('No email found');
      return;
    }
    setIsResending(true);
    try {
      const { data, error } = await supabase.functions.invoke('resend-user-confirmation', {
        body: { email: emailToUse, action: 'signup' }
      });

      if (error) {
        const errorMessage = String(error.message || '').toLowerCase();
        if (errorMessage.includes('too many') || errorMessage.includes('limit')) {
          toast.error('Please wait a minute before requesting another email.');
        } else if (errorMessage.includes('already') || errorMessage.includes('confirm')) {
          toast.info('This email is already confirmed — you can sign in directly.');
        } else {
          toast.error(error.message || 'Failed to resend confirmation email');
        }
      } else if (data?.userStatus === 'confirmed') {
        toast.info('This email is already confirmed. You can sign in directly.');
      } else {
        toast.success('Confirmation email sent! Please check your inbox and spam folder.');
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSignOut = () => {
    signOut();
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F5EE] flex items-center justify-center p-4">
      <Helmet>
        <title>Check Your Email - Medico-Legal Pro</title>
      </Helmet>

      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl sm:p-10">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="rounded-full bg-gradient-to-br from-[#00BAAD] to-white p-2 ring-2 ring-[#00BAAD]/40 shadow-lg">
            <img src={logoSrc} alt="Kutlwano & Associate" className="h-14 w-14 object-contain" />
          </div>
          <div>
            <div className="text-lg font-bold text-black">Medico-Legal Pro</div>
            <div className="text-xs text-slate-500">Kutlwano &amp; Associate</div>
          </div>
        </div>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#00BAAD]/10">
            <Mail className="h-6 w-6 text-[#00BAAD]" />
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00BAAD]">Almost there</div>
          <h1 className="mt-2 text-2xl font-bold text-black">Check Your Email</h1>
          <p className="mt-2 text-sm text-slate-600">
            We've sent a confirmation link to <strong className="text-black">{emailToUse}</strong>
          </p>
        </div>

        <div className="mb-6 space-y-2 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
            <CheckCircle className="h-4 w-4 text-[#00BAAD]" />
            Click the link in the email to activate your account
          </div>
          <p className="text-xs text-slate-400">
            Don't forget to check your spam folder if you don't see the email.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleResendConfirmation}
            disabled={isResending}
            className="w-full bg-[#00BAAD] text-white hover:bg-[#00a89c]"
          >
            {isResending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Resend Confirmation Email
              </>
            )}
          </Button>

          <Button
            onClick={handleSignOut}
            variant="ghost"
            className="w-full text-slate-600 hover:text-black"
          >
            Sign Out
          </Button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-400">
            Having trouble? Contact your administrator for assistance.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailConfirmation;
