
// Map routes to required permissions
export const ROUTE_PERMISSIONS: Record<string, string | string[]> = {
  // Referring Attorney allowed routes - restricted to their own law firm data
  '/appointment-request': 'referring_attorney',
  '/claimant-reports': 'referring_attorney', 
  '/referring-attorney-report': 'referring_attorney',

  // Admin/Staff only routes  
  '/claimant': 'manage_claimants',
  '/claimant-list': 'manage_claimants',
  '/referring-attorney': 'manage_attorneys',
  '/referring-attorney-list': 'manage_attorneys',
  '/referring-attorney-update': 'manage_attorneys',
  '/medical-expert': 'manage_experts',
  '/medical-expert-directory': ['view_reports', 'manage_experts'], // Allow employees to view
  '/expert-reports': ['manage_experts', 'view_reports'],
  '/appointment-request-dashboard': 'manage_appointments',
  '/appointment-schedule': 'manage_appointments',
  '/new-appointment': 'manage_appointments',
  '/scheduled-assessment': ['manage_appointments', 'referring_attorney'], // Allow attorneys to view their assessments
  '/report-tracking': ['view_reports', 'referring_attorney'],
  '/assessment-reports-statistics': ['view_reports', 'view_analytics'],
  '/document-uploading': 'manage_documents',
  '/sample-reports': ['view_reports', 'referring_attorney'],
  '/lead-generator': 'manage_leads',
  '/lead-history': 'manage_leads',
  '/user-management': 'admin_only',
  '/edit-requests': 'admin_only',
  '/audit-trail': 'admin_only',
};

// Dashboard section permissions - restrict referring attorneys
export const DASHBOARD_SECTION_PERMISSIONS = {
  // Only these sections for referring attorneys
  appointment_request: 'referring_attorney',
  claimant_reports: 'referring_attorney', 
  attorney_reports: 'referring_attorney',
  
  // Admin/Staff only sections
  claimant_management: 'manage_claimants',
  attorney_management: 'manage_attorneys',
  medical_experts: 'manage_experts',
  assessment_schedule: 'manage_appointments',
  document_management: 'manage_documents',
  lead_management: 'manage_leads',
  user_management: 'admin_only',
  reports_analytics: ['view_reports', 'view_analytics'],
};

export const usePermissionRoutes = () => {
  const getRequiredPermission = (route: string): string | string[] | null => {
    return ROUTE_PERMISSIONS[route] || null;
  };

  const getDashboardSectionPermission = (section: string): string | string[] | null => {
    return DASHBOARD_SECTION_PERMISSIONS[section] || null;
  };

  return {
    getRequiredPermission,
    getDashboardSectionPermission,
    ROUTE_PERMISSIONS,
    DASHBOARD_SECTION_PERMISSIONS,
  };
};
