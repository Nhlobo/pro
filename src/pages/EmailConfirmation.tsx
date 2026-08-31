import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Mail, RefreshCw, CheckCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const logoSrc = '/lovable-uploads/7401e32a-2457-4a00-9d60-c1ff9fcfc4fc.png';

// FIXED 2026-08-31: this page previously offered a "Send Magic Login Link"
// button that would email a passwordless sign-in link to whatever address
// was in `emailToUse` -- which can come straight from an unauthenticated
// `?email=` URL query param. That meant anyone could load this page with a
// stranger's email in the URL and get the system to send THEM a
// login-bypassing link, with zero verification. Removed entirely --
// confirming a real email + password remains the only way in.
//
// Background is now the EXACT same decorative background used on
// ExternalPortalSignIn.tsx (per instruction, reused verbatim). The card
// itself is fully sharp-cornered -- no rounded-* classes anywhere on the
// card, logo, or buttons, including the ambient background's own blur
// shapes being the only rounded elements left, exactly as they are on the
// reference page.

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-kutlwano-blue/8 via-background to-kutlwano-teal/6 p-4">
      <Helmet>
        <title>Check Your Email - Medico-Legal Pro</title>
      </Helmet>

      {/* Background decoration — matches Sign In / External Portal Sign In exactly */}
      <div className="absolute inset-0 bg-gradient-to-r from-kutlwano-blue/5 to-kutlwano-teal/5" />
      <div className="absolute -translate-x-1/2 -translate-y-1/2 top-0 left-0 h-64 w-64 rounded-full bg-kutlwano-blue/10 blur-3xl sm:h-96 sm:w-96" />
      <div className="absolute translate-x-1/2 translate-y-1/2 bottom-0 right-0 h-64 w-64 rounded-full bg-kutlwano-teal/10 blur-3xl sm:h-96 sm:w-96" />
      <div className="absolute top-20 right-20 hidden h-32 w-32 rotate-45 border-2 border-kutlwano-blue/20 animate-[spin_20s_linear_infinite] sm:block" />
      <div className="absolute bottom-32 left-20 hidden h-24 w-24 rounded-full border-2 border-kutlwano-teal/20 animate-pulse sm:block" />

      <div className="relative z-10 w-full max-w-md">
        <Card className="w-full rounded-none border-kutlwano-blue/20 bg-card/95 shadow-2xl shadow-kutlwano-blue/10 backdrop-blur-sm">
          <CardHeader className="items-center text-center">
            <img src={logoSrc} alt="Kutlwano & Associate" className="mb-3 h-12 w-12 rounded-none object-contain sm:h-14 sm:w-14" />
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-none bg-[#00BAAD]/10">
              <Mail className="h-5 w-5 text-[#00BAAD]" />
            </div>
            <CardTitle className="text-xl sm:text-2xl">Check Your Email</CardTitle>
            <CardDescription>
              We've sent a confirmation link to <strong className="text-foreground">{emailToUse}</strong>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="space-y-2 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-[#00BAAD]" />
                Click the link in the email to activate your account
              </div>
              <p className="text-xs text-muted-foreground">
                Don't forget to check your spam folder if you don't see the email.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleResendConfirmation}
                disabled={isResending}
                className="w-full rounded-none bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal hover:opacity-90"
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
                className="w-full rounded-none text-muted-foreground hover:text-foreground"
              >
                Sign Out
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Having trouble? Contact your administrator for assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmailConfirmation;
