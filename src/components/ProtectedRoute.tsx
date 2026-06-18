import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, isEmailConfirmed } = useAuth();
  const { isAdmin, loading: permissionsLoading } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [setupOk, setSetupOk] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }
    if (!loading && user && !permissionsLoading) {
      if (!isEmailConfirmed && !isAdmin()) {
        navigate('/email-confirmation');
        return;
      }
    }
  }, [user, loading, permissionsLoading, isEmailConfirmed, isAdmin, navigate]);

  // Server-side gate: every protected route checks security_setup_completed.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user) { setCheckingSetup(false); return; }
      if (location.pathname.startsWith('/security-setup')) {
        setCheckingSetup(false); setSetupOk(true); return;
      }
      setCheckingSetup(true);
      const { data } = await supabase.from('profiles')
        .select('security_setup_completed, account_status, must_reset_password')
        .eq('id', user.id).maybeSingle();
      if (cancelled) return;
      if (!data) { setCheckingSetup(false); setSetupOk(false); navigate('/auth'); return; }
      if (data.account_status === 'suspended' || data.account_status === 'disabled') {
        await supabase.auth.signOut();
        navigate('/auth'); return;
      }
      if (!data.security_setup_completed || data.must_reset_password) {
        navigate('/security-setup', { replace: true });
        return;
      }
      setSetupOk(true);
      setCheckingSetup(false);
    };
    check();
    return () => { cancelled = true; };
  }, [user, location.pathname, navigate]);

  if (loading || (user && permissionsLoading) || checkingSetup) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || (!isEmailConfirmed && !isAdmin()) || !setupOk) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
