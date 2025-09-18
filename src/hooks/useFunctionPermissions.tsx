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

// Predefined function categories and their sub-functions
export const PREDEFINED_FUNCTIONS: {
  [category: string]: {
    [functionName: string]: {
      description: string;
      subFunctions: string[];
    };
  };
} = {
  'Claimant Management': {
    'Manage Claimants': {
      description: 'Handle all claimant-related operations',
      subFunctions: ['Add New Claimant', 'View All Claimants', 'Edit Claimant Details', 'Delete Claimant', 'Claimant Reports', 'Export Claimant Data']
    }
  },
  'Medical Expert Management': {
    'Manage Medical Experts': {
      description: 'Handle medical expert operations',
      subFunctions: ['Add New Expert', 'View All Experts', 'Edit Expert Details', 'View Expert Performance', 'Expert Directory Access', 'Expert Reports']
    }
  },
  'Appointment Management': {
    'Manage Appointments': {
      description: 'Handle appointment scheduling and management',
      subFunctions: ['Create New Appointment', 'View All Appointments', 'Edit Appointments', 'Cancel Appointments', 'Appointment Reports', 'Schedule Management']
    },
    'Appointment Requests': {
      description: 'Handle appointment request processing',
      subFunctions: ['View Appointment Requests', 'Process Requests', 'Approve Requests', 'Reject Requests', 'Request Analytics']
    }
  },
  'Report Management': {
    'Expert Reports': {
      description: 'Manage expert report tracking and analysis',
      subFunctions: ['View Report Status', 'Track Report Progress', 'Expert Performance Analysis', 'Report Analytics', 'Export Reports']
    },
    'Assessment Reports': {
      description: 'Handle assessment report statistics and archiving',
      subFunctions: ['View Assessment Statistics', 'Generate Reports', 'Archive Data', 'Export Statistics']
    }
  },
  'Document Management': {
    'Document Handling': {
      description: 'Manage document uploads and storage',
      subFunctions: ['Upload Documents', 'View Documents', 'Delete Documents', 'Document Categories', 'Bulk Operations']
    }
  },
  'Analytics & Reporting': {
    'CRM Analytics': {
      description: 'Access CRM dashboard and analytics',
      subFunctions: ['View CRM Dashboard', 'Lead Management', 'Attorney Analytics', 'Performance Metrics', 'Export Data']
    },
    'System Reports': {
      description: 'Generate and view system-wide reports',
      subFunctions: ['Generate Reports', 'View Statistics', 'Export Data', 'Custom Reports']
    }
  },
  'User Management': {
    'Manage Users': {
      description: 'Handle user accounts and permissions',
      subFunctions: ['Add New Users', 'Edit User Details', 'Manage Permissions', 'Deactivate Users', 'View User Activity']
    }
  }
};

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

  // Add a new sub-function for a user
  const addSubFunction = async (
    userId: string,
    functionCategory: string,
    functionName: string,
    subFunction: string,
    userType: string
  ): Promise<boolean> => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('function_permissions')
        .insert({
          user_id: userId,
          function_category: functionCategory,
          function_name: functionName,
          sub_function: subFunction,
          granted: false, // Default to false, user can grant it afterwards
          user_type: userType,
          granted_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error adding sub-function:', error);
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
    addSubFunction,
    initializeFunctionPermissions
  };
};