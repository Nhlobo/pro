
// Map routes to required permissions with strict access control for referring attorneys
export const ROUTE_PERMISSIONS: Record<string, string | string[]> = {
  // Referring Attorney ALLOWED routes - restricted to their own law firm data only
  '/appointment-request': 'referring_attorney',
  '/appointment-request-dashboard': 'referring_attorney', // View their own appointment requests only
  '/claimant-reports': 'referring_attorney', // View reports for their law firm's claimants only
  '/referring-attorney-report': 'referring_attorney', // View their own reports only
  '/scheduled-assessment': 'referring_attorney', // View their own assessments only
  '/report-tracking': 'referring_attorney', // Track their own reports only
  '/sample-reports': 'referring_attorney', // View sample reports (limited access)
  '/document-uploading': 'referring_attorney', // Upload their own documents only

  // RESTRICTED routes - referring attorneys CANNOT access these
  '/claimant': 'admin_only', // Cannot add new claimants (admin only)
  '/claimant-list': 'manage_claimants', // Cannot view all claimants (admin/employee only)
  '/referring-attorney': 'admin_only', // Cannot add new attorneys (admin only)
  '/referring-attorney-list': 'admin_only', // Cannot view all attorneys (admin only)
  '/referring-attorney-update': 'admin_only', // Cannot update other attorneys (admin only)
  '/medical-expert': 'manage_experts', // Cannot manage experts (admin/employee only)
  '/medical-expert-directory': 'manage_experts', // Cannot view expert directory (admin/employee only)
  '/expert-reports': 'manage_experts', // Cannot manage expert reports (admin/employee only)
  '/appointment-schedule': 'manage_appointments', // Cannot manage all appointments (admin/employee only)
  '/new-appointment': 'manage_appointments', // Cannot create appointments for others (admin/employee only)
  '/assessment-reports-statistics': 'admin_only', // Cannot view system analytics (admin only)
  '/user-management': 'admin_only', // Cannot manage users (admin only)
  '/edit-requests': 'admin_only', // Cannot manage edit requests (admin only)
  '/audit-trail': 'admin_only', // Cannot view audit trail (admin only)
};

// Dashboard section permissions - strict restrictions for referring attorneys
export const DASHBOARD_SECTION_PERMISSIONS = {
  // ALLOWED sections for referring attorneys (own data only)
  appointment_request: 'referring_attorney', // Can request appointments for their cases
  claimant_reports: 'referring_attorney', // Can view reports for their law firm's claimants
  attorney_reports: 'referring_attorney', // Can view their own reports
  document_upload: 'referring_attorney', // Can upload their own documents
  profile_management: 'referring_attorney', // Can manage their own profile
  
  // RESTRICTED sections - referring attorneys CANNOT access
  claimant_management: 'admin_only', // Cannot manage claimants (admin only)
  attorney_management: 'admin_only', // Cannot view/manage other attorneys (admin only)
  add_new_attorney: 'admin_only', // Cannot add new attorneys (admin only)
  view_all_attorneys: 'admin_only', // Cannot view all attorneys (admin only)
  attorney_list: 'admin_only', // Cannot access attorney lists (admin only)
  update_attorney_info: 'admin_only', // Cannot update other attorney info (admin only)
  medical_experts: 'manage_experts', // Cannot manage experts (admin/employee only)
  assessment_schedule: 'manage_appointments', // Cannot manage all appointments (admin/employee only)
  document_management: 'manage_documents', // Cannot manage all documents (admin/employee only)
  user_management: 'admin_only', // Cannot manage users (admin only)
  reports_analytics: 'admin_only', // Cannot view system analytics (admin only)
  system_settings: 'admin_only', // Cannot access system settings (admin only)
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
