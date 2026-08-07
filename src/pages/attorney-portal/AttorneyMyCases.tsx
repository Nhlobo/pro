import React from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { useAttorneyCases } from '@/hooks/externalPortal/useAttorneyPortal';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, FolderOpen, ChevronRight, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDateTimeShort } from '@/utils/dateTime';

const CASE_STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  assessed: 'Assessed',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
};

// Data comes from the External Portal Module's case-link-scoped
// list_cases action — same source used by the OTP-authenticated
// new-module UI. Document upload was removed here: there's no
// case-link-scoped write path for it yet (see the External Portal
// follow-up list).
const AttorneyMyCases: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useAttorneyCases();
  const [search, setSearch] = React.useState('');

  const cases = (data?.cases ?? []).filter(c => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      c.claimant?.first_name?.toLowerCase().includes(s) ||
      c.claimant?.last_name?.toLowerCase().includes(s) ||
      c.claimant?.reference?.toLowerCase().includes(s) ||
      c.matter_type?.toLowerCase().includes(s)
    );
  });

  return (
    <AttorneyPortalLayout>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-foreground">My Cases</h1>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search cases…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading your cases…
        </div>
      )}

      {isError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {(error as any)?.message || 'Could not load your cases. Please try again.'}
        </p>
      )}

      {!isLoading && !isError && cases.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
            No cases match your search.
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && cases.length > 0 && (
        <div className="space-y-2">
          {cases.map(c => (
            <Card
              key={c.appointment_id}
              className="cursor-pointer transition hover:border-primary/40"
              onClick={() => navigate(`/attorney-portal/case-status?case=${c.appointment_id}`)}
            >
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {c.claimant ? `${c.claimant.first_name} ${c.claimant.last_name}` : 'Claimant'}
                    {c.claimant?.reference && <span className="ml-2 text-xs text-muted-foreground">#{c.claimant.reference}</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.matter_type || 'Matter'} · {c.expert ? `Dr. ${c.expert.first_name} ${c.expert.last_name} (${c.expert.expert_type})` : 'Expert TBC'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">Appointment: {formatDateTimeShort(c.appointment_date)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {CASE_STATUS_LABEL[c.case_status || ''] || c.case_status || 'Unknown'}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AttorneyPortalLayout>
  );
};

export default AttorneyMyCases;
