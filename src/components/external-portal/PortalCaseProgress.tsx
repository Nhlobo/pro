import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Circle, Loader2, Clock } from 'lucide-react';
import { usePortalCaseProgress } from '@/hooks/externalPortal/useExternalPortalEngagement';
import { formatDateTimeShort } from '@/utils/dateTime';

/**
 * Phase 5 — case progress. Renders the same litigation timeline staff
 * maintain in case_timelines; the portal only displays it.
 */
const PortalCaseProgress: React.FC<{ appointmentId?: string }> = ({ appointmentId }) => {
  const { data, isLoading, isError, error } = usePortalCaseProgress(appointmentId);
  const phases = data?.phases ?? [];

  return (
    <Card className="rounded-none border-black/10 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-[#00BAAD]" /> Case Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="flex items-center gap-2 py-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading progress…
          </p>
        )}

        {isError && (
          <p className="text-sm text-destructive">{(error as any)?.message || 'Could not load case progress.'}</p>
        )}

        {!isLoading && !isError && phases.length === 0 && (
          <p className="py-4 text-sm text-slate-500">No progress milestones have been recorded for this case yet.</p>
        )}

        <ol className="space-y-3">
          {phases.map((phase) => {
            const done = phase.status === 'completed';
            const active = phase.status === 'in_progress';
            return (
              <li key={phase.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-[#00BAAD]" />
                  ) : (
                    <Circle className={`h-5 w-5 ${active ? 'text-[#00BAAD]' : 'text-slate-300'}`} />
                  )}
                  <span className="mt-1 w-px flex-1 bg-black/10 last:hidden" />
                </div>
                <div className="min-w-0 pb-1">
                  <p className={`text-sm ${done || active ? 'font-medium text-black' : 'text-slate-500'}`}>
                    {phase.phase_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {done && phase.completed_at
                      ? `Completed ${formatDateTimeShort(phase.completed_at)}`
                      : active
                        ? 'In progress'
                        : 'Pending'}
                  </p>
                  {phase.notes && <p className="mt-1 break-words text-xs text-slate-500">{phase.notes}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
};

export default PortalCaseProgress;
