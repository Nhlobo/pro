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
    return permissions.some(p => p.permission_name === permissionName && p.granted);
  };

  // Check if user is admin
  const isAdmin = (): boolean => {
    return userRole === 'admin';
  };

  // Fetch user permissions and role
  const fetchPermissions = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Get user profile and role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile) {
        setUserRole(profile.role);
      }

      // Get user permissions
      const { data: userPermissions } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user.id);

      setPermissions(userPermissions || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
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
        .select('id, email, role, first_name, last_name')
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

  // Resend email confirmation to user (admin only)
  const resendEmailConfirmation = async (email: string): Promise<boolean> => {
    if (!isAdmin()) return false;

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`
        }
      });

      if (error) throw error;
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
    grantPermission,
    revokePermission,
    getAllUsers,
    getUserPermissions,
    updateUserRole,
    resendEmailConfirmation,
    refetch: fetchPermissions
  };
};