import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Permission {
  id: string;
  permission_name: string;
  granted: boolean;
  granted_by?: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string | null;
  role: string | null;
  user_type: string | null;
  position: string | null;
  first_name: string | null;
  last_name: string | null;
  referring_attorney_id: string | null;
}

export interface PermissionsContextValue {
  permissions: Permission[];
  userRole: string | null;
  loading: boolean;
  roleResolutionFailed: boolean;
  hasPermission: (permissionName: string) => boolean;
  canAccessData: (dataType: 'attorney' | 'claimant' | 'appointment' | 'document', ownerId?: string) => boolean;
  getAccessDenialMessage: (context?: string) => string;
  isAdmin: () => boolean;
  isReferringAttorney: () => boolean;
  isEmployee: () => boolean;
  isSalesConsultant: () => boolean;
  isMedicalExpert: () => boolean;
  grantPermission: (userId: string, permissionName: string) => Promise<boolean>;
  revokePermission: (userId: string, permissionName: string) => Promise<boolean>;
  getAllUsers: () => Promise<UserProfile[]>;
  getUserPermissions: (userId: string) => Promise<Permission[]>;
  updateUserRole: (userId: string, newRole: string) => Promise<boolean>;
  resendEmailConfirmation: (email: string) => Promise<{ success: boolean; message?: string }>;
  refetch: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined);

/**
 * Fetches the current user's role + permissions ONCE per session and shares
 * the result app-wide via context.
 *
 * Previously `usePermissions` did this fetch independently in every
 * component that called it (ProtectedRoute, PermissionProtectedRoute, page
 * components, etc). Since those components are often nested on the same
 * route (e.g. ProtectedRoute > PermissionProtectedRoute > Page), that meant
 * 2-3 redundant round-trips to Supabase back-to-back on every navigation,
 * each rendering its own full-screen loading spinner — i.e. the "spinner
 * after the loading spinner" effect. Centralizing the fetch here fixes that
 * everywhere at once, with no change needed to any of the ~40 call sites:
 * they all still just call `usePermissions()` and get the same shape back.
 */
export const PermissionsProvider = ({ children }: { children: ReactNode }) => {
  const value = usePermissionsState();
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
};

export const usePermissions = (): PermissionsContextValue => {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    throw new Error('usePermissions must be used within a <PermissionsProvider>');
  }
  return ctx;
};

