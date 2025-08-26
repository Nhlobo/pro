// Map routes to required permissions
export const ROUTE_PERMISSIONS: Record<string, string | string[]> = {
  // Claimant Management
  '/claimant': 'manage_claimants',
  '/claimant-list': 'manage_claimants',
  '/claimant-reports': ['manage_claimants', 'view_reports'],

  // Attorney Management
  '/referring-attorney': 'manage_attorneys',
  '/referring-attorney-list': 'manage_attorneys',
  '/referring-attorney-report': ['manage_attorneys', 'view_reports'],
  '/referring-attorney-update': 'manage_attorneys',

  // Medical Expert Management
  '/medical-expert': 'manage_experts',
  '/medical-expert-directory': 'manage_experts',
  '/expert-reports': ['manage_experts', 'view_reports'],

  // Appointment Management
  '/appointment-request': 'manage_appointments',
  '/appointment-request-dashboard': 'manage_appointments',
  '/appointment-schedule': 'manage_appointments',
  '/new-appointment': 'manage_appointments',
  '/scheduled-assessment': 'manage_appointments',

  // Reports and Analytics
  '/report-tracking': 'view_reports',
  '/assessment-reports-statistics': ['view_reports', 'view_analytics'],

  // Document Management
  '/document-uploading': 'manage_documents',

  // Lead Management 
  '/lead-generator': 'manage_leads',
  '/lead-history': 'manage_leads',

  // Admin only routes (no specific permission needed - admin role is enough)
  '/user-management': 'admin_only',
  '/edit-requests': 'admin_only',
  '/audit-trail': 'admin_only',
};

// Dashboard section permissions
export const DASHBOARD_SECTION_PERMISSIONS = {
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