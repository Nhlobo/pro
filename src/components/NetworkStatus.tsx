import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

/**
 * Global online/offline detector. Renders a slim banner on top of the app
 * when the device loses connectivity and a short confirmation when it
 * returns. Purely presentational — does not touch the backend.
 */
const NetworkStatus = () => {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setJustReconnected(true);
      window.setTimeout(() => setJustReconnected(false), 2500);
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!online) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground shadow-md sm:text-sm"
      >
        <WifiOff className="h-4 w-4" />
        <span>You are offline. Some features may be unavailable.</span>
      </div>
    );
  }

  if (justReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md sm:text-sm"
      >
        <Wifi className="h-4 w-4" />
        <span>Back online.</span>
      </div>
    );
  }

  return null;
};

export default NetworkStatus;