// Internal: the original hook logic, now used exactly once by PermissionsProvider.
const usePermissionsState = (): PermissionsContextValue => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // True only when an authenticated, provisioned user comes back with no
  // resolvable role after retries — a data/config problem to surface
  // explicitly, not a normal "regular user" state.
  const [roleResolutionFailed, setRoleResolutionFailed] = useState(false);

  // Check if user has a specific permission
  const hasPermission = (permissionName: string): boolean => {
    if (!user) return false;
    
    // Admins have all permissions (verified via secure user_roles table)
    if (userRole === 'admin') return true;
    
    // Company Employees have full system access equal to Administrator
    if (userRole === 'employee') return true;
    
    // Sales Consultants have limited permissions - Claimants, Attorneys, Pitchlog, Heatmap,
    // plus read/write access to Appointment Engine and Finance & Payments (no delete capability).
    if (userRole === 'sales_consultant') {
      const salesConsultantPermissions = [
        'manage_claimants',
        'manage_attorneys',
        'attorney_pitchlog',
        'view_dashboard_own',
        'view_availability_heatmap',
        'view_admin_appointments',
        'view_admin_finance',
      ];
      return salesConsultantPermissions.includes(permissionName);
    }
    
    // Medical experts have limited permissions to their own data
    if (userRole === 'medical_expert') {
      const expertPermissions = [
        'view_cases_own',
        'view_reports_own',
        'view_schedule_own',
        'manage_profile_own',
        'manage_availability_own',
        'view_performance_own',
        'view_documents_own',
      ];
      return expertPermissions.includes(permissionName);
    }

    // Referring attorneys have limited permissions
    if (userRole === 'referring_attorney') {
      const referringAttorneyPermissions = [
        'referring_attorney',
        'view_reports_own',
        'manage_appointments_own',
        'view_claimants_own',
        'view_dashboard_own',
        'manage_documents_own',
        'view_profile_own'
      ];
      return referringAttorneyPermissions.includes(permissionName);
    }
    
    return permissions.some(p => p.permission_name === permissionName && p.granted);
  };

  // Check if referring attorney can access specific data
  const canAccessData = (dataType: 'attorney' | 'claimant' | 'appointment' | 'document', ownerId?: string): boolean => {
    if (userRole === 'admin') return true;
    if (userRole === 'referring_attorney') {
      return ownerId === user?.id || !ownerId;
    }
    return true;
  };

  // Get access denial message for referring attorneys
  const getAccessDenialMessage = (context: string = 'general'): string => {
    const messages: Record<string, string> = {
      general: "Access Denied – You can only view your own information.",
      attorney_data: "Access Denied – You cannot view other attorneys' information.",
      user_management: "Access Denied – User management is restricted to administrators only.",
      system_features: "Access Denied – This feature requires administrator privileges.",
      reports: "Access Denied – You can only view reports related to your cases.",
      appointments: "Access Denied – You can only manage your own appointments.",
      documents: "Access Denied – You can only access documents you have uploaded."
    };
    return messages[context] || messages.general;
  };

  // Check if user is admin or employee (both have full system access)
  const isAdmin = (): boolean => {
    if (!user) return false;
    return userRole === 'admin' || userRole === 'employee';
  };

  // Check if user is referring attorney
  const isReferringAttorney = (): boolean => {
    return userRole === 'referring_attorney';
  };

  // Check if user is employee
  const isEmployee = (): boolean => {
    return userRole === 'employee';
  };

  // Check if user is sales consultant
  const isSalesConsultant = (): boolean => {
    return userRole === 'sales_consultant';
  };

  // Check if user is medical expert
  const isMedicalExpert = (): boolean => {
    return userRole === 'medical_expert';
  };

  // Every user in this system is provisioned by an administrator (a row in
  // `user_roles` is created at that time), so an authenticated session that
  // comes back with NO role should never happen in normal operation. If it
  // does, it's almost always a timing race right after login/token refresh
  // (the RPC firing a beat before the new session/role row is visible), not
  // a real "roleless" account. Retry briefly before treating it as a genuine
  // problem, so we don't drop a properly-provisioned user into the
  // unclassified fallback dashboard just because of a momentary hiccup.
  const ROLE_FETCH_RETRIES = 3;
  const ROLE_FETCH_RETRY_DELAY_MS = 400;

  const fetchRoleWithRetry = async (): Promise<{ role: string | null; failed: boolean }> => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= ROLE_FETCH_RETRIES; attempt++) {
      const { data: roleData, error: roleError } = await supabase.rpc('get_current_user_role');

      if (!roleError && roleData) {
        return { role: roleData as string, failed: false };
      }
      lastError = roleError;

      if (attempt < ROLE_FETCH_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, ROLE_FETCH_RETRY_DELAY_MS));
      }
    }

    console.error(
      'get_current_user_role returned no role after retries — this should not happen for a provisioned account:',
      lastError
    );
    return { role: null, failed: true };
  };

  // Fetch user permissions and role
  const fetchPermissions = async () => {
    if (!user) {
      setUserRole(null);
      setPermissions([]);
      setRoleResolutionFailed(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { role, failed } = await fetchRoleWithRetry();
      setUserRole(role || 'user');
      setRoleResolutionFailed(failed);

      // Get user permissions
      const { data: userPermissions } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user.id);

      setPermissions(userPermissions || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setUserRole('user');
      setRoleResolutionFailed(true);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  // Grant permission to a user (admin only)
  const grantPermission = async (userId: string, permissionName: string): Promise<boolean> => {
    if (!isAdmin()) return false;

    try {
      const { error } = await supabase
        .from('user_permissions')
        .upsert({
          user_id: userId,
          permission_name: permissionName,
          granted: true,
          granted_by: user?.id
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error granting permission:', error);
      return false;
    }
  };

  // Revoke permission from a user (admin only)
  const revokePermission = async (userId: string, permissionName: string): Promise<boolean> => {
    if (!isAdmin()) return false;

    try {
      const { error } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('permission_name', permissionName);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error revoking permission:', error);
      return false;
    }
  };

  // Get all users with their roles (admin only)
  const getAllUsers = async (): Promise<UserProfile[]> => {
    if (!isAdmin()) return [];

    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, role, user_type, position, first_name, last_name, referring_attorney_id')
        .order('created_at', { ascending: false });

      return data || [];
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  };

  // Get user permissions (admin only)
  const getUserPermissions = async (userId: string): Promise<Permission[]> => {
    if (!isAdmin()) return [];

    try {
      const { data } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId);

      return data || [];
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      return [];
    }
  };

  // Update user role (admin only) - Now uses user_roles table
  const updateUserRole = async (userId: string, newRole: string): Promise<boolean> => {
    if (!isAdmin()) {
      toast({
        title: "Access Denied",
        description: "Only administrators can update user roles.",
        variant: "destructive"
      });
      return false;
    }

    try {
      // First, remove all existing roles for this user
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Then add the new role
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert([{ 
          user_id: userId, 
          role: newRole as 'admin' | 'employee' | 'referring_attorney' | 'user' | 'sales_consultant' | 'medical_expert' | 'finance' | 'director',
          granted_by: user?.id 
        }]);

      if (insertError) throw insertError;

      // Keep profiles.role in sync so UI badges and isAdmin() reflect the change
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);
      if (profileError) console.warn('Profile role sync failed:', profileError);

      toast({
        title: "Success",
        description: "User role updated successfully.",
      });
      return true;
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  useEffect(() => {
    fetchPermissions();
    // Only re-fetch when the user identity actually changes, not on every
    // token refresh / tab focus event (which produces a new user object ref).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Force refresh authentication state
  const refreshAuth = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Session refresh error:', error);
        await supabase.auth.signOut();
        window.location.href = '/auth';
        return;
      }
      
      setTimeout(() => {
        fetchPermissions();
      }, 500);
    } catch (error) {
      console.error('Error refreshing auth:', error);
      setLoading(false);
    }
  };

  // Resend email confirmation to user (admin only)
  const resendEmailConfirmation = async (email: string): Promise<{ success: boolean; message?: string }> => {
    if (!isAdmin()) return { success: false, message: "Admin access required" };

    try {
      const { data, error } = await supabase.functions.invoke('resend-user-confirmation', {
        body: { email }
      });
      
      if (error) throw error;
      
      if ((data as any)?.error) {
        const errorResponse = data as any;
        
        if (errorResponse.error?.includes('SMTP') || errorResponse.error?.includes('email system')) {
          return { 
            success: false, 
            message: `${errorResponse.error}. ${errorResponse.suggestion || 'Please configure SMTP settings in Supabase.'}` 
          };
        }
        
        if (errorResponse.userStatus === 'confirmed') {
          return { 
            success: true, 
            message: errorResponse.message || 'User is already confirmed' 
          };
        }
        
        throw new Error(errorResponse.error);
      }
      
      return { success: true, message: (data as any)?.message || 'Email sent successfully' };
    } catch (error) {
      console.error('Error resending email confirmation:', error);
      return { 
        success: false, 
        message: `Failed to send email: ${(error as Error).message}` 
      };
    }
  };

  return {
    permissions,
    userRole,
    loading,
    roleResolutionFailed,
    hasPermission,
    isAdmin,
    isEmployee,
    isReferringAttorney,
    isSalesConsultant,
    isMedicalExpert,
    canAccessData,
    getAccessDenialMessage,
    grantPermission,
    revokePermission,
    getAllUsers,
    getUserPermissions,
    updateUserRole,
    resendEmailConfirmation,
    refetch: fetchPermissions,
    refreshAuth
  };
};
