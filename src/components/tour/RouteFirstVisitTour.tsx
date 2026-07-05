// Tours disabled globally per product decision.
// Component intentionally renders nothing so existing call sites remain safe.
import React from 'react';

const RouteFirstVisitTour: React.FC<Record<string, unknown>> = () => null;

export default RouteFirstVisitTour;
export type RouteTourEntry = {
  path: string;
  title: string;
  description: string;
  extraSteps?: unknown[];
  version?: string;
};
