import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

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
}

export const usePermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user has a specific permission
  const hasPermission = (permissionName: string): boolean => {
    if (userRole === 'admin') return true;
    if (userRole === 'referring_attorney' && permissionName === 'referring_attorney') return true;
    // Employees have access to certain permissions based on their role
    if (userRole === 'employee') {
      const employeePermissions = ['view_reports', 'manage_appointments', 'manage_claimants', 'manage_experts'];
      return employeePermissions.includes(permissionName);
    }
    return permissions.some(p => p.permission_name === permissionName && p.granted);
  };

  // Check if user is admin
  const isAdmin = (): boolean => {
    // Primary administrator always has admin access
    if (user?.email === 'boshomane@kutlwanoassociate.com') {
      return true;
    }
    return userRole === 'admin';
  };

  // Check if user is referring attorney
  const isReferringAttorney = (): boolean => {
    return userRole === 'referring_attorney';
  };

  // Fetch user permissions and role
  const fetchPermissions = async () => {
    if (!user) {
      setUserRole(null);
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      // Verify session is still valid
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.log('Session invalid, clearing auth state');
        setUserRole(null);
        setPermissions([]);
        setLoading(false);
        return;
      }

      // Get user profile and role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, user_type, email')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        // For boshomane@kutlwanoassociate.com, set admin role as fallback
        if (user.email === 'boshomane@kutlwanoassociate.com') {
          console.log('Setting admin role for primary administrator');
          setUserRole('admin');
        } else {
          setUserRole(null);
        }
      } else if (profile) {
        console.log('Profile loaded:', profile);
        setUserRole(profile.role);
        
        // Double-check for primary admin
        if (user.email === 'boshomane@kutlwanoassociate.com' && profile.role !== 'admin') {
          console.log('Correcting role for primary administrator');
          setUserRole('admin');
        }
      }

      // Get user permissions
      const { data: userPermissions } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user.id);

      setPermissions(userPermissions || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      // For boshomane@kutlwanoassociate.com, set admin role as fallback
      if (user.email === 'boshomane@kutlwanoassociate.com') {
        console.log('Setting admin role for primary administrator (fallback)');
        setUserRole('admin');
      } else {
        setUserRole(null);
      }
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
        .select('id, email, role, user_type, position, first_name, last_name')
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

  // Update user role (admin only)
  const updateUserRole = async (userId: string, newRole: string): Promise<boolean> => {
    if (!isAdmin()) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating user role:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [user]);

  // Force refresh authentication state
  const refreshAuth = async () => {
    setLoading(true);
    try {
      // Force refresh the session
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Session refresh error:', error);
        // Force logout and redirect to login
        await supabase.auth.signOut();
        window.location.href = '/auth';
        return;
      }
      
      // Wait a moment for the session to update
      setTimeout(() => {
        fetchPermissions();
      }, 500);
    } catch (error) {
      console.error('Error refreshing auth:', error);
      setLoading(false);
    }
  };

  // Resend email confirmation to user (admin only) via Edge Function (uses service role)
  const resendEmailConfirmation = async (email: string): Promise<boolean> => {
    if (!isAdmin()) return false;

    try {
      const { data, error } = await supabase.functions.invoke('resend-user-confirmation', {
        body: { email },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return true;
    } catch (error) {
      console.error('Error resending email confirmation:', error);
      return false;
    }
  };

  return {
    permissions,
    userRole,
    loading,
    hasPermission,
    isAdmin,
    isReferringAttorney,
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