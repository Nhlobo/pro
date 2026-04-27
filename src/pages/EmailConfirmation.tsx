import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Mail, RefreshCw, CheckCircle, Send } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const EmailConfirmation: React.FC = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [isResending, setIsResending] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
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
          toast.info('This email may already be confirmed. Try sending a magic login link.');
        } else {
          toast.error(error.message || 'Failed to resend confirmation email');
        }
      } else if (data?.userStatus === 'confirmed') {
        toast.info('This email is already confirmed. You can sign in or request a magic login link.');
      } else {
        toast.success('Confirmation email sent! Please check your inbox and spam folder.');
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSendMagicLink = async () => {
    if (!emailToUse) {
      toast.error('No email found');
      return;
    }
    setIsSendingMagicLink(true);
    try {
      const { error } = await supabase.functions.invoke('resend-user-confirmation', {
        body: { email: emailToUse, action: 'magiclink' }
      });
      if (error) throw error;
      toast.success('Magic login link sent! Check your inbox.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to send magic link');
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  const handleSignOut = () => {
    signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Check Your Email</CardTitle>
          <CardDescription>
            We've sent a confirmation link to <strong>{emailToUse}</strong>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
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
              className="w-full"
              variant="outline"
            >
              {isResending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Resend Confirmation Email
                </>
              )}
            </Button>

            <Button
              onClick={handleSendMagicLink}
              disabled={isSendingMagicLink}
              variant="secondary"
              className="w-full"
            >
              {isSendingMagicLink ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Magic Login Link
                </>
              )}
            </Button>

            <Button
              onClick={handleSignOut}
              variant="ghost"
              className="w-full"
            >
              Sign Out
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Having trouble? Contact your administrator for assistance.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailConfirmation;