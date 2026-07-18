// src/pages/admin/AdminAppointmentEngine.tsx
import React, { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { AdminPage, BRAND_TEAL } from '@/components/admin/ui/AdminUI';

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

const TABS = [
  { value: 'schedule', label: 'Daily Schedule', icon: Calendar, Component: DailySchedule },
  { value: 'assessments', label: 'Assessments', icon: ClipboardList, Component: ScheduledAssessmentModule },
  { value: 'assessment-update', label: 'Assessment Update', icon: FileText, Component: AssessmentUpdateModule },
  { value: 'new-appointment', label: 'New Appointment', icon: PlusCircle, Component: NewAppointmentModule },
  { value: 'checklist', label: 'Checklist', icon: ClipboardCheck, Component: AppointmentChecklistModule },
  { value: 'communications', label: 'Communications', icon: MessageSquare, Component: CommunicationsModule },
] as const;

type TabValue = (typeof TABS)[number]['value'];

const AdminAppointmentEngine: React.FC = () => {
  // Controlled tab state (rather than Tabs' own defaultValue) so the sliding
  // indicator below can measure and animate to whichever trigger is active.
  const [activeTab, setActiveTab] = useState<TabValue>('schedule');

  // A literal, ticking clock — this screen is open on someone's desk all
  // day, every day, so it should feel alive rather than a static printout.
  // Cheap client-side state only; no network calls, no re-fetching.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dateLabel = now.toLocaleDateString('en-ZA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeLabel = now.toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // ------------------------------------------------------------------
  // Sliding active-tab indicator: a single black pill that glides between
  // triggers instead of each button abruptly swapping color. Measured off
  // real DOM rects so it always lines up regardless of label length,
  // viewport width, or font metrics.
  // ------------------------------------------------------------------
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Partial<Record<TabValue, HTMLButtonElement | null>>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  const measure = () => {
    const list = listRef.current;
    const active = triggerRefs.current[activeTab];
    if (!list || !active) return;
    const listRect = list.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    setIndicator({ left: activeRect.left - listRect.left, width: activeRect.width, ready: true });
  };

  useLayoutEffect(() => {
    measure();
    triggerRefs.current[activeTab]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminPage>
      {/* Hero header — a genuine command-center strip instead of a plain
          eyebrow+title row: brand-tinted glow, live date, and a ticking
          clock so the screen never looks frozen. */}
      <div className="relative overflow-hidden border border-black/10 bg-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{ background: `radial-gradient(circle at 100% 0%, ${BRAND_TEAL}, transparent 60%)` }}
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12"
              style={{ backgroundColor: `${BRAND_TEAL}14` }}
            >
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: BRAND_TEAL }} />
            </div>
            <div className="min-w-0">
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: BRAND_TEAL }}
              >
                Scheduling
              </div>
              <h1 className="truncate text-xl font-bold text-black md:text-2xl">Appointment Engine</h1>
              <p className="text-xs text-slate-500 md:text-sm">{dateLabel}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-start border border-black/10 bg-black/[0.02] px-3 py-2 sm:self-auto">
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
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
        {/* Sticky module switcher — a true segmented control with a sliding
            active pill, so this stays on-screen and instantly responsive
            while a long module (Daily Schedule, Checklist) scrolls beneath
            it. Even width distribution on desktop; comfortable horizontal
            scroll with auto-center on mobile. */}
        <div className="sticky top-0 z-20 -mx-3 bg-white/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:mx-0 sm:px-0">
          <div className="overflow-x-auto">
            <TabsList
              ref={listRef}
              className="relative flex h-auto w-max min-w-full items-stretch gap-1 rounded-none border border-black/10 bg-white p-1 sm:w-full"
            >
              {indicator.ready && (
                <div
                  className="pointer-events-none absolute inset-y-1 z-0 bg-black transition-[left,width] duration-300 ease-out"
                  style={{ left: indicator.left, width: indicator.width }}
                  aria-hidden="true"
                />
              )}
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  ref={(el) => (triggerRefs.current[t.value] = el)}
                  value={t.value}
                  className="group relative z-10 flex min-h-[44px] flex-none shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-none bg-transparent px-3 py-2 text-xs font-medium text-slate-500 outline-none transition-colors duration-200 hover:text-black focus-visible:ring-1 focus-visible:ring-black/20 data-[state=active]:text-white data-[state=active]:shadow-none sm:flex-1 sm:text-sm"
                >
                  <t.icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{t.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <div className="mt-4">
          {TABS.map((t) => {
            const ModuleComponent = t.Component;
            return (
              <TabsContent key={t.value} value={t.value} className="mt-0 focus-visible:outline-none">
                <div className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
                  <Suspense fallback={<TabFallback />}>
                    <ModuleComponent />
                  </Suspense>
                </div>
              </TabsContent>
            );
          })}
        </div>
      </Tabs>
    </AdminPage>
  );
};

export default AdminAppointmentEngine;
