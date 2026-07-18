// src/pages/admin/AdminAppointmentEngine.tsx
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  ClipboardList,
  PlusCircle,
  ClipboardCheck,
  MessageSquare,
  FileText,
  Clock,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPage, AdminHeader, AdminTabList, AdminTabTrigger, BRAND_TEAL } from '@/components/admin/ui/AdminUI';

const DailySchedule = lazy(() => import('@/components/admin/DailyScheduleModule'));
const ScheduledAssessmentModule = lazy(() => import('@/components/admin/ScheduledAssessmentModule'));
const NewAppointmentModule = lazy(() => import('@/components/admin/NewAppointmentModule'));
const AppointmentChecklistModule = lazy(() => import('@/components/admin/AppointmentChecklistModule'));
const CommunicationsModule = lazy(() => import('@/components/admin/CommunicationsModule'));
const AssessmentUpdateModule = lazy(() => import('@/components/admin/AssessmentUpdateModule'));

/** Mirrors a module's real header-row + body shape so the swap from
 *  skeleton to data doesn't visibly "jump" once the chunk loads. */
const TabFallback = () => (
  <div className="space-y-4 border border-black/10 bg-white p-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-24" />
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Skeleton className="h-9 w-full lg:col-span-2" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
    <Skeleton className="h-64 w-full" />
  </div>
);

// The five *monitoring* views — things staff watch or work through. Booking
// a brand-new appointment is a distinct, one-off action rather than a view,
// so it's promoted to a header button that opens a side panel instead of
// sitting in this row as a seventh equal-weight destination (see below).
const TABS = [
  { value: 'schedule', label: 'Daily Schedule', icon: Calendar, Component: DailySchedule },
  { value: 'assessments', label: 'Assessments', icon: ClipboardList, Component: ScheduledAssessmentModule },
  { value: 'assessment-update', label: 'Assessment Update', icon: FileText, Component: AssessmentUpdateModule },
  { value: 'checklist', label: 'Checklist', icon: ClipboardCheck, Component: AppointmentChecklistModule },
  { value: 'communications', label: 'Communications', icon: MessageSquare, Component: CommunicationsModule },
] as const;

type TabValue = (typeof TABS)[number]['value'];

/**
 * Isolated so the once-a-second tick only re-renders this small pill,
 * not the whole Appointment Engine tree (module data, tab content, etc).
 * The old page kept this clock in the page component itself, which meant
 * every module below it re-rendered every second for nothing.
 */
const LiveClock: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeLabel = now.toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="flex shrink-0 items-center gap-2 border border-black/10 bg-black/[0.02] px-3 py-2">
      <span className="relative flex h-2 w-2 shrink-0">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
          style={{ backgroundColor: BRAND_TEAL }}
        />
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: BRAND_TEAL }} />
      </span>
      <Clock className="h-3.5 w-3.5 text-slate-400" />
      <span className="font-mono text-sm font-semibold tabular-nums text-black">{timeLabel}</span>
    </div>
  );
};

const dateLabel = new Date().toLocaleDateString('en-ZA', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const AdminAppointmentEngine: React.FC = () => {
  // Controlled tab state so the URL-free in-page navigation stays simple
  // and predictable — no custom indicator math, no DOM measuring. Active
  // state is handled entirely by AdminTabTrigger, the same primitive used
  // on System Control, Access & Identity, and Email History, so this
  // screen finally looks and behaves like the rest of the Admin Portal
  // instead of its own one-off design.
  const [activeTab, setActiveTab] = useState<TabValue>('schedule');

  // The New Appointment form opens as a docked side panel — the same
  // pattern Email History already uses for its detail/reply view — rather
  // than replacing the whole screen. Staff can glance at the schedule
  // behind it, close it, and land exactly back where they were instead of
  // losing their place in a tab.
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  return (
    <AdminPage className="max-w-7xl">
      <AdminHeader
        eyebrow="Scheduling"
        title="Appointment Engine"
        description={dateLabel}
        icon={Calendar}
        actions={
          <>
            <LiveClock />
            <Button
              className="rounded-none bg-black text-white hover:bg-black/90"
              onClick={() => setIsBookingOpen(true)}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              New Appointment
            </Button>
          </>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
        {/* Sticky, evenly-spaced module switcher — identical pattern to
            System Control's sticky 5-column bar. Stays on screen while a
            long module (Daily Schedule, Checklist) scrolls beneath it, so
            switching modules never requires scrolling back to the top
            first. */}
        <AdminTabList sticky columns={TABS.length}>
          {TABS.map((t) => (
            <AdminTabTrigger key={t.value} value={t.value} label={t.label} icon={t.icon} center />
          ))}
        </AdminTabList>

        <div className="mt-4">
          {TABS.map((t) => {
            const ModuleComponent = t.Component;
            return (
              <TabsContent key={t.value} value={t.value} className="mt-0 focus-visible:outline-none">
                <Suspense fallback={<TabFallback />}>
                  <ModuleComponent />
                </Suspense>
              </TabsContent>
            );
          })}
        </div>
      </Tabs>

      <Sheet open={isBookingOpen} onOpenChange={setIsBookingOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-3xl"
        >
          <SheetHeader className="border-b border-black/10 px-4 py-4 text-left sm:px-6">
            <SheetTitle className="flex items-center gap-2 text-black">
              <PlusCircle className="h-4 w-4" style={{ color: BRAND_TEAL }} />
              New Appointment
            </SheetTitle>
            <SheetDescription>Book a new appointment without leaving the schedule.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 px-4 py-4 sm:px-6">
            <Suspense fallback={<TabFallback />}>
              <NewAppointmentModule />
            </Suspense>
          </div>
        </SheetContent>
      </Sheet>
    </AdminPage>
  );
};

export default AdminAppointmentEngine;
