import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, FileText, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday } from 'date-fns';

const ExpertSchedule: React.FC = () => {
  const { user } = useAuth();
  const [expertId, setExpertId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('expert_id').eq('id', user.id).single();
      if (!profile?.expert_id) { setLoading(false); return; }
      setExpertId(profile.expert_id);

      const [apptsRes, reportsRes] = await Promise.all([
        supabase.from('appointments')
          .select(`*, claimants(first_name, last_name, auto_id), referring_attorneys:referring_attorney_id(name)`)
          .eq('expert_id', profile.expert_id)
          .is('deleted_at', null)
          .order('appointment_date', { ascending: true }),
        supabase.from('expert_reports')
          .select('*')
          .eq('expert_id', profile.expert_id),
      ]);
      setAppointments(apptsRes.data || []);
      setReports(reportsRes.data || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  // Pad to start on Monday
  const startDay = monthStart.getDay();
  const paddingDays = (startDay === 0 ? 6 : startDay - 1);

  const getAppointmentsForDate = (date: Date) =>
    appointments.filter(a => isSameDay(parseISO(a.appointment_date), date));

  const selectedDayAppts = selectedDate ? getAppointmentsForDate(selectedDate) : [];

  // Report submission tracking
  const pendingReports = reports.filter(r => r.report_status !== 'completed' && r.report_status !== 'taken_out');
  const completedReports = reports.filter(r => r.report_status === 'completed' || r.report_status === 'taken_out');

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading schedule...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Calendar className="h-6 w-6 text-primary" /> Schedule & Report Tracking
        </h1>
        <p className="text-sm text-muted-foreground">View your assessment schedule and track report submissions</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="md:col-span-2 border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-base">{format(currentMonth, 'MMMM yyyy')}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} className="text-[10px] font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: paddingDays }).map((_, i) => (
                <div key={`pad-${i}`} className="h-12" />
              ))}
              {daysInMonth.map(day => {
                const dayAppts = getAppointmentsForDate(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const today = isToday(day);
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`h-12 rounded-lg text-sm relative transition-all
                      ${isSelected ? 'bg-primary text-primary-foreground' : today ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted text-foreground'}
                      ${dayAppts.length > 0 ? 'font-semibold' : ''}
                    `}
                  >
                    {format(day, 'd')}
                    {dayAppts.length > 0 && (
                      <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-primary'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selected Day Detail */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {selectedDate ? format(selectedDate, 'dd MMMM yyyy') : 'Select a date'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="text-sm text-muted-foreground">Click a date to see appointments</p>
            ) : selectedDayAppts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments on this date</p>
            ) : (
              <div className="space-y-3">
                {selectedDayAppts.map(a => (
                  <div key={a.id} className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2">
                    <p className="font-medium text-sm text-foreground">{a.claimants?.first_name} {a.claimants?.last_name}</p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(parseISO(a.appointment_date), 'HH:mm')}</p>
                      <p className="flex items-center gap-1"><User className="h-3 w-3" />{(a as any).referring_attorneys?.name || 'N/A'}</p>
                      <p className="flex items-center gap-1"><FileText className="h-3 w-3" />{a.matter_type || 'General'}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{a.case_status || 'Scheduled'}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Report Submission Tracking */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Pending Reports ({pendingReports.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingReports.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">All reports submitted!</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {pendingReports.map(r => {
                  const appt = appointments.find(a => a.id === r.appointment_id);
                  return (
                    <div key={r.id} className="flex items-center justify-between p-2 rounded border border-border/50 text-sm">
                      <span className="text-foreground">{appt?.claimants?.first_name} {appt?.claimants?.last_name}</span>
                      <div className="flex items-center gap-2">
                        {r.report_due_date && <span className="text-xs text-muted-foreground">Due: {format(parseISO(r.report_due_date), 'dd MMM')}</span>}
                        <Badge variant="outline" className="text-[10px]">{r.report_status || 'Pending'}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" /> Completed Reports ({completedReports.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {completedReports.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No completed reports yet</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {completedReports.slice(0, 10).map(r => {
                  const appt = appointments.find(a => a.id === r.appointment_id);
                  return (
                    <div key={r.id} className="flex items-center justify-between p-2 rounded border border-border/50 text-sm">
                      <span className="text-foreground">{appt?.claimants?.first_name} {appt?.claimants?.last_name}</span>
                      <div className="flex items-center gap-2">
                        {r.report_submitted_date && <span className="text-xs text-muted-foreground">{format(parseISO(r.report_submitted_date), 'dd MMM yyyy')}</span>}
                        {r.days_to_complete && <Badge variant="secondary" className="text-[10px]">{r.days_to_complete}d</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExpertSchedule;
