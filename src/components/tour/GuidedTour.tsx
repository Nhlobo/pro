import React, { useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TourStep {
  /** CSS selector for the element to highlight. If omitted, step is shown centered (e.g. intro/outro). */
  selector?: string;
  title: string;
  content: string;
  /** Preferred placement of the tooltip relative to target. Auto-flipped if no room. */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface GuidedTourProps {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
  /** Storage key — when set, marks tour completed so it doesn't auto-launch again. */
  storageKey?: string;
}

const PADDING = 8;

export const GuidedTour: React.FC<GuidedTourProps> = ({ steps, open, onClose, storageKey }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tick, setTick] = useState(0);

  const step = steps[stepIndex];

  const finish = useCallback(() => {
    if (storageKey) {
      try { localStorage.setItem(storageKey, '1'); } catch {}
    }
    setStepIndex(0);
    onClose();
  }, [storageKey, onClose]);

  // Reset to step 0 each time the tour opens
  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  // Locate target element & track resize/scroll
  useLayoutEffect(() => {
    if (!open || !step) return;
    if (!step.selector) {
      setRect(null);
      return;
    }
    let cancelled = false;
    const find = () => {
      const el = document.querySelector(step.selector!) as HTMLElement | null;
      if (!el) {
        if (!cancelled) setRect(null);
        return;
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      // Wait a frame for scroll then measure
      requestAnimationFrame(() => {
        if (cancelled) return;
        setRect(el.getBoundingClientRect());
      });
    };
    find();
    const onUpdate = () => setTick((t) => t + 1);
    window.addEventListener('resize', onUpdate);
    window.addEventListener('scroll', onUpdate, true);
    const interval = setInterval(onUpdate, 500); // re-measure in case of late layout
    return () => {
      cancelled = true;
      window.removeEventListener('resize', onUpdate);
      window.removeEventListener('scroll', onUpdate, true);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex, step?.selector]);

  // Re-measure on tick
  useEffect(() => {
    if (!open || !step?.selector) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (el) setRect(el.getBoundingClientRect());
  }, [tick, open, step?.selector]);

  if (!open || !step) return null;

  const isCenter = !step.selector || !rect;
  const placement = step.placement ?? 'bottom';
  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= steps.length - 1;
  const progressPct = ((stepIndex + 1) / steps.length) * 100;

  // Compute tooltip position
  const TOOLTIP_W = 360;
  const TOOLTIP_H = 240;
  let tipStyle: React.CSSProperties = {};
  if (isCenter) {
    tipStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  } else if (rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = rect.bottom + 12;
    let left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    if (placement === 'top') top = rect.top - TOOLTIP_H - 12;
    if (placement === 'left') {
      top = rect.top + rect.height / 2 - TOOLTIP_H / 2;
      left = rect.left - TOOLTIP_W - 12;
    }
    if (placement === 'right') {
      top = rect.top + rect.height / 2 - TOOLTIP_H / 2;
      left = rect.right + 12;
    }
    // Clamp
    if (left < 12) left = 12;
    if (left + TOOLTIP_W > vw - 12) left = vw - TOOLTIP_W - 12;
    if (top < 12) top = rect.bottom + 12;
    if (top + TOOLTIP_H > vh - 12) top = Math.max(12, rect.top - TOOLTIP_H - 12);
    tipStyle = { top, left };
  }

  const next = () => {
    if (isLast) finish();
    else setStepIndex((i) => i + 1);
  };
  const prev = () => setStepIndex((i) => Math.max(0, i - 1));
  const goto = (i: number) => setStepIndex(Math.max(0, Math.min(steps.length - 1, i)));


  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Dim overlay using SVG mask cutout for highlighted element */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto"
        onClick={finish}
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && !isCenter && (
              <rect
                x={rect.left - PADDING}
                y={rect.top - PADDING}
                width={rect.width + PADDING * 2}
                height={rect.height + PADDING * 2}
                rx={8}
                ry={8}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#tour-mask)"
        />
      </svg>

      {/* Glow ring around target */}
      {rect && !isCenter && (
        <div
          className="absolute rounded-lg ring-2 ring-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.25)] pointer-events-none animate-pulse"
          style={{
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className={cn(
          'absolute pointer-events-auto bg-card text-card-foreground border border-border rounded-xl shadow-2xl p-5 w-[340px] animate-in fade-in zoom-in-95'
        )}
        style={tipStyle}
        role="dialog"
        aria-label={step.title}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">{step.title}</h3>
          </div>
          <button
            onClick={finish}
            className="text-muted-foreground hover:text-foreground rounded p-1"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{step.content}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Step {stepIndex + 1} of {steps.length}
          </span>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <Button variant="ghost" size="sm" onClick={prev}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {stepIndex >= steps.length - 1 ? 'Finish' : (<>Next <ChevronRight className="h-4 w-4 ml-1" /></>)}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GuidedTour;
