import React from 'react';
import { Helmet } from 'react-helmet-async';
import ExternalPortalManagementLayout from './ExternalPortalManagementLayout';
import { AdminCard, AdminCardHeader, AdminCardBody, AdminEmptyState } from '@/components/admin/ui/AdminUI';
import { Link2 } from 'lucide-react';

/**
 * Phase 1 ships the `external_portal_access_links` table and RLS only.
 * Link generation, delivery, and consumption are built in Phase 2
 * (secure token generation edge function + the External Portal Sign In
 * page that consumes it). This page becomes fully interactive then —
 * kept as a real route now so the nav and layout don't change shape
 * between phases.
 */
const ExternalPortalAccessLinks: React.FC = () => (
  <ExternalPortalManagementLayout>
    <Helmet><title>External Portal Management — Access Links</title></Helmet>
    <AdminCard className="mt-4">
      <AdminCardHeader title="Access Links" description="One-time secure registration links." icon={Link2} />
      <AdminCardBody>
        <AdminEmptyState
          icon={Link2}
          title="Link generation arrives in Phase 2"
          description="Once authentication (OTP, sessions, one-time links) is built, generate and manage links for each Portal Account from here."
        />
      </AdminCardBody>
    </AdminCard>
  </ExternalPortalManagementLayout>
);

export default ExternalPortalAccessLinks;
