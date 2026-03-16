import React, { lazy, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, ClipboardList, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy-load the heavy modules for performance
const DailySchedule = lazy(() => import('@/components/admin/DailyScheduleModule'));
const ScheduledAssessmentModule = lazy(() => import('@/components/admin/ScheduledAssessmentModule'));
const AttorneyPitchlogModule = lazy(() => import('@/components/admin/AttorneyPitchlogModule'));

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
          Scheduling, assessments & attorney outreach — {today}
        </p>
      </div>

      <Tabs defaultValue="schedule" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="schedule" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Calendar className="h-3.5 w-3.5" />
            Daily Schedule
          </TabsTrigger>
          <TabsTrigger value="assessments" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <ClipboardList className="h-3.5 w-3.5" />
            Scheduled Assessments
          </TabsTrigger>
          <TabsTrigger value="pitchlog" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Users className="h-3.5 w-3.5" />
            Attorney Pitchlog
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

        <TabsContent value="pitchlog">
          <Suspense fallback={<TabFallback />}>
            <AttorneyPitchlogModule />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAppointmentEngine;
