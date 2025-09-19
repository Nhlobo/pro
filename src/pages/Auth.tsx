import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/');
      }
    };
    checkUser();
  }, [navigate]);

  const cleanupAuthState = () => {
    // Clean up any existing auth state
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      cleanupAuthState();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('invalid login credentials')) {
          setError('Invalid email or password. Please check your credentials and try again.');
        } else if (msg.includes('confirm')) {
          // Redirect to email confirmation flow
          localStorage.setItem('pendingConfirmationEmail', email.trim());
          navigate(`/email-confirmation?email=${encodeURIComponent(email.trim())}`);
        } else {
          setError(error.message);
        }
        return;
      }

      if (data.user) {
        // Special handling for primary administrator
        if (data.user.email === 'boshomane@kutlwanoassociate.com') {
          toast({ 
            title: "Welcome back, Mr. Boshomane!", 
            description: 'You have full administrative access to the system.' 
          });
          window.location.href = '/';
          return;
        }

        // Get user profile to check role and user_type
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, user_type, first_name, last_name, position')
          .eq('id', data.user.id)
          .single();

        // Check if user has valid profile and access
        if (profile) {
          const userType = profile.user_type || 'user';
          const role = profile.role || 'user';
          const userName = profile.first_name ? 
            `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}` : 
            data.user.email?.split('@')[0];

          // Allow access based on user type and role
          if (userType === 'admin' || role === 'admin') {
            toast({ 
              title: `Welcome back, ${userName}!`, 
              description: 'You have successfully signed in with admin privileges.' 
            });
          } else if (userType === 'employee') {
            const position = profile.position ? ` (${profile.position})` : '';
            toast({ 
              title: `Welcome back, ${userName}${position}!`, 
              description: 'You have successfully signed in as an employee.' 
            });
          } else if (userType === 'referring_attorney' || role === 'referring_attorney') {
            toast({ 
              title: `Welcome back, ${userName}!`, 
              description: 'You have successfully signed in. You can access your law firm data.' 
            });
          } else {
            // Block access for unknown user types
            await supabase.auth.signOut();
            setError('Access not authorized. Please contact your administrator for assistance.');
            return;
          }

          window.location.href = '/';
        } else if (profileError) {
          // If profile fetch fails, check if it's a system issue vs. user not found
          console.error('Profile fetch error:', profileError);
          await supabase.auth.signOut();
          setError('Unable to verify account permissions. Please contact support.');
          return;
        } else {
          await supabase.auth.signOut();
          setError('Account not found or access not authorized. Please contact support.');
          return;
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <>
      <Helmet>
        <title>Sign In - Medico-Legal Assessment System</title>
        <meta name="description" content="Sign in to access the medico-legal assessment system and manage medical expert directories." />
      </Helmet>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src="/lovable-uploads/7401e32a-2457-4a00-9d60-c1ff9fcfc4fc.png" alt="Kutlwano & Associate" className="h-12 w-12" />
          </div>
          <CardTitle className="text-2xl">Welcome</CardTitle>
          <CardDescription>
            Sign in to Medico-Legal Service, We touch a file, We change lives.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full">
            
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>
          </div>
          
          <div className="mt-6 pt-4 border-t text-center text-sm text-muted-foreground">
            <p>For assistance, please contact support</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default Auth;