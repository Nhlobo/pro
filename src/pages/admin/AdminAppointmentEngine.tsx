import React, { lazy, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, ClipboardList, PlusCircle, ClipboardCheck, MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const DailySchedule = lazy(() => import('@/components/admin/DailyScheduleModule'));
const ScheduledAssessmentModule = lazy(() => import('@/components/admin/ScheduledAssessmentModule'));
const NewAppointmentModule = lazy(() => import('@/components/admin/NewAppointmentModule'));
const AppointmentChecklistModule = lazy(() => import('@/components/admin/AppointmentChecklistModule'));
const CommunicationsModule = lazy(() => import('@/components/admin/CommunicationsModule'));
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
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="schedule" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Calendar className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Daily</span> Schedule
          </TabsTrigger>
          <TabsTrigger value="assessments" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <ClipboardList className="h-3.5 w-3.5" />
            Assessments
          </TabsTrigger>
          <TabsTrigger value="new-appointment" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <PlusCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New</span> Appt
          </TabsTrigger>
          <TabsTrigger value="checklist" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Checklist
          </TabsTrigger>
          <TabsTrigger value="communications" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <MessageSquare className="h-3.5 w-3.5" />
            Comms
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

        <TabsContent value="communications">
          <Suspense fallback={<TabFallback />}>
            <CommunicationsModule />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAppointmentEngine;
