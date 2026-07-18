// src/pages/admin/AdminAppointmentEngine.tsx
import React, { lazy, Suspense } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Calendar, ClipboardList, PlusCircle, ClipboardCheck, MessageSquare, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPage, AdminHeader, AdminTabList, AdminTabTrigger } from '@/components/admin/ui/AdminUI';

const DailySchedule = lazy(() => import('@/components/admin/DailyScheduleModule'));
const ScheduledAssessmentModule = lazy(() => import('@/components/admin/ScheduledAssessmentModule'));
const NewAppointmentModule = lazy(() => import('@/components/admin/NewAppointmentModule'));
const AppointmentChecklistModule = lazy(() => import('@/components/admin/AppointmentChecklistModule'));
const CommunicationsModule = lazy(() => import('@/components/admin/CommunicationsModule'));
const AssessmentUpdateModule = lazy(() => import('@/components/admin/AssessmentUpdateModule'));

/** Mirrors the header-row + body shape of each module's real content so the
 *  swap from skeleton to data doesn't visibly "jump" once the chunk loads. */
const TabFallback = () => (
  <div className="space-y-3 border border-black/10 bg-white p-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-24" />
    </div>
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
] as const;

const AdminAppointmentEngine: React.FC = () => {
  const today = new Date().toLocaleDateString('en-ZA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <AdminPage>
      <AdminHeader eyebrow="Scheduling" title="Appointment Engine" description={today} icon={Calendar} />

      <Tabs defaultValue="schedule" className="w-full">
        {/* Sticky: this is the highest-traffic screen in the portal, so the
            module switcher stays reachable while a long tab (Daily Schedule,
            Checklist) scrolls underneath it — no scroll-to-top round trip. */}
        <AdminTabList sticky>
          {TABS.map((t) => (
            <AdminTabTrigger key={t.value} value={t.value} label={t.label} icon={t.icon} />
          ))}
        </AdminTabList>

        <div className="mt-4">
          <TabsContent value="schedule" className="mt-0 focus-visible:outline-none">
            <Suspense fallback={<TabFallback />}>
              <DailySchedule />
            </Suspense>
          </TabsContent>

          <TabsContent value="assessments" className="mt-0 focus-visible:outline-none">
            <Suspense fallback={<TabFallback />}>
              <ScheduledAssessmentModule />
            </Suspense>
          </TabsContent>

          <TabsContent value="assessment-update" className="mt-0 focus-visible:outline-none">
            <Suspense fallback={<TabFallback />}>
              <AssessmentUpdateModule />
            </Suspense>
          </TabsContent>

          <TabsContent value="new-appointment" className="mt-0 focus-visible:outline-none">
            <Suspense fallback={<TabFallback />}>
              <NewAppointmentModule />
            </Suspense>
          </TabsContent>

          <TabsContent value="checklist" className="mt-0 focus-visible:outline-none">
            <Suspense fallback={<TabFallback />}>
              <AppointmentChecklistModule />
            </Suspense>
          </TabsContent>

          <TabsContent value="communications" className="mt-0 focus-visible:outline-none">
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
