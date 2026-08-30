import React from 'react';
import AssessmentReportsStatistics from '@/pages/AssessmentReportsStatistics';

/**
 * Admin Portal nav destination for Assessment Reports & Statistics.
 *
 * Reuses the existing AssessmentReportsStatistics page in `embedded` mode
 * (same convention as the Appointment Engine's tabs) instead of forking a
 * second copy of its charts/exports/archive logic — one implementation,
 * gated by the Admin Portal's module-based access control here, and still
 * reachable at its original standalone route for the referring-attorney
 * portal, which links to it directly.
 */
const AdminAssessmentReportsStatistics: React.FC = () => {
  return <AssessmentReportsStatistics embedded />;
};

export default AdminAssessmentReportsStatistics;
