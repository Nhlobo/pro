import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate } from 'react-router-dom';
import ExpertPortalLayout from './ExpertPortalLayout';
import { useExpertCase } from '@/hooks/externalPortal/useExpertPortal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { formatDateTimeShort } from '@/utils/dateTime';
import PortalCaseDocuments from '@/components/external-portal/PortalCaseDocuments';
import PortalCaseProgress from '@/components/external-portal/PortalCaseProgress';

const REPORT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue',
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm text-black">{value ?? '—'}</p>
    </div>
  );
}

const ExpertPortalCaseDetail: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useExpertCase(appointmentId);

  return (
    <ExpertPortalLayout>
      <Helmet><title>Medical Expert Portal — Case Detail</title></Helmet>

      <Button variant="ghost" size="sm" className="mb-4 rounded-none px-0 text-slate-500" onClick={() => navigate('/external-portal/expert/cases')}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Your Cases
      </Button>

      {isLoading && (
        <div className="flex flex-col items-center gap-3 py-16 text-sm text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          Loading case…
        </div>
      )}

      {isError && (
        <p className="rounded-none border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {(error as any)?.message || 'Could not load this case.'}
        </p>
      )}

      {!isLoading && !isError && data && (
        <div className="space-y-4">
          <Card className="rounded-none border-black/10">
            <CardHeader><CardTitle className="text-base">Claimant</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Claimant" value={data.case.claimant ? `${data.case.claimant.first_name} ${data.case.claimant.last_name}` : null} />
              <Field label="Reference" value={data.case.claimant?.auto_id} />
              <Field label="Contact Number" value={data.case.claimant?.contact_number} />
              <Field label="Matter Type" value={data.case.matter_type} />
              <Field label="Case Status" value={data.case.case_status} />
              <Field label="Appointment Date" value={formatDateTimeShort(data.case.appointment_date)} />
            </CardContent>
          </Card>

          <Card className="rounded-none border-black/10">
            <CardHeader><CardTitle className="text-base">Referring Attorney</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Firm" value={data.case.referring_attorney?.name} />
              <Field label="Contact Person" value={data.case.referring_attorney?.contact_person} />
              <Field label="Phone" value={data.case.referring_attorney?.phone} />
              <Field label="Email" value={data.case.referring_attorney?.email} />
              <Field label="Firm Code" value={data.case.referring_attorney?.code} />
            </CardContent>
          </Card>

          <Card className="rounded-none border-black/10">
            <CardHeader><CardTitle className="text-base">Your Report</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Status" value={data.case.report ? REPORT_STATUS_LABEL[data.case.report.report_status] || data.case.report.report_status : 'Not yet started'} />
              <Field label="Due Date" value={data.case.report?.report_due_date ? formatDateTimeShort(data.case.report.report_due_date) : null} />
              <Field label="Submitted" value={data.case.report?.report_submitted_date ? formatDateTimeShort(data.case.report.report_submitted_date) : null} />
              <Field label="Assessment Code" value={data.case.assessment_code} />
            </CardContent>
          </Card>

          <PortalCaseProgress appointmentId={appointmentId} />

          <PortalCaseDocuments appointmentId={appointmentId} />
        </div>
      )}
    </ExpertPortalLayout>
  );
};

export default ExpertPortalCaseDetail;
