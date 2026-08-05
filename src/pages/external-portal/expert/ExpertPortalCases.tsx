import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import ExpertPortalLayout from './ExpertPortalLayout';
import { useExpertCases } from '@/hooks/externalPortal/useExpertPortal';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, FolderOpen, ChevronRight } from 'lucide-react';
import { formatDateTimeShort } from '@/utils/dateTime';

const CASE_STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  assessed: 'Assessed',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
};

const ExpertPortalCases: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useExpertCases();

  return (
    <ExpertPortalLayout>
      <Helmet><title>Medical Expert Portal — Your Cases</title></Helmet>

      <h1 className="mb-4 text-lg font-semibold text-black">Your Cases</h1>

      {isLoading && (
        <div className="flex flex-col items-center gap-3 py-16 text-sm text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          Loading your cases…
        </div>
      )}

      {isError && (
        <p className="rounded-none border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {(error as any)?.message || 'Could not load your cases. Please try again.'}
        </p>
      )}

      {!isLoading && !isError && (!data || data.cases.length === 0) && (
        <div className="flex flex-col items-center gap-2 border border-dashed border-black/15 bg-white py-16 text-center text-sm text-slate-500">
          <FolderOpen className="h-8 w-8 text-slate-300" />
          No cases have been linked to your portal account yet.
          <p className="text-xs text-slate-400">Contact your case administrator if you were expecting to see a case here.</p>
        </div>
      )}

      {!isLoading && !isError && data && data.cases.length > 0 && (
        <div className="space-y-2">
          {data.cases.map((c) => (
            <Card
              key={c.appointment_id}
              className="cursor-pointer rounded-none border-black/10 transition hover:border-black/30"
              onClick={() => navigate(`/external-portal/expert/cases/${c.appointment_id}`)}
            >
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-black">
                    {c.claimant ? `${c.claimant.first_name} ${c.claimant.last_name}` : 'Claimant'}
                    {c.claimant?.reference && <span className="ml-2 text-xs text-slate-400">#{c.claimant.reference}</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {c.matter_type || 'Matter'} · Referred by {c.referring_attorney?.name || 'Unknown firm'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Appointment: {formatDateTimeShort(c.appointment_date)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="border border-black/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
                    {CASE_STATUS_LABEL[c.case_status || ''] || c.case_status || 'Unknown'}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ExpertPortalLayout>
  );
};

export default ExpertPortalCases;
