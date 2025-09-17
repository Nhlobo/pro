import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FunctionPermission {
  id: string;
  user_id: string;
  function_category: string;
  function_name: string;
  sub_function: string | null;
  granted: boolean;
  user_type: string;
  granted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupedPermissions {
  [category: string]: {
    [functionName: string]: {
      granted: boolean;
      subFunctions: {
        [subFunction: string]: boolean;
      };
    };
  };
}

export const useFunctionPermissions = () => {
  const [loading, setLoading] = useState(false);

  // Get user function permissions
  const getUserFunctionPermissions = async (userId: string): Promise<any[]> => {
    try {
      const { data, error } = await supabase.rpc('get_user_function_permissions', {
        target_user_id: userId
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user function permissions:', error);
      return [];
    }
  };

  // Group permissions by category and function
  const groupPermissions = (permissions: any[]): GroupedPermissions => {
    const grouped: GroupedPermissions = {};

    permissions.forEach(permission => {
      if (!grouped[permission.function_category]) {
        grouped[permission.function_category] = {};
      }

      if (!grouped[permission.function_category][permission.function_name]) {
        grouped[permission.function_category][permission.function_name] = {
          granted: false,
          subFunctions: {}
        };
      }

      if (permission.sub_function) {
        // This is a sub-function
        grouped[permission.function_category][permission.function_name].subFunctions[permission.sub_function] = permission.granted;
      } else {
        // This is a main function
        grouped[permission.function_category][permission.function_name].granted = permission.granted;
      }
    });

    return grouped;
  };

  // Update function permission
  const updateFunctionPermission = async (
    userId: string,
    functionCategory: string,
    functionName: string,
    subFunction: string | null,
    granted: boolean
  ): Promise<boolean> => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('function_permissions')
        .update({
          granted,
          granted_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('function_category', functionCategory)
        .eq('function_name', functionName)
        .eq('sub_function', subFunction);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating function permission:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Initialize function permissions for new user
  const initializeFunctionPermissions = async (userId: string, userType: string): Promise<boolean> => {
    try {
      setLoading(true);

      const { error } = await supabase.functions.invoke('initialize-user-permissions', {
        body: {
          userId,
          userType
        }
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error initializing function permissions:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    getUserFunctionPermissions,
    groupPermissions,
    updateFunctionPermission,
    initializeFunctionPermissions
  };
};