import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { installSyncListeners } from './lib/offline/sync'

createRoot(document.getElementById("root")!).render(<App />);

// ---------- Offline-first bootstrap ----------
// Service worker registration is intentionally guarded:
//  - Skipped inside iframes (Lovable preview) to avoid stale caches
//  - Skipped on Lovable preview hostnames
//  - Production-only (vite-plugin-pwa devOptions.enabled = false)
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const host = window.location.hostname;
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("lovableproject.com") ||
  host.includes("lovable.app") && host.includes("--");

if (isInIframe || isPreviewHost) {
  // Defensive: ensure no SW lingers in preview contexts.
  navigator.serviceWorker?.getRegistrations().then((rs) =>
    rs.forEach((r) => r.unregister()),
  );
} else if ("serviceWorker" in navigator && import.meta.env.PROD) {
  void import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}

// Start the offline mutation sync engine in every context (works without SW).
installSyncListeners();
