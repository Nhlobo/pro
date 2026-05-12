import React from 'react';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import GuidedTour from '@/components/tour/GuidedTour';
import type { TourStep } from '@/components/tour/GuidedTour';

interface TourLauncherProps {
  steps: TourStep[];
  storageKey: string;
  /** Set true to render compact icon-only button (top bars). */
  compact?: boolean;
  label?: string;
}

/**
 * Renders a Help button that launches the guided tour, and auto-launches the
 * tour on first visit (per storageKey).
 */
const TourLauncher: React.FC<TourLauncherProps> = ({ steps, storageKey, compact, label = 'Help' }) => {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) {
        // Delay so layout/data settles
        const t = setTimeout(() => setOpen(true), 800);
        return () => clearTimeout(t);
      }
    } catch {}
  }, [storageKey]);

  return (
    <>
      <Button
        variant="ghost"
        size={compact ? 'icon' : 'sm'}
        onClick={() => setOpen(true)}
        data-tour="help-button"
        title="Help & guided tour"
        className="text-muted-foreground hover:text-foreground"
      >
        <HelpCircle className={compact ? 'h-4 w-4' : 'h-4 w-4 mr-1'} />
        {!compact && <span>{label}</span>}
      </Button>
      <GuidedTour
        steps={steps}
        open={open}
        onClose={() => setOpen(false)}
        storageKey={storageKey}
      />
    </>
  );
};

export default TourLauncher;
