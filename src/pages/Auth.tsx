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
        if (error.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please check your credentials and try again.');
        } else {
          setError(error.message);
        }
        return;
      }

      if (data.user) {
        // Check if user is admin with robust fallback
        const adminEmail = 'boshomane@kutlwanoassociate.com';
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        // If role fetch fails due to RLS/policy issues, allow known admin email
        if (profileError && data.user.email === adminEmail) {
          toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
          window.location.href = '/';
          return;
        }

        // If role is not admin and not the known admin email, block access
        if (profile?.role !== 'admin' && data.user.email !== adminEmail) {
          await supabase.auth.signOut();
          setError('Access restricted to administrators only. Please contact support for assistance.');
          return;
        }

        toast({
          title: 'Welcome back!',
          description: 'You have successfully signed in.',
        });
        window.location.href = '/';
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
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
    </div>
  );
};

export default Auth;