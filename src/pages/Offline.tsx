import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { WifiOff, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { clearStoredOfflineState, readStoredReturnPath } from '@/hooks/useOfflineRedirect';

const Offline = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  const handleRetry = () => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      const returnPath = readStoredReturnPath(user ? '/dashboard' : '/auth');
      clearStoredOfflineState();
      navigate(returnPath, { replace: true });
      return;
    }
    setChecking(true);
    window.location.reload();
  };

  const handleBackToSignIn = async () => {
    clearStoredOfflineState();
    if (user) {
      await signOut();
    }
    navigate('/auth', { replace: true });
  };

  return (
    <div className="min-h-screen w-full gradient-nav flex items-center justify-center p-6">
      <Helmet>
        <title>Offline — Medico-Legal Pro</title>
        <meta name="description" content="You are currently offline." />
      </Helmet>
      <div className="w-full max-w-md bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-black/5">
          <WifiOff className="h-8 w-8 text-black" />
        </div>
        <h1 className="text-2xl font-bold text-black">You're offline</h1>
        <p className="mt-2 text-sm text-slate-600">
          We can't reach the network right now. Check your connection and try again.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={handleRetry}
            disabled={checking}
            className="h-11 rounded-none bg-black font-semibold uppercase tracking-wide text-white hover:bg-black/85"
          >
            <RotateCw className={`mr-2 h-4 w-4 ${checking ? 'animate-spin' : ''}`} /> Retry
          </Button>
          <button
            type="button"
            onClick={handleBackToSignIn}
            className="inline-flex h-11 items-center justify-center border border-black/15 px-4 text-sm font-semibold uppercase tracking-wide text-black hover:bg-black/5"
          >
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  );
};

export default Offline;
