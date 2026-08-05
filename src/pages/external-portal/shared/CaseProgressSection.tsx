import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Circle, Loader2, Clock } from 'lucide-react';
import { useCaseProgress } from '@/hooks/externalPortal/useCaseProgress';
import { formatDateTimeShort } from '@/utils/dateTime';

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  in_progress: <Clock className="h-4 w-4 text-amber-500" />,
  pending: <Circle className="h-4 w-4 text-slate-300" />,
};

const CaseProgressSection: React.FC<{ appointmentId: string }> = ({ appointmentId }) => {
  const { data, isLoading } = useCaseProgress(appointmentId);

  return (
    <Card className="rounded-none border-black/10">
      <CardHeader><CardTitle className="text-base">Case Progress</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading progress…
          </div>
        ) : !data || data.phases.length === 0 ? (
          <p className="py-2 text-sm text-slate-400">A progress timeline hasn't been set up for this case yet.</p>
        ) : (
          <div className="space-y-3">
            {data.phases.map((phase) => (
              <div key={phase.phase_order} className="flex items-start gap-3">
                <div className="mt-0.5">{STATUS_ICON[phase.status] || <Circle className="h-4 w-4 text-slate-300" />}</div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-black">{phase.phase_name}</p>
                  <p className="text-xs text-slate-500">
                    {phase.status === 'completed' && phase.completed_at
                      ? `Completed ${formatDateTimeShort(phase.completed_at)}`
                      : phase.status === 'in_progress' && phase.started_at
                        ? `Started ${formatDateTimeShort(phase.started_at)}`
                        : 'Not started yet'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CaseProgressSection;
