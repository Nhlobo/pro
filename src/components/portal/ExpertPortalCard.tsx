// src/components/portal/ExpertPortalCard.tsx
import * as React from "react";
import { cn } from "@/lib/utils";
import { BRAND_TEAL } from "@/components/admin/ui/AdminUI";

/**
 * Expert Portal — branded Card primitives.
 *
 * The Expert Portal (and bridged Medical Expert external-portal
 * accounts, which land on these same pages) was built against the
 * generic shadcn `ui/card` defaults: rounded-lg corners, theme-token
 * borders, drop shadows. That reads as a different, unbranded product
 * next to the rest of the system, which uses a flat, hairline-bordered,
 * sharp-cornered language (see `src/components/admin/ui/AdminUI.tsx`).
 *
 * This file is a drop-in replacement for `@/components/ui/card` —
 * same component names, same props, same children API — so every page
 * that swaps its import picks up the brand language everywhere `<Card>`
 * is used, without touching a single line of that page's logic or
 * layout structure. `cn()` uses `tailwind-merge`, so any className a
 * call site already passes (spacing, width, etc.) still wins over
 * these defaults where they conflict.
 */

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-none border border-black/10 bg-white text-card-foreground shadow-none transition-colors",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 border-b border-black/10 p-4 sm:p-6", className)}
      {...props}
    />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-lg font-bold leading-none tracking-tight text-black sm:text-xl", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-xs text-slate-500 sm:text-sm", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-4 sm:p-6", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center border-t border-black/10 p-4 sm:p-6", className)}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, BRAND_TEAL };
