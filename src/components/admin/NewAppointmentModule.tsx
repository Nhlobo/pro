import React, { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy-load the full NewAppointment page content
const NewAppointmentPage = lazy(() => import('@/pages/NewAppointment'));

interface NewAppointmentModuleProps {
  /** Called when the form's Cancel button is used — closes the host panel
   *  instead of navigating away, so the user stays on the Appointment Engine. */
  onCancel?: () => void;
}

const NewAppointmentModule: React.FC<NewAppointmentModuleProps> = ({ onCancel }) => {
  return (
    <Suspense fallback={
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    }>
      <NewAppointmentPage embedded onCancel={onCancel} />
    </Suspense>
  );
};

export default NewAppointmentModule;
