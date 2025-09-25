
// Map routes to required permissions - ALLOW referring attorneys access to their own data
export const ROUTE_PERMISSIONS: Record<string, string | string[]> = {
  // Referring Attorney ALLOWED routes - full access to their own law firm data
  '/appointment-request': 'referring_attorney',
  '/appointment-request-dashboard': 'referring_attorney', // View their own appointment requests
  '/claimant-form': 'referring_attorney', // Can add claimants for their law firm
  '/claimant-list': 'referring_attorney', // Can view their law firm's claimants
  '/claimant-reports': 'referring_attorney', // View reports for their law firm's claimants
  '/referring-attorney-report': 'referring_attorney', // View their own reports
  '/referring-attorney-update': 'referring_attorney', // Can update their own profile
  '/scheduled-assessment': 'referring_attorney', // View their own assessments
  '/report-tracking': 'referring_attorney', // Track their own reports
  '/expert-report-tracking': 'referring_attorney', // Track expert reports for their cases
  '/sample-reports': 'referring_attorney', // View sample reports
  '/document-uploading': 'referring_attorney', // Upload their own documents
  '/new-appointment': 'referring_attorney', // Can request new appointments for their cases
  '/appointment-schedule': 'referring_attorney', // Can view their own appointments
  '/expert-reports': 'referring_attorney', // Can view reports linked to their cases

  // RESTRICTED routes - admin/employee only
  '/medical-expert-form': 'admin_only', // Cannot add new experts
  '/medical-expert-directory': 'manage_experts', // Cannot manage expert directory
  '/referring-attorney-form': 'admin_only', // Cannot add new attorneys
  '/referring-attorney-list': 'admin_only', // Cannot view all attorneys
  '/assessment-reports-statistics': 'admin_only', // Cannot view system analytics
  '/user-management': 'admin_only', // Cannot manage users
  '/edit-request-management': 'admin_only', // Cannot manage edit requests
  '/audit-trail': 'admin_only', // Cannot view audit trail
  '/permission-management': 'admin_only', // Cannot manage permissions
};

// Dashboard section permissions - ALLOW referring attorneys access to their own data
export const DASHBOARD_SECTION_PERMISSIONS = {
  // ALLOWED sections for referring attorneys (full access to own law firm data)
  appointment_request: 'referring_attorney', // Can request appointments for their cases
  claimant_management: 'referring_attorney', // Can manage their law firm's claimants
  claimant_reports: 'referring_attorney', // Can view reports for their law firm's claimants
  attorney_reports: 'referring_attorney', // Can view their own reports
  document_upload: 'referring_attorney', // Can upload their own documents
  document_management: 'referring_attorney', // Can manage their own documents
  profile_management: 'referring_attorney', // Can manage their own profile
  assessment_schedule: 'referring_attorney', // Can view their own appointments
  report_tracking: 'referring_attorney', // Can track their own reports
  expert_reports: 'referring_attorney', // Can view reports linked to their cases
  
  // RESTRICTED sections - admin/employee only (system-wide management)
  add_new_attorney: 'admin_only', // Cannot add new attorneys (admin only)
  view_all_attorneys: 'admin_only', // Cannot view all attorneys (admin only)
  attorney_list: 'admin_only', // Cannot access all attorney lists (admin only)
  medical_experts: 'manage_experts', // Cannot manage experts (admin/employee only)
  user_management: 'admin_only', // Cannot manage users (admin only)
  reports_analytics: 'admin_only', // Cannot view system analytics (admin only)
  system_settings: 'admin_only', // Cannot access system settings (admin only)
  permission_management: 'admin_only', // Cannot manage permissions (admin only)
  audit_trail: 'admin_only', // Cannot view audit trail (admin only)
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
