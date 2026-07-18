import React from 'react';
import { Calendar, Clock, Users, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { todayInSAST, formatTimeSAST } from '@/utils/dateTime';
import {
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminEmptyState,
  AdminPill,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

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
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: BRAND_TEAL }} />
        <span className="ml-2 text-sm text-slate-500">Loading today's schedule…</span>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-4">
      {/* Summary tiles — stack to a single column on phones, 3-across from
          the small breakpoint up. Fixed grid-cols-3 previously crushed
          these on narrow screens; text is flat black, per brand — no
          traffic-light colour coding on the counts themselves. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AdminCard>
          <div className="px-4 py-4 text-center">
            <p className="text-3xl font-bold text-black">{schedule.length}</p>
            <p className="text-xs text-slate-500">Today's Appointments</p>
          </div>
        </AdminCard>
        <AdminCard>
          <div className="px-4 py-4 text-center">
            <p className="text-3xl font-bold text-black">{confirmed}</p>
            <p className="text-xs text-slate-500">Confirmed / Scheduled</p>
          </div>
        </AdminCard>
        <AdminCard>
          <div className="px-4 py-4 text-center">
            <p className="text-3xl font-bold text-black">{needsAttention}</p>
            <p className="text-xs text-slate-500">Needs Attention</p>
          </div>
        </AdminCard>
      </div>

      <AdminCard>
        <AdminCardHeader
          icon={Calendar}
          title={`Today's Schedule — ${today}`}
        />
        <AdminCardBody
          className={schedule.length > 0 ? 'max-h-[520px] space-y-2 overflow-y-auto' : ''}
        >
          {schedule.length === 0 ? (
            <AdminEmptyState
              icon={Calendar}
              title="No appointments scheduled for today."
            />
          ) : (
            schedule.map((appt) => (
              <div
                key={appt.id}
                className="flex flex-col gap-3 border border-black/10 bg-black/[0.015] p-3 sm:flex-row sm:items-center sm:gap-4"
              >
                {/* Time */}
                <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-center sm:gap-1 sm:text-center sm:min-w-[64px]">
                  <Clock className="h-4 w-4 shrink-0" style={{ color: BRAND_TEAL }} />
                  <p className="text-sm font-bold text-black">{appt.time}</p>
                </div>

                {/* Claimant / expert / matter */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-black">{appt.claimant}</p>
                  <p className="truncate text-xs text-slate-500">
                    {appt.expert} · {appt.expertType} · {appt.matterType}
                  </p>
                </div>

                {/* Attorney + status — wraps under the row instead of
                    overlapping/being clipped on narrow screens. */}
                <div className="flex flex-wrap items-center gap-3 sm:shrink-0 sm:justify-end">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Users className="h-3 w-3 shrink-0" />
                    <span className="truncate">{appt.attorney}</span>
                  </div>
                  <AdminPill tone="neutral">{appt.status}</AdminPill>
                </div>
              </div>
            ))
          )}
        </AdminCardBody>
      </AdminCard>
    </div>
  );
};

export default DailyScheduleModule;
