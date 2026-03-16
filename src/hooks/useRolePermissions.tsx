import { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useFunctionPermissions, GroupedPermissions } from '@/hooks/useFunctionPermissions';
import { supabase } from '@/integrations/supabase/client';

interface RolePermissionCheck {
  canAccess: boolean;
  reason?: string;
}

export const useRolePermissions = () => {
  const { isAdmin, isReferringAttorney, userRole, loading: permissionsLoading } = usePermissions();
  const { getUserFunctionPermissions, groupPermissions } = useFunctionPermissions();
  
  const [userPermissions, setUserPermissions] = useState<GroupedPermissions>({});
  const [functionPermissionsLoading, setFunctionPermissionsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Combined loading: both role and function permissions must be loaded
  const loading = permissionsLoading || functionPermissionsLoading;

  useEffect(() => {
    // Get the current user ID from supabase auth
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchUserPermissions();
    }
  }, [currentUserId]);

  const fetchUserPermissions = async () => {
    if (!currentUserId) return;
    
    setLoading(true);
    try {
      const permissions = await getUserFunctionPermissions(currentUserId);
      const grouped = groupPermissions(permissions);
      setUserPermissions(grouped);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if user has permission for a specific function
  const checkFunctionPermission = (
    category: string, 
    functionName: string, 
    subFunction?: string
  ): RolePermissionCheck => {
    // Admins always have access
    if (isAdmin()) {
      return { canAccess: true };
    }

    // Check if user has the main function permission
    const functionPermission = userPermissions[category]?.[functionName];
    
    if (!functionPermission?.granted) {
      return { 
        canAccess: false, 
        reason: `Access denied: You don't have permission for ${functionName}` 
      };
    }

    // If checking for sub-function, verify it's granted
    if (subFunction) {
      const subFunctionGranted = functionPermission.subFunctions?.[subFunction];
      if (!subFunctionGranted) {
        return { 
          canAccess: false, 
          reason: `Access denied: You don't have permission for ${subFunction}` 
        };
      }
    }

    return { canAccess: true };
  };

  // Specific permission checkers for common operations
  const canManageClaimants = (operation?: 'add' | 'view' | 'edit' | 'delete' | 'reports'): RolePermissionCheck => {
    const operationMap = {
      add: 'Add New Claimant',
      view: 'View All Claimants', 
      edit: 'Edit Claimant Details',
      delete: 'Delete Claimant',
      reports: 'Claimant Reports'
    };

    if (operation && operationMap[operation]) {
      return checkFunctionPermission('Claimant Management', 'Manage Claimants', operationMap[operation]);
    }
    
    return checkFunctionPermission('Claimant Management', 'Manage Claimants');
  };

  const canManageExperts = (operation?: 'add' | 'view' | 'edit' | 'reports'): RolePermissionCheck => {
    const operationMap = {
      add: 'Add New Expert',
      view: 'View All Experts',
      edit: 'Edit Expert Details', 
      reports: 'Expert Reports'
    };

    if (operation && operationMap[operation]) {
      return checkFunctionPermission('Medical Expert Management', 'Manage Medical Experts', operationMap[operation]);
    }
    
    return checkFunctionPermission('Medical Expert Management', 'Manage Medical Experts');
  };

  const canManageAppointments = (operation?: 'create' | 'view' | 'edit' | 'cancel' | 'reports'): RolePermissionCheck => {
    const operationMap = {
      create: 'Create New Appointment',
      view: 'View All Appointments',
      edit: 'Edit Appointments',
      cancel: 'Cancel Appointments',
      reports: 'Appointment Reports'
    };

    if (operation && operationMap[operation]) {
      return checkFunctionPermission('Appointment Management', 'Manage Appointments', operationMap[operation]);
    }
    
    return checkFunctionPermission('Appointment Management', 'Manage Appointments');
  };

  const canAccessReports = (operation?: 'view' | 'track' | 'analytics' | 'export'): RolePermissionCheck => {
    const operationMap = {
      view: 'View Report Status',
      track: 'Track Report Progress',
      analytics: 'Report Analytics',
      export: 'Export Reports'
    };

    if (operation && operationMap[operation]) {
      return checkFunctionPermission('Report Management', 'Expert Reports', operationMap[operation]);
    }
    
    return checkFunctionPermission('Report Management', 'Expert Reports');
  };

  const canManageDocuments = (operation?: 'upload' | 'view' | 'delete'): RolePermissionCheck => {
    const operationMap = {
      upload: 'Upload Documents',
      view: 'View Documents',
      delete: 'Delete Documents'
    };

    if (operation && operationMap[operation]) {
      return checkFunctionPermission('Document Management', 'Document Handling', operationMap[operation]);
    }
    
    return checkFunctionPermission('Document Management', 'Document Handling');
  };

  const canAccessAnalytics = (operation?: 'dashboard' | 'leads' | 'performance'): RolePermissionCheck => {
    const operationMap = {
      dashboard: 'View CRM Dashboard',
      leads: 'Lead Management',
      performance: 'Performance Metrics'
    };

    if (operation && operationMap[operation]) {
      return checkFunctionPermission('Analytics & Reporting', 'CRM Analytics', operationMap[operation]);
    }
    
    return checkFunctionPermission('Analytics & Reporting', 'CRM Analytics');
  };

  const canManageUsers = (operation?: 'add' | 'edit' | 'permissions'): RolePermissionCheck => {
    const operationMap = {
      add: 'Add New Users',
      edit: 'Edit User Details',
      permissions: 'Manage Permissions'
    };

    if (operation && operationMap[operation]) {
      return checkFunctionPermission('User Management', 'Manage Users', operationMap[operation]);
    }
    
    return checkFunctionPermission('User Management', 'Manage Users');
  };

  // Get accessible menu items based on permissions
  const getAccessibleMenuItems = () => {
    const menuItems = [];

    // Claimant Management
    if (canManageClaimants().canAccess) {
      menuItems.push({
        title: 'Claimant Management',
        items: [
          canManageClaimants('add').canAccess && { name: 'Add Claimant', path: '/claimant-form' },
          canManageClaimants('view').canAccess && { name: 'View Claimants', path: '/claimant-list' },
          canManageClaimants('reports').canAccess && { name: 'Claimant Reports', path: '/claimant-reports' },
        ].filter(Boolean)
      });
    }

    // Appointment Management  
    if (canManageAppointments().canAccess) {
      menuItems.push({
        title: 'Appointments',
        items: [
          canManageAppointments('create').canAccess && { name: 'New Appointment', path: '/new-appointment' },
          canManageAppointments('view').canAccess && { name: 'View Appointments', path: '/appointment-schedule' },
          { name: 'Request Appointment', path: '/appointment-request' }, // Always allow for referring attorneys
        ].filter(Boolean)
      });
    }

    // Document Management
    if (canManageDocuments().canAccess) {
      menuItems.push({
        title: 'Documents',
        items: [
          canManageDocuments('upload').canAccess && { name: 'Upload Documents', path: '/document-uploading' },
          canManageDocuments('view').canAccess && { name: 'View Documents', path: '/documents' },
        ].filter(Boolean)
      });
    }

    // Reports
    if (canAccessReports().canAccess) {
      menuItems.push({
        title: 'Reports',
        items: [
          canAccessReports('view').canAccess && { name: 'Expert Reports', path: '/expert-reports' },
          canAccessReports('track').canAccess && { name: 'Report Tracking', path: '/report-tracking' },
        ].filter(Boolean)
      });
    }

    return menuItems;
  };

  // Get permission summary for display
  const getPermissionSummary = () => {
    const summary = {
      claimants: canManageClaimants().canAccess,
      experts: canManageExperts().canAccess,
      appointments: canManageAppointments().canAccess,
      reports: canAccessReports().canAccess,
      documents: canManageDocuments().canAccess,
      analytics: canAccessAnalytics().canAccess,
      users: canManageUsers().canAccess,
    };

    const totalPermissions = Object.keys(summary).length;
    const grantedPermissions = Object.values(summary).filter(Boolean).length;

    return {
      ...summary,
      totalPermissions,
      grantedPermissions,
      percentage: Math.round((grantedPermissions / totalPermissions) * 100)
    };
  };

  return {
    loading,
    checkFunctionPermission,
    canManageClaimants,
    canManageExperts,
    canManageAppointments,
    canAccessReports,
    canManageDocuments,
    canAccessAnalytics,
    canManageUsers,
    getAccessibleMenuItems,
    getPermissionSummary,
    refreshPermissions: fetchUserPermissions
  };
};