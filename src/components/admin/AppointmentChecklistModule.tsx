import React, { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const AppointmentChecklistPage = lazy(() => import('@/pages/AppointmentChecklist'));

/**
 * Wrapper that embeds the full Appointment Checklist page as a module
 * inside the Admin Appointment Engine.
 *
 * Uses AppointmentChecklist's `embedded` prop so the page's own System
 * Header Nav, Helmet tags, and footer are dropped entirely instead of
 * being visually stacked under the Admin Portal's header — mirrors
 * ScheduledAssessmentModule's use of ScheduledAssessment's `embedded` prop.
 */
const AppointmentChecklistModule: React.FC = () => {
  return (
    <Suspense fallback={
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    }>
      <AppointmentChecklistPage embedded />
    </Suspense>
  );
};

export default AppointmentChecklistModule;
