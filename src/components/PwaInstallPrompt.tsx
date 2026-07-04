import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed';

const PwaInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    // Detect standalone (already installed)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    if (standalone) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua);
    if (iOS) {
      setIsIOS(true);
      setVisible(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mt-4 flex items-start gap-3 border border-black/10 bg-white p-3 text-sm text-black shadow-sm">
      <Download className="mt-0.5 h-4 w-4 text-[#00BAAD]" />
      <div className="flex-1">
        <p className="font-semibold">Install this app</p>
        <p className="text-xs text-slate-600">
          {isIOS
            ? 'Tap the Share icon in Safari, then "Add to Home Screen".'
            : 'Add Medico-Legal Pro to your device for quick access.'}
        </p>
        {!isIOS && (
          <Button
            type="button"
            size="sm"
            onClick={handleInstall}
            className="mt-2 h-8 rounded-none bg-black px-3 text-xs font-semibold uppercase tracking-wide text-white hover:bg-black/80"
          >
            Install
          </Button>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss install prompt"
        className="text-slate-400 hover:text-black"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default PwaInstallPrompt;
