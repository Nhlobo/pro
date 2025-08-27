import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, isEmailConfirmed } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/auth');
      } else {
        const allowedAdminEmails = ['boshomane@kutlwanoassociate.com','info@kutlwanoassociate.com','mjmoleka@gmail.com'];
        if (!isEmailConfirmed && !allowedAdminEmails.includes(user.email ?? '')) {
          navigate('/email-confirmation');
        }
      }
    }
  }, [user, loading, isEmailConfirmed, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || (!isEmailConfirmed && !['boshomane@kutlwanoassociate.com','info@kutlwanoassociate.com','mjmoleka@gmail.com'].includes(user.email ?? ''))) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;