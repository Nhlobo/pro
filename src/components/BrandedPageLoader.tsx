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
 * portal layouts, and lazy route chunks via App.tsx's RouteFallback).
 *
 * Deliberately kept light and quick — NOT a copy of the one-time full brand
 * splash in index.html (#app-splash). That splash is a one-off "welcome"
 * screen shown once before React mounts. This component can appear many
 * times per session (every login, every portal switch, every route check),
 * so it stays a lightweight in-app spinner rather than a duplicate boot
 * screen.
 *
 * No visible copy is rendered on purpose — every call site (ProtectedRoute,
 * PermissionProtectedRoute, MFARequiredGuard, the portal layouts, and the
 * lazy-route Suspense fallback) still passes a `message`, and it still does
 * real work: it becomes the `aria-label`/`role="status"` on the container,
 * so screen readers still announce exactly what's happening ("Loading
 * access…", "Verifying secure access…", etc). Sighted users just see the
 * spinner — the two rings keep turning for as long as the underlying
 * `loading`/`checking` state in the caller stays true, and disappear the
 * instant that state flips, so it never shows a fixed frame or gets stuck.
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
      'flex w-full items-center justify-center bg-background px-4',
      fullScreen ? 'min-h-screen' : 'min-h-[50vh]',
      className
    )}
  >
    <span className="relative h-10 w-10" aria-hidden="true">
      {/* Faint full ring so the shape reads even between the moving arcs */}
      <span className="absolute inset-0 rounded-full border-[3px] border-[#0A95EB]/15" />
      {/* Outer arc */}
      <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[#0A95EB] border-r-[#0A95EB]/50 [animation-duration:0.9s]" />
      {/* Inner arc, spinning the opposite way for a "lines around a circle" feel */}
      <span className="absolute inset-[7px] animate-spin rounded-full border-2 border-transparent border-b-[#0A95EB]/70 [animation-direction:reverse] [animation-duration:1.3s]" />
    </span>
  </div>
);

export default BrandedPageLoader;
