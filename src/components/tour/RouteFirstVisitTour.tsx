import React from 'react';
import { useLocation } from 'react-router-dom';
import GuidedTour, { TourStep } from '@/components/tour/GuidedTour';
import { useAuth } from '@/hooks/useAuth';

export interface RouteTourEntry {
  /** Exact pathname or pathname prefix (matched longest-first). */
  path: string;
  title: string;
  description: string;
  /** Optional extra steps shown after the intro. */
  extraSteps?: TourStep[];
  /** Optional override of tour version (bump to re-show to all users). */
  version?: string;
}

interface RouteFirstVisitTourProps {
  routes: RouteTourEntry[];
  /** Bump to invalidate every page tour for the portal. */
  version?: string;
}

/**
 * Auto-launches a one-step "what is this page" tour the first time a user
 * visits a given route. Per-user, per-route storage key — so every user
 * sees the pop-up on functions they have never opened before.
 */
const RouteFirstVisitTour: React.FC<RouteFirstVisitTourProps> = ({ routes, version = 'v1' }) => {
  const location = useLocation();
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [steps, setSteps] = React.useState<TourStep[]>([]);
  const [storageKey, setStorageKey] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (!user?.id) return;

    // Longest-prefix match so /admin/cases/123 still hits /admin/cases.
    const sorted = [...routes].sort((a, b) => b.path.length - a.path.length);
    const match = sorted.find(
      (r) => location.pathname === r.path || location.pathname.startsWith(r.path + '/')
    );
    if (!match) {
      setOpen(false);
      return;
    }

    const v = match.version ?? version;
    const key = `tour:route:${user.id}:${match.path}:${v}`;
    let seen = false;
    try { seen = !!localStorage.getItem(key); } catch {}
    if (seen) {
      setOpen(false);
      return;
    }

    const intro: TourStep = {
      title: match.title,
      content: match.description,
      placement: 'center',
    };
    setSteps([intro, ...(match.extraSteps ?? [])]);
    setStorageKey(key);
    // Slight delay so the page can render first
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, [location.pathname, user?.id, routes, version]);

  if (!open || !steps.length) return null;

  return (
    <GuidedTour
      steps={steps}
      open={open}
      onClose={() => setOpen(false)}
      storageKey={storageKey}
    />
  );
};

export default RouteFirstVisitTour;
