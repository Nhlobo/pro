import React from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import PortalFeatureUnavailable from '@/components/portal/PortalFeatureUnavailable';

// This page previously booked new appointment requests directly against
// Supabase-auth-scoped tables (referring_attorneys / appointment_requests).
// The External Portal Module's OTP-authenticated sessions have no
// case-link-scoped write path for creating new appointment requests yet.
// See the External Portal follow-up list for what's needed to restore this.
const AttorneyAppointments: React.FC = () => (
  <AttorneyPortalLayout>
    <PortalFeatureUnavailable
      title="Appointments"
      description="Booking new appointment requests isn't connected to the external portal session yet."
    />
  </AttorneyPortalLayout>
);

export default AttorneyAppointments;
