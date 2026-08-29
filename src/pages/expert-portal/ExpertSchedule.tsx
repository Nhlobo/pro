import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, FileText, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';
import { cn } from '@/lib/utils';
import { BRAND_TEAL } from '@/components/admin/ui/AdminUI';
import {
  PortalPage,
  PortalHeader,
  SyncStatus,
  PortalCard,
  PortalCardHeader,
  PortalCardBody,
  PortalPill,
  PortalLoadingState,
} from '@/components/attorney-portal/ui/PortalPrimitives';
import { ExpertNotLinkedState } from '@/components/portal/ExpertNotLinkedState';
import { useExpertLinkStatus } from '@/hooks/useExpertLinkStatus';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday } from 'date-fns';

/**
 * Expert Portal — Schedule.
 *
 * Calendar cells are now aspect-square (not a fixed h-12 px height), so
 * they scale down cleanly on narrow phones instead of overflowing the
 * 7-column grid or leaving cramped, unreadable numbers. Square corners
 * and hairline borders throughout to match PortalCard/AdminUI, and
 * status is read from the icon + label (Clock = pending, CheckCircle2 =
 * completed) rather than from an arbitrary badge color — the only color
 * used is the single teal accent and the semantic destructive tone for
 * genuinely overdue items, same as the rest of the system.
 */
