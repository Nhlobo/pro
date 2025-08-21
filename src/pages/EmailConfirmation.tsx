import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Mail, RefreshCw, CheckCircle } from 'lucide-react';

const EmailConfirmation: React.FC = () => {
  const { user, resendConfirmation, signOut } = useAuth();
  const [isResending, setIsResending] = useState(false);

  const handleResendConfirmation = async () => {
    setIsResending(true);
    try {
      const { error } = await resendConfirmation();
      
      if (error) {
        toast.error(error.message || 'Failed to resend confirmation email');
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
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Check Your Email</CardTitle>
          <CardDescription>
            We've sent a confirmation link to <strong>{user?.email}</strong>
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