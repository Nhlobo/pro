import React, { lazy, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, ClipboardList, PlusCircle, ClipboardCheck, MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const DailySchedule = lazy(() => import('@/components/admin/DailyScheduleModule'));
const ScheduledAssessmentModule = lazy(() => import('@/components/admin/ScheduledAssessmentModule'));
const NewAppointmentModule = lazy(() => import('@/components/admin/NewAppointmentModule'));
const AppointmentChecklistModule = lazy(() => import('@/components/admin/AppointmentChecklistModule'));
const TabFallback = () => (
  <div className="space-y-4 p-4">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-64 w-full" />
  </div>
);

const AdminAppointmentEngine: React.FC = () => {
  const today = new Date().toLocaleDateString('en-ZA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Appointment Engine</h1>
        <p className="text-sm text-muted-foreground">
          Scheduling & assessments — {today}
        </p>
      </div>

      <Tabs defaultValue="schedule" className="w-full">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="schedule" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Calendar className="h-3.5 w-3.5" />
            Daily Schedule
          </TabsTrigger>
          <TabsTrigger value="assessments" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <ClipboardList className="h-3.5 w-3.5" />
            Assessments
          </TabsTrigger>
          <TabsTrigger value="new-appointment" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <PlusCircle className="h-3.5 w-3.5" />
            New Appointment
          </TabsTrigger>
          <TabsTrigger value="checklist" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Checklist
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <Suspense fallback={<TabFallback />}>
            <DailySchedule />
          </Suspense>
        </TabsContent>

        <TabsContent value="assessments">
          <Suspense fallback={<TabFallback />}>
            <ScheduledAssessmentModule />
          </Suspense>
        </TabsContent>

        <TabsContent value="new-appointment">
          <Suspense fallback={<TabFallback />}>
            <NewAppointmentModule />
          </Suspense>
        </TabsContent>

        <TabsContent value="checklist">
          <Suspense fallback={<TabFallback />}>
            <AppointmentChecklistModule />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAppointmentEngine;
