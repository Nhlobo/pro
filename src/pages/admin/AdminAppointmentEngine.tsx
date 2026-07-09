// src/pages/admin/AdminAppointmentEngine.tsx
import React, { lazy, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, ClipboardList, PlusCircle, ClipboardCheck, MessageSquare, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPage, AdminHeader, BRAND_TEAL } from '@/components/admin/ui/AdminUI';

const DailySchedule = lazy(() => import('@/components/admin/DailyScheduleModule'));
const ScheduledAssessmentModule = lazy(() => import('@/components/admin/ScheduledAssessmentModule'));
const NewAppointmentModule = lazy(() => import('@/components/admin/NewAppointmentModule'));
const AppointmentChecklistModule = lazy(() => import('@/components/admin/AppointmentChecklistModule'));
const CommunicationsModule = lazy(() => import('@/components/admin/CommunicationsModule'));
const AssessmentUpdateModule = lazy(() => import('@/components/admin/AssessmentUpdateModule'));

const TabFallback = () => (
  <div className="space-y-4 border border-black/10 p-4">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-64 w-full" />
  </div>
);

const TABS = [
  { value: 'schedule', label: 'Daily Schedule', icon: Calendar },
  { value: 'assessments', label: 'Assessments', icon: ClipboardList },
  { value: 'assessment-update', label: 'Assessment Update', icon: FileText },
  { value: 'new-appointment', label: 'New Appointment', icon: PlusCircle },
  { value: 'checklist', label: 'Checklist', icon: ClipboardCheck },
  { value: 'communications', label: 'Communications', icon: MessageSquare },
];

const AdminAppointmentEngine: React.FC = () => {
  const today = new Date().toLocaleDateString('en-ZA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <AdminPage>
      <AdminHeader eyebrow="Scheduling" title="Appointment Engine" description={today} />

      <Tabs defaultValue="schedule" className="w-full">
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <TabsList className="flex h-auto w-max min-w-full justify-start gap-1 rounded-none border border-black/10 bg-white p-1 sm:w-full">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="flex shrink-0 items-center gap-1.5 rounded-none px-3 py-2 text-xs data-[state=active]:bg-black data-[state=active]:text-white sm:text-sm"
              >
                <t.icon className="h-3.5 w-3.5 shrink-0" />
                <span>{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-4">
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

          <TabsContent value="assessment-update">
            <Suspense fallback={<TabFallback />}>
              <AssessmentUpdateModule />
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
        </div>
      </Tabs>
    </AdminPage>
  );
};

export default AdminAppointmentEngine;
