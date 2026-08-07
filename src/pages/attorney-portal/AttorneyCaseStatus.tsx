import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { useAttorneyCases, useAttorneyCase } from '@/hooks/externalPortal/useAttorneyPortal';
import { useCaseProgress } from '@/hooks/externalPortal/useCaseProgress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2, Circle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTimeShort } from '@/utils/dateTime';

// Case detail + progress timeline come from the External Portal
// Module's case-link-scoped get_case / list_progress actions — same
// source used by the OTP-authenticated new-module UI.
const AttorneyCaseStatus: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('case') || undefined;

  const { data: casesData, isLoading: casesLoading } = useAttorneyCases();
  const cases = casesData?.cases ?? [];
  const activeId = selectedId || cases[0]?.appointment_id;

  const { data: caseData, isLoading: caseLoading, isError, error } = useAttorneyCase(activeId);
  const { data: progressData, isLoading: progressLoading } = useCaseProgress(activeId);

  return (
    <AttorneyPortalLayout>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-foreground">Case Status</h1>
        {cases.length > 0 && (
          <Select value={activeId} onValueChange={(v) => setParams({ case: v })}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Select a case" />
            </SelectTrigger>
            <SelectContent>
              {cases.map(c => (
                <SelectItem key={c.appointment_id} value={c.appointment_id}>
                  {c.claimant ? `${c.claimant.first_name} ${c.claimant.last_name}` : 'Claimant'} — {c.matter_type || 'Matter'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {casesLoading && (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading your cases…
        </div>
      )}

      {!casesLoading && cases.length === 0 && (
        <p className="py-16 text-center text-sm text-muted-foreground">No cases have been linked to your portal account yet.</p>
      )}

      {!casesLoading && cases.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-base">Case Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(caseLoading) && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
              {isError && <p className="text-sm text-destructive">{(error as any)?.message || 'Could not load this case.'}</p>}
              {caseData?.case && (
                <>
                  <Row label="Claimant" value={caseData.case.claimant ? `${caseData.case.claimant.first_name} ${caseData.case.claimant.last_name}` : '—'} />
                  <Row label="Reference" value={caseData.case.claimant?.auto_id || '—'} />
                  <Row label="Matter Type" value={caseData.case.matter_type || '—'} />
                  <Row label="Appointment" value={formatDateTimeShort(caseData.case.appointment_date)} />
                  <Row label="Status" value={caseData.case.case_status || '—'} />
                  <Row label="Expert" value={caseData.case.expert ? `Dr. ${caseData.case.expert.first_name} ${caseData.case.expert.last_name}` : 'TBC'} />
                  <Row label="Report Status" value={caseData.case.report?.report_status || 'Not started'} />
                  <Row label="Report Due" value={caseData.case.report?.report_due_date ? formatDateTimeShort(caseData.case.report.report_due_date) : '—'} />
                </>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Progress Timeline</CardTitle></CardHeader>
            <CardContent>
              {progressLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
              {!progressLoading && (!progressData?.phases || progressData.phases.length === 0) && (
                <p className="text-sm text-muted-foreground">No progress information available for this case yet.</p>
              )}
              {!progressLoading && progressData?.phases && progressData.phases.length > 0 && (
                <ol className="space-y-4">
                  {[...progressData.phases].sort((a, b) => a.phase_order - b.phase_order).map(p => (
                    <li key={p.phase_name} className="flex items-start gap-3">
                      {p.status === 'completed' ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      ) : p.status === 'in_progress' ? (
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      ) : (
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                      )}
                      <div>
                        <p className={cn('text-sm font-medium', p.status === 'completed' && 'text-foreground', p.status !== 'completed' && 'text-muted-foreground')}>
                          {p.phase_name}
                        </p>
                        {p.completed_at && <p className="text-xs text-muted-foreground">Completed {formatDateTimeShort(p.completed_at)}</p>}
                        {!p.completed_at && p.started_at && <p className="text-xs text-muted-foreground">Started {formatDateTimeShort(p.started_at)}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AttorneyPortalLayout>
  );
};

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between border-b border-border/50 py-1.5 last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{value}</span>
  </div>
);

export default AttorneyCaseStatus;
