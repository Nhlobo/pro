import React from 'react';
import { Helmet } from 'react-helmet-async';
import ExternalPortalManagementLayout from './ExternalPortalManagementLayout';
import { AdminCard, AdminCardHeader, AdminCardBody, AdminEmptyState } from '@/components/admin/ui/AdminUI';
import { Radio } from 'lucide-react';

const ExternalPortalActiveSessions: React.FC = () => (
  <ExternalPortalManagementLayout>
    <Helmet><title>External Portal Management — Active Sessions</title></Helmet>
    <AdminCard className="mt-4">
      <AdminCardHeader title="Active Sessions" description="Live external portal sessions, revocable by admin." icon={Radio} />
      <AdminCardBody>
        <AdminEmptyState
          icon={Radio}
          title="Session management arrives in Phase 2"
          description="Sessions are issued once authentication is built. This page will list and let you revoke live sessions per account."
        />
      </AdminCardBody>
    </AdminCard>
  </ExternalPortalManagementLayout>
);

export default ExternalPortalActiveSessions;
