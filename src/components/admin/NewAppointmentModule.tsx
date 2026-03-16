import React, { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy-load the full NewAppointment page content
const NewAppointmentPage = lazy(() => import('@/pages/NewAppointment'));

const NewAppointmentModule: React.FC = () => {
  return (
    <Suspense fallback={
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    }>
      <NewAppointmentPage />
    </Suspense>
  );
};

export default NewAppointmentModule;
