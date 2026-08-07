import React from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { useAttorneyCases } from '@/hooks/externalPortal/useAttorneyPortal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Loader2, Briefcase, Clock, FileCheck2, AlertCircle, ArrowRight } from 'lucide-react';
import { formatDateTimeShort } from '@/utils/dateTime';

// Data comes from the External Portal Module's case-link-scoped
// list_cases action (external-portal-attorney-data), the same source
// used by the OTP-authenticated new-module UI. See useAttorneyPortal.ts.
const AttorneyPortalDashboard: React.FC = () => {
  const { data, isLoading, isError, error } = useAttorneyCases();
  const cases = data?.cases ?? [];

  const scheduled = cases.filter(c => c.case_status === 'scheduled').length;
  const assessed = cases.filter(c => c.case_status === 'assessed').length;
  const reportsOutstanding = cases.filter(c => c.report && c.report.report_status !== 'submitted' && c.report.report_status !== 'finalized').length;

  return (
    <AttorneyPortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Welcome{data?.account?.full_name ? `, ${data.account.full_name}` : ''}</h1>
        <p className="text-sm text-muted-foreground">Here's an overview of your linked cases.</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading your cases…
        </div>
      )}

      {isError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {(error as any)?.message || 'Could not load your cases. Please try again.'}
        </p>
      )}

      {!isLoading && !isError && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Briefcase className="h-4 w-4" /> Total Cases
                </CardTitle>
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{cases.length}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Clock className="h-4 w-4" /> Scheduled
                </CardTitle>
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{scheduled}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <FileCheck2 className="h-4 w-4" /> Assessed
                </CardTitle>
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{assessed}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <AlertCircle className="h-4 w-4" /> Reports Outstanding
                </CardTitle>
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{reportsOutstanding}</p></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Cases</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/attorney-portal/cases">View all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {cases.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No cases have been linked to your portal account yet.</p>
              )}
              {cases.slice(0, 5).map(c => (
                <Link
                  key={c.appointment_id}
                  to={`/attorney-portal/case-status?case=${c.appointment_id}`}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {c.claimant ? `${c.claimant.first_name} ${c.claimant.last_name}` : 'Claimant'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.matter_type || 'Matter'} · {formatDateTimeShort(c.appointment_date)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {c.case_status || 'Unknown'}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </AttorneyPortalLayout>
  );
};

export default AttorneyPortalDashboard;
