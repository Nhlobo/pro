import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandedPageLoader from '@/components/BrandedPageLoader';
import { postSignOutPath } from '@/utils/externalPortalSession';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, isEmailConfirmed } = useAuth();
  const { isAdmin, loading: permissionsLoading } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect immediately when unauthenticated (don’t wait for permissions).
    // Referring attorneys / medical experts (external-portal accounts) must
    // land back on their own sign-in page, not the internal staff /auth —
    // postSignOutPath() reads a synchronous cache set while they were signed
    // in, so this is correct even though `user` is already null here.
    if (!loading && !user) {
      navigate(postSignOutPath());
      return;
    }

    if (!loading && user && !permissionsLoading) {
      // Admin users can bypass email confirmation
      if (!isEmailConfirmed && !isAdmin()) {
        navigate('/email-confirmation');
      }
    }
  }, [user, loading, permissionsLoading, isEmailConfirmed, isAdmin, navigate]);

  if (loading || (user && permissionsLoading)) {
    return <BrandedPageLoader message="Loading…" />;
  }

  if (!user || (!isEmailConfirmed && !isAdmin())) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
