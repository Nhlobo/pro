import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate } from 'react-router-dom';
import AttorneyPortalLayout from './AttorneyPortalLayout';
import { useAttorneyCase } from '@/hooks/externalPortal/useAttorneyPortal';
import CaseDocumentsSection from '../shared/CaseDocumentsSection';
import CaseProgressSection from '../shared/CaseProgressSection';
import CaseMessagesSection from '../shared/CaseMessagesSection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { formatDateTimeShort } from '@/utils/dateTime';

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

const AttorneyPortalCaseDetail: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useAttorneyCase(appointmentId);

  return (
    <AttorneyPortalLayout>
      <Helmet><title>Referring Attorney Portal — Case Detail</title></Helmet>

      <Button variant="ghost" size="sm" className="mb-4 rounded-none px-0 text-slate-500" onClick={() => navigate('/external-portal/attorney/cases')}>
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
            <CardHeader><CardTitle className="text-base">Claim Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Claimant" value={data.case.claimant ? `${data.case.claimant.first_name} ${data.case.claimant.last_name}` : null} />
              <Field label="Reference" value={data.case.claimant?.auto_id} />
              <Field label="Matter Type" value={data.case.matter_type} />
              <Field label="Case Status" value={data.case.case_status} />
              <Field label="Appointment Date" value={formatDateTimeShort(data.case.appointment_date)} />
              <Field label="Assessment Code" value={data.case.assessment_code} />
            </CardContent>
          </Card>

          <Card className="rounded-none border-black/10">
            <CardHeader><CardTitle className="text-base">Medical Expert</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Expert" value={data.case.expert ? `Dr. ${data.case.expert.first_name} ${data.case.expert.last_name}` : null} />
              <Field label="Specialty" value={data.case.expert?.expert_type} />
              <Field label="Location" value={[data.case.expert?.city, data.case.expert?.province].filter(Boolean).join(', ') || null} />
            </CardContent>
          </Card>

          <Card className="rounded-none border-black/10">
            <CardHeader><CardTitle className="text-base">Report Progress</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Status" value={data.case.report ? REPORT_STATUS_LABEL[data.case.report.report_status] || data.case.report.report_status : 'Not yet started'} />
              <Field label="Due Date" value={data.case.report?.report_due_date ? formatDateTimeShort(data.case.report.report_due_date) : null} />
              <Field label="Submitted" value={data.case.report?.report_submitted_date ? formatDateTimeShort(data.case.report.report_submitted_date) : null} />
            </CardContent>
          </Card>

          <Card className="rounded-none border-black/10">
            <CardHeader><CardTitle className="text-base">Fees &amp; Terms</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Payment Status" value={data.case.payment_status} />
              <Field label="Service Fee" value={data.case.service_fee != null ? `R ${data.case.service_fee}` : null} />
              <Field label="Deposit" value={data.case.deposit_amount != null ? `R ${data.case.deposit_amount}` : null} />
              <Field label="Agreement Duration" value={data.case.agreement_duration_months ? `${data.case.agreement_duration_months} months` : null} />
            </CardContent>
          </Card>

          {appointmentId && (
            <>
              <CaseProgressSection appointmentId={appointmentId} />
              <CaseDocumentsSection appointmentId={appointmentId} />
              <CaseMessagesSection appointmentId={appointmentId} />
            </>
          )}
        </div>
      )}
    </AttorneyPortalLayout>
  );
};

export default AttorneyPortalCaseDetail;
