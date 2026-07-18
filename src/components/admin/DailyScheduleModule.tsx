import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, MapPin, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { todayInSAST, formatTimeSAST } from '@/utils/dateTime';

interface DailyAppointment {
  id: string;
  time: string;
  claimant: string;
  expert: string;
  expertType: string;
  attorney: string;
  status: string;
  matterType: string;
}

const DailyScheduleModule: React.FC = () => {
  const today = todayInSAST();

  const { data: schedule = [], isLoading } = useQuery({
    queryKey: ['daily-schedule', today],
    queryFn: async (): Promise<DailyAppointment[]> => {
      const startOfDay = `${today}T00:00:00`;
      const endOfDay = `${today}T23:59:59`;

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          case_status,
          matter_type,
          referring_attorney,
          claimants ( first_name, last_name ),
          medical_experts ( first_name, last_name, expert_type )
        `)
        .is('deleted_at', null)
        .gte('appointment_date', startOfDay)
        .lte('appointment_date', endOfDay)
        .order('appointment_date', { ascending: true });

      if (error) throw error;

      return (data || []).map((a: any) => ({
        id: a.id,
        time: formatTimeSAST(a.appointment_date),
        claimant: a.claimants
          ? `${a.claimants.first_name} ${a.claimants.last_name}`
          : '—',
        expert: a.medical_experts
          ? `${a.medical_experts.first_name} ${a.medical_experts.last_name}`
          : '—',
        expertType: a.medical_experts?.expert_type || '—',
        attorney: a.referring_attorney || '—',
        status: (a.case_status || 'scheduled').toLowerCase(),
        matterType: a.matter_type || '—',
      }));
    },
  });

  const confirmed = schedule.filter(s => s.status === 'scheduled' || s.status === 'confirmed').length;
  const needsAttention = schedule.length - confirmed;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading today's schedule…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-2">
      <div className="grid grid-cols-3 gap-4">
        <Card className="rounded-none border-black/10 shadow-none">
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-3xl font-bold text-primary">{schedule.length}</p>
            <p className="text-xs text-muted-foreground">Today's Appointments</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-black/10 shadow-none">
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-3xl font-bold text-success">{confirmed}</p>
            <p className="text-xs text-muted-foreground">Confirmed / Scheduled</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-black/10 shadow-none">
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-3xl font-bold text-warning">{needsAttention}</p>
            <p className="text-xs text-muted-foreground">Needs Attention</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-none border-black/10 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Today's Schedule — {today}
          </CardTitle>
        </CardHeader>
        <CardContent className={schedule.length > 0 ? 'max-h-[520px] space-y-3 overflow-y-auto pr-1' : 'space-y-3'}>
          {schedule.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No appointments scheduled for today.
            </p>
          ) : (
            schedule.map((appt) => (
              <div key={appt.id} className="flex items-center gap-4 p-3 bg-muted/20 rounded-lg border border-border/30">
                <div className="text-center min-w-[60px]">
                  <Clock className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-sm font-bold text-foreground">{appt.time}</p>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{appt.claimant}</p>
                  <p className="text-xs text-muted-foreground">
                    {appt.expert} · {appt.expertType} · {appt.matterType}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {appt.attorney}
                </div>
                <Badge className={`text-[10px] ${
                  appt.status === 'confirmed' || appt.status === 'scheduled'
                    ? 'bg-success/10 text-success'
                    : appt.status === 'rescheduled'
                      ? 'bg-warning/10 text-warning'
                      : appt.status === 'cancelled'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted text-muted-foreground'
                }`}>
                  {appt.status}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyScheduleModule;
