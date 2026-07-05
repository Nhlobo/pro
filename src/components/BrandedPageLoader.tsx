import { cn } from '@/lib/utils';

interface BrandedPageLoaderProps {
  /** Status text shown under the spinner, e.g. "Loading access…", "Verifying secure access…" */
  message?: string;
  /** Full viewport height (route-level guards) vs a shorter inline block (lazy chunk loads). */
  fullScreen?: boolean;
  className?: string;
}

/**
 * Shared in-app loading indicator, used while the app is silently checking
 * auth/permissions (ProtectedRoute, PermissionProtectedRoute, MFARequiredGuard,
 * portal layouts).
 *
 * Deliberately kept light and quick — NOT a copy of the one-time full brand
 * splash in index.html (#app-splash). That splash is a one-off "welcome"
 * screen shown once before React mounts. This component can appear many
 * times per session (every login, every portal switch), so making it a
 * second full-gradient takeover made it look like the app was reloading
 * from scratch each time. This version uses the same brand teal for the
 * spinner only, on the app's normal background, so it reads as a brief
 * in-app check rather than a duplicate boot screen.
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
      'flex w-full flex-col items-center justify-center gap-3 bg-background px-4 text-center',
      fullScreen ? 'min-h-screen' : 'min-h-[50vh]',
      className
    )}
  >
    <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#00BAAD]/20 border-t-[#00BAAD]" />
    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
      {message}
    </p>
  </div>
);

export default BrandedPageLoader;
