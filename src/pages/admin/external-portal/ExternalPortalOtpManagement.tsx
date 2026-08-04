import React from 'react';
import { Helmet } from 'react-helmet-async';
import ExternalPortalManagementLayout from './ExternalPortalManagementLayout';
import { AdminCard, AdminCardHeader, AdminCardBody, AdminEmptyState } from '@/components/admin/ui/AdminUI';
import { KeyRound } from 'lucide-react';

const ExternalPortalOtpManagement: React.FC = () => (
  <ExternalPortalManagementLayout>
    <Helmet><title>External Portal Management — OTP Management</title></Helmet>
    <AdminCard className="mt-4">
      <AdminCardHeader title="OTP Management" description="Outstanding and recent one-time codes." icon={KeyRound} />
      <AdminCardBody>
        <AdminEmptyState
          icon={KeyRound}
          title="OTP delivery arrives in Phase 2"
          description="Once the OTP send/verify edge functions are built, active and recent codes per account will show here."
        />
      </AdminCardBody>
    </AdminCard>
  </ExternalPortalManagementLayout>
);

export default ExternalPortalOtpManagement;
