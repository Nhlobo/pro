import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, isEmailConfirmed } = useAuth();
  const { isAdmin, loading: permissionsLoading } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !permissionsLoading) {
      if (!user) {
        navigate('/auth');
      } else {
        // Admin users can bypass email confirmation
        if (!isEmailConfirmed && !isAdmin()) {
          navigate('/email-confirmation');
        }
      }
    }
  }, [user, loading, permissionsLoading, isEmailConfirmed, isAdmin, navigate]);

  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || (!isEmailConfirmed && !isAdmin())) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;