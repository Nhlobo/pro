import React, { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const AppointmentChecklistPage = lazy(() => import('@/pages/AppointmentChecklist'));

const AppointmentChecklistModule: React.FC = () => {
  return (
    <Suspense fallback={
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    }>
      <AppointmentChecklistPage />
    </Suspense>
  );
};

export default AppointmentChecklistModule;
