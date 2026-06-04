import * as React from "react";

import { RandSign } from "@/components/icons/RandSign";
export interface RandSignProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
}

/**
 * RandSign icon — South African Rand (R) currency glyph.
 * Mirrors the lucide-react icon API (className, size, strokeWidth, ...props)
 * so it can be used as a drop-in replacement for <RandSign />.
 */
export const RandSign = React.forwardRef<SVGSVGElement, RandSignProps>(
  ({ size = 24, strokeWidth = 2, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Stylised "R" rendered as strokes so it inherits currentColor like lucide icons */}
      <path d="M7 4v16" />
      <path d="M7 4h6a4 4 0 0 1 0 8H7" />
      <path d="M13 12l5 8" />
    </svg>
  ),
);

RandSign.displayName = "RandSign";

export default RandSign;
