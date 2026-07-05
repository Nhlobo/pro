import { cn } from '@/lib/utils';

interface BrandedPageLoaderProps {
  /** Status text shown under the logo, e.g. "Loading access…", "Verifying secure access…" */
  message?: string;
  /** Full viewport height (route-level guards) vs a shorter inline block (lazy chunk loads). */
  fullScreen?: boolean;
  className?: string;
}

/**
 * Shared full-page loading screen.
 *
 * Visually matches the pre-React splash screen in index.html (#app-splash):
 * the same teal-to-white brand gradient, logo ring, title styling and
 * spinner — so the "checking access" screens users see right after signing
 * in or moving between portals feel like one continuous, branded experience
 * instead of a plain generic spinner.
 */
const BrandedPageLoader = ({
  message = 'Loading…',
  fullScreen = true,
  className,
}: BrandedPageLoaderProps) => (
  <div
    role="status"
    aria-label={message}
    className={cn(
      'flex w-full flex-col items-center justify-center gap-5 bg-[linear-gradient(135deg,#00BAAD_0%,#4fd8ce_45%,#ffffff_100%)] px-4 text-center',
      fullScreen ? 'min-h-screen' : 'min-h-[50vh]',
      className
    )}
  >
    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/25 shadow-[0_20px_60px_rgba(0,0,0,0.22),inset_0_0_0_2px_rgba(255,255,255,0.5)] backdrop-blur-md">
      <img
        src="/lovable-uploads/logo-icon-192.png"
        alt="Kutlwano & Associate"
        className="h-14 w-14 object-contain drop-shadow-md"
      />
    </div>
    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white drop-shadow-sm">
      {message}
    </p>
    <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-white/35 border-t-white" />
  </div>
);

export default BrandedPageLoader;