const ExpertSchedule: React.FC = () => {
  const { user } = useAuth();
  const linkStatus = useExpertLinkStatus();
  const { lastUpdate, isActiveTab, isPageLocked } = useAppointmentSync();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [notLinked, setNotLinked] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('expert_id').eq('id', user.id).single();
      if (!profile?.expert_id) { setNotLinked(true); setLoading(false); return; }

      const [apptsRes, reportsRes] = await Promise.all([
        supabase.from('external_portal_cases' as any)
          .select(`appointment_id, appointment_date, case_status, matter_type, claimant_first_name, claimant_last_name, claimant_auto_id, referring_attorney_name`)
          .eq('expert_id', profile.expert_id)
          .is('deleted_at', null)
          .order('appointment_date', { ascending: true }),
        supabase.from('expert_reports')
          .select('*')
          .eq('expert_id', profile.expert_id),
      ]);
      const mappedAppts = ((apptsRes.data || []) as any[]).map(a => ({
        id: a.appointment_id,
        appointment_date: a.appointment_date,
        case_status: a.case_status,
        matter_type: a.matter_type,
        claimants: { first_name: a.claimant_first_name, last_name: a.claimant_last_name, auto_id: a.claimant_auto_id },
        referring_attorneys: { name: a.referring_attorney_name },
      }));
      setAppointments(mappedAppts);
      setReports(reportsRes.data || []);
    } catch (error) {
      // Previously unguarded — a thrown error left `loading` stuck
      // true forever with an empty calendar and no way out.
      console.error('[ExpertSchedule] load failed', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (!user) return;
    if (!initialFetchDone.current) {
      load();
      initialFetchDone.current = true;
    } else if (isActiveTab && !isPageLocked) {
      load();
    }
  }, [user, lastUpdate, load, isActiveTab, isPageLocked]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = monthStart.getDay();
  const paddingDays = (startDay === 0 ? 6 : startDay - 1);

  const getAppointmentsForDate = (date: Date) =>
    appointments.filter(a => isSameDay(parseISO(a.appointment_date), date));

  const selectedDayAppts = selectedDate ? getAppointmentsForDate(selectedDate) : [];

  const pendingReports = reports.filter(r => r.report_status !== 'completed' && r.report_status !== 'taken_out');
  const completedReports = reports.filter(r => r.report_status === 'completed' || r.report_status === 'taken_out');

  if (linkStatus === 'checking') {
    return (
      <PortalPage>
        <PortalHeader eyebrow="Expert Portal" title="Schedule & Report Tracking" icon={Calendar} />
        <PortalLoadingState label="Checking your account…" />
      </PortalPage>
    );
  }

  if (linkStatus === 'not_linked' || notLinked) {
    return (
      <PortalPage>
        <PortalHeader eyebrow="Expert Portal" title="Schedule & Report Tracking" icon={Calendar} />
        <ExpertNotLinkedState description="Your account is not linked to a medical expert profile, so there's no schedule to show yet. Contact an administrator or get help below." />
      </PortalPage>
    );
  }

  return (
    <PortalPage>
      <PortalHeader
        eyebrow="Expert Portal"
        title="Schedule & Report Tracking"
        description="View your assessment schedule and track report submissions."
        icon={Calendar}
        actions={<SyncStatus loading={loading} onRefresh={load} label="Live data" />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        {/* Calendar */}
        <PortalCard className="md:col-span-2">
          <PortalCardHeader
            title={format(currentMonth, 'MMMM yyyy')}
            actions={
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            }
          />
          <PortalCardBody>
            <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 py-1 sm:text-[10px]">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: paddingDays }).map((_, i) => (
                <div key={`pad-${i}`} className="aspect-square" />
              ))}
              {daysInMonth.map(day => {
                const dayAppts = getAppointmentsForDate(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const today = isToday(day);
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      'relative flex aspect-square flex-col items-center justify-center border text-[11px] font-medium transition-colors sm:text-sm',
                      isSelected
                        ? 'border-black bg-black text-white'
                        : today
                          ? 'border-black/10 font-bold'
                          : 'border-black/5 text-black hover:border-black/20 hover:bg-black/[0.03]'
                    )}
                    style={today && !isSelected ? { color: BRAND_TEAL } : undefined}
                  >
                    {format(day, 'd')}
                    {dayAppts.length > 0 && (
                      <span
                        className="absolute bottom-1 h-1 w-1 rounded-full sm:bottom-1.5 sm:h-1.5 sm:w-1.5"
                        style={{ backgroundColor: isSelected ? '#fff' : BRAND_TEAL }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </PortalCardBody>
        </PortalCard>

        {/* Selected Day Detail */}
        <PortalCard>
          <PortalCardHeader title={selectedDate ? format(selectedDate, 'dd MMMM yyyy') : 'Select a date'} />
          <PortalCardBody className="p-0">
            {!selectedDate ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">Click a date to see appointments</p>
            ) : selectedDayAppts.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">No appointments on this date</p>
            ) : (
              <ul>
                {selectedDayAppts.map(a => (
                  <li key={a.id} className="border-b border-black/10 px-4 py-3 last:border-b-0">
                    <p className="text-sm font-medium text-black">{a.claimants?.first_name} {a.claimants?.last_name}</p>
                    <div className="mt-1 space-y-1 text-[11px] text-slate-500">
                      <p className="flex items-center gap-1.5"><Clock className="h-3 w-3 shrink-0" style={{ color: BRAND_TEAL }} />{format(parseISO(a.appointment_date), 'HH:mm')}</p>
                      <p className="flex items-center gap-1.5"><User className="h-3 w-3 shrink-0" style={{ color: BRAND_TEAL }} />{(a as any).referring_attorneys?.name || 'N/A'}</p>
                      <p className="flex items-center gap-1.5"><FileText className="h-3 w-3 shrink-0" style={{ color: BRAND_TEAL }} />{a.matter_type || 'General'}</p>
                    </div>
                    <PortalPill tone="neutral" className="mt-2">{a.case_status || 'Scheduled'}</PortalPill>
                  </li>
                ))}
              </ul>
            )}
          </PortalCardBody>
        </PortalCard>
      </div>

      {/* Report Submission Tracking */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <PortalCard>
          <PortalCardHeader icon={AlertTriangle} title={`Pending Reports (${pendingReports.length})`} />
          <PortalCardBody className="max-h-[320px] overflow-y-auto p-0">
            {pendingReports.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-slate-500">All reports submitted!</p>
            ) : (
              <ul>
                {pendingReports.map(r => {
                  const appt = appointments.find(a => a.id === r.appointment_id);
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-2.5 last:border-b-0">
                      <span className="flex min-w-0 items-center gap-1.5 truncate text-sm text-black">
                        <Circle className="h-3 w-3 shrink-0 text-warning" fill="currentColor" />
                        <span className="truncate">{appt?.claimants?.first_name} {appt?.claimants?.last_name}</span>
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        {r.report_due_date && <span className="text-[11px] text-slate-400">Due {format(parseISO(r.report_due_date), 'dd MMM')}</span>}
                        <PortalPill tone="warning">{(r.report_status || 'pending').replace(/_/g, ' ')}</PortalPill>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </PortalCardBody>
        </PortalCard>

        <PortalCard>
          <PortalCardHeader icon={CheckCircle2} title={`Completed Reports (${completedReports.length})`} />
          <PortalCardBody className="max-h-[320px] overflow-y-auto p-0">
            {completedReports.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-slate-500">No completed reports yet</p>
            ) : (
              <ul>
                {completedReports.slice(0, 10).map(r => {
                  const appt = appointments.find(a => a.id === r.appointment_id);
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-2.5 last:border-b-0">
                      <span className="flex min-w-0 items-center gap-1.5 truncate text-sm text-black">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                        <span className="truncate">{appt?.claimants?.first_name} {appt?.claimants?.last_name}</span>
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        {r.report_submitted_date && <span className="text-[11px] text-slate-400">{format(parseISO(r.report_submitted_date), 'dd MMM yyyy')}</span>}
                        {r.days_to_complete && <PortalPill tone="success">{r.days_to_complete}d</PortalPill>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </PortalCardBody>
        </PortalCard>
      </div>
    </PortalPage>
  );
};

export default ExpertSchedule;
