import React from 'react';
import ScheduledAssessment from '@/pages/ScheduledAssessment';

interface ScheduledAssessmentModuleProps {
  /** Opens the Appointment Engine's in-panel editor for this appointment
   *  instead of the module's default full-page redirect to the standalone
   *  /new-appointment route. */
  onEditAppointment?: (appointmentId: string) => void;
}

/**
 * Wrapper that embeds the full Scheduled Assessment page as a standalone
 * module inside the Admin Appointment Engine.
 *
 * Uses ScheduledAssessment's `embedded` prop so the page's own System
 * Header Nav, Helmet tags, and footer are dropped entirely instead of
 * being visually hidden — that old nav bar linked out to standalone pages
 * guarded by a different, non-module permission model than the Admin
 * Portal, which was a security-hygiene gap as well as a UX one.
 */
const ScheduledAssessmentModule: React.FC<ScheduledAssessmentModuleProps> = ({ onEditAppointment }) => {
  return (
    <div className="mt-2">
      <ScheduledAssessment embedded onEditAppointment={onEditAppointment} />
    </div>
  );
};

export default ScheduledAssessmentModule;
