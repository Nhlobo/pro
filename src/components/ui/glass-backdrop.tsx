import React from 'react';
import { createPortal } from 'react-dom';

interface GlassBackdropProps {
  /** Whether the backdrop is visible. */
  show: boolean;
  /** Called when the user clicks the dimmed area — typically closes/minimizes the panel it sits behind. */
  onClick?: () => void;
  /** Stacking order. Keep this below the panel it's backing (panels here use z-50). */
  zIndex?: number;
}

/**
 * A frosted, blurred overlay behind an open floating panel (notification
 * center, chat widget, etc). Portaled to <body> so it always sits above
 * the rest of the page regardless of where it's rendered from, dimming
 * and softening everything else so the open panel is the visual focus.
 *
 * Purely decorative/dismissal — it doesn't trap focus or scroll, so it
 * won't fight a Radix component's own dismiss/outside-click handling.
 */
export const GlassBackdrop: React.FC<GlassBackdropProps> = ({ show, onClick, zIndex = 40 }) => {
  if (!show) return null;

  return createPortal(
    <div
      aria-hidden="true"
      onClick={onClick}
      style={{ zIndex }}
      className="fixed inset-0 bg-background/40 backdrop-blur-md animate-in fade-in-0 duration-200 supports-[backdrop-filter]:bg-background/30"
    />,
    document.body,
  );
};

export default GlassBackdrop;
