import React from 'react';
import { Helmet } from 'react-helmet-async';
import ExternalPortalManagementLayout from './ExternalPortalManagementLayout';
import { useExternalPortalOtpCodes, otpStatus } from '@/hooks/externalPortal/useExternalPortalOtpCodes';
import { AdminCard, AdminCardHeader, AdminCardBody, AdminEmptyState, AdminLoadingState, AdminPill } from '@/components/admin/ui/AdminUI';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KeyRound } from 'lucide-react';
import { formatDateTimeShort } from '@/utils/dateTime';

const STATUS_TONE: Record<string, 'success' | 'neutral' | 'warning' | 'destructive'> = {
  verified: 'success',
  pending: 'neutral',
  expired: 'warning',
  locked: 'destructive',
};

const ExternalPortalOtpManagement: React.FC = () => {
  const { data: codes, isLoading } = useExternalPortalOtpCodes();

  return (
    <ExternalPortalManagementLayout>
      <Helmet><title>External Portal Management — OTP Management</title></Helmet>

      <AdminCard className="mt-4">
        <AdminCardHeader
          title="OTP Codes"
          description="Most recent 200 one-time codes issued for registration and login. Codes themselves are never stored or shown — only status."
          icon={KeyRound}
        />
        <AdminCardBody className="p-0">
          {isLoading ? (
            <AdminLoadingState label="Loading OTP activity…" />
          ) : !codes || codes.length === 0 ? (
            <AdminEmptyState icon={KeyRound} title="No OTP activity yet" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Sent To</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {codes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <p className="font-medium">{c.account_full_name}</p>
                        <p className="text-xs text-slate-500">{c.account_email}</p>
                      </TableCell>
                      <TableCell className="capitalize">{c.purpose}</TableCell>
                      <TableCell className="text-slate-500">{c.destination}</TableCell>
                      <TableCell>{c.attempts} / {c.max_attempts}</TableCell>
                      <TableCell><AdminPill tone={STATUS_TONE[otpStatus(c)]}>{otpStatus(c)}</AdminPill></TableCell>
                      <TableCell className="text-slate-500">{formatDateTimeShort(c.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </AdminCardBody>
      </AdminCard>
    </ExternalPortalManagementLayout>
  );
};

export default ExternalPortalOtpManagement;
