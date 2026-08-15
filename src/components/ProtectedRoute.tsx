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
    // `replace: true` so navigating here (e.g. from a Back-button hit on a
    // stale/no-longer-authenticated page) doesn't itself add a further
    // history entry to back into.
    if (!loading && !user) {
      navigate(postSignOutPath(), { replace: true });
      return;
    }

    if (!loading && user && !permissionsLoading) {
      // Admin users can bypass email confirmation
      if (!isEmailConfirmed && !isAdmin()) {
        navigate('/email-confirmation', { replace: true });
      }
    }
  }, [user, loading, permissionsLoading, isEmailConfirmed, isAdmin, navigate]);

  useEffect(() => {
    // bfcache guard: some browsers can restore this exact rendered page —
    // including whatever protected content was on screen — from an
    // in-memory snapshot on Back/Forward, without re-running the "no user"
    // check above. `persisted` is only true on that kind of restore (a
    // normal fresh load/navigation is `persisted: false`), so this only
    // fires for the case that actually needs it: force a real reload,
    // which re-runs this component from scratch against the current auth
    // state instead of showing whatever was on screen when the tab
    // navigated away.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  if (loading || (user && permissionsLoading)) {
    return <BrandedPageLoader message="Loading…" />;
  }

  if (!user || (!isEmailConfirmed && !isAdmin())) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
