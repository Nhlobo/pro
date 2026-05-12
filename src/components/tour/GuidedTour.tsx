import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
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
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

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

  // Keyboard navigation: ←/→ to move, Esc to skip.
  // Enter is intentionally NOT bound here so it activates the focused button
  // (Back / Next / Skip / Close) — preserving native button semantics.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
      if (isTyping) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (stepIndex >= steps.length - 1) finish();
        else setStepIndex((i) => i + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setStepIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, stepIndex, steps.length, finish]);

  // Focus management: trap Tab inside the dialog, move focus in on open,
  // restore the previously focused element on close.
  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    // Defer until the dialog is mounted in the DOM.
    const focusTimer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const initial =
        (dialog.querySelector('[data-tour-initial-focus="true"]') as HTMLElement | null) ||
        (dialog.querySelector(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as HTMLElement | null);
      initial?.focus();
    }, 30);

    const getFocusable = (): HTMLElement[] => {
      const dialog = dialogRef.current;
      if (!dialog) return [];
      return Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('inert') && el.offsetParent !== null);
    };

    const onTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = getFocusable();
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const dialog = dialogRef.current;
      // If focus has escaped the dialog, pull it back in.
      if (!dialog?.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onTrap, true);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onTrap, true);
      // Restore focus to the element that opened the tour.
      const prev = previouslyFocusedRef.current;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus();
      }
    };
  }, [open]);

  // When the step changes, move focus to the Next/Finish button so keyboard
  // users can keep advancing without re-tabbing.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const btn = dialogRef.current?.querySelector(
        '[data-tour-initial-focus="true"]'
      ) as HTMLElement | null;
      btn?.focus();
    }, 30);
    return () => window.clearTimeout(t);
  }, [stepIndex, open]);



  if (!open || !step) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const isMobile = vw < 640;

  const isCenter = !step.selector || !rect;
  const placement = step.placement ?? 'bottom';
  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= steps.length - 1;
  const progressPct = ((stepIndex + 1) / steps.length) * 100;

  // Compute tooltip position
  const TOOLTIP_W = isMobile ? Math.min(vw - 16, 380) : 360;
  const TOOLTIP_H = isMobile ? 280 : 240;
  let tipStyle: React.CSSProperties = {};
  let mobileSheet = false;

  if (isMobile && !isCenter && rect) {
    // Bottom-sheet style on mobile so the tooltip never sits over the
    // highlighted target. Anchor to whichever side has more room.
    mobileSheet = true;
    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const anchorBottom = spaceBelow >= spaceAbove;
    tipStyle = anchorBottom
      ? { left: 8, right: 8, bottom: 8, width: 'auto' }
      : { left: 8, right: 8, top: 8, width: 'auto' };
  } else if (isCenter) {
    tipStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: TOOLTIP_W,
    };
  } else if (rect) {
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
    tipStyle = { top, left, width: TOOLTIP_W };
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
        ref={dialogRef}
        className={cn(
          'pointer-events-auto bg-card text-card-foreground border border-border shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden',
          mobileSheet ? 'fixed rounded-2xl' : 'absolute rounded-xl',
          mobileSheet ? '' : 'max-w-[calc(100vw-16px)]'
        )}
        style={{
          ...tipStyle,
          paddingBottom: mobileSheet ? 'env(safe-area-inset-bottom)' : undefined,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-content"
      >
        {/* SR-only live region announces step changes */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          Step {stepIndex + 1} of {steps.length}: {step.title}. {step.content}
        </div>

        {/* Progress bar */}
        <div
          className="h-1 w-full bg-muted"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={stepIndex + 1}
          aria-label={`Step ${stepIndex + 1} of ${steps.length}`}
        >
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className={cn(isMobile ? 'p-4' : 'p-5')}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
              <h3 id="tour-title" className="font-semibold text-sm truncate">{step.title}</h3>
            </div>
            <button
              onClick={finish}
              className="text-muted-foreground hover:text-foreground rounded-md flex items-center justify-center shrink-0 h-11 w-11 -mr-2 -mt-2 sm:h-8 sm:w-8 sm:-mr-1 sm:-mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              aria-label="Close tour"
              title="Close (Esc)"
            >
              <X className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
            </button>
          </div>

          <p id="tour-content" className="text-sm text-muted-foreground leading-relaxed mb-4">{step.content}</p>

          {/* Step dots — wrapped in 44px tap targets on mobile */}
          {steps.length > 1 && steps.length <= 12 && (
            <div className="flex items-center justify-center mb-3" role="tablist" aria-label="Tour steps">
              {steps.map((s, i) => {
                const active = i === stepIndex;
                const visited = i < stepIndex;
                return (
                  <button
                    key={i}
                    onClick={() => goto(i)}
                    role="tab"
                    aria-selected={active}
                    aria-label={`Go to step ${i + 1}: ${s.title}`}
                    title={`${i + 1}. ${s.title}`}
                    className="group flex items-center justify-center h-11 w-7 sm:h-6 sm:w-6 focus-visible:outline-none"
                  >
                    <span
                      className={cn(
                        'block h-2 rounded-full transition-all group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-1 group-focus-visible:ring-offset-card',
                        active ? 'w-6 bg-primary' : visited ? 'w-2 bg-primary/60 group-hover:bg-primary' : 'w-2 bg-muted-foreground/30 group-hover:bg-muted-foreground/60'
                      )}
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer controls — stacked on mobile, single row on sm+ */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {stepIndex + 1} / {steps.length}
              </span>
              {!isLast && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={finish}
                  className="text-xs h-9 sm:h-7 px-3 sm:px-2 text-muted-foreground hover:text-foreground"
                >
                  Skip tour
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={prev}
                disabled={isFirst}
                aria-label="Previous step"
                className="h-11 sm:h-9 min-w-[44px]"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button
                size="sm"
                onClick={next}
                aria-label={isLast ? 'Finish tour' : 'Next step'}
                className="h-11 sm:h-9 min-w-[44px]"
              >
                {isLast ? 'Finish' : (<>Next <ChevronRight className="h-4 w-4 ml-1" /></>)}
              </Button>
            </div>
          </div>
        </div>
      </div>


    </div>,
    document.body
  );
};

export default GuidedTour;
