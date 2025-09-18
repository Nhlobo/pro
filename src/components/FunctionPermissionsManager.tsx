import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Settings, Shield, Users, FileText, BarChart, FolderOpen, Calendar, CheckCircle, XCircle, Plus } from 'lucide-react';
import { useFunctionPermissions, GroupedPermissions, PREDEFINED_FUNCTIONS } from '@/hooks/useFunctionPermissions';
import { UserProfile } from '@/hooks/usePermissions';
import { toast } from 'sonner';

interface FunctionPermissionsManagerProps {
  user: UserProfile;
  onPermissionChange?: () => void;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Medical Expert Management':
      return <Users className="h-4 w-4" />;
    case 'Appointment Management':
      return <Calendar className="h-4 w-4" />;
    case 'Report Management':
      return <FileText className="h-4 w-4" />;
    case 'Claimant Management':
      return <Shield className="h-4 w-4" />;
    case 'Document Management':
      return <FolderOpen className="h-4 w-4" />;
    case 'Analytics & Reporting':
      return <BarChart className="h-4 w-4" />;
    default:
      return <Settings className="h-4 w-4" />;
  }
};

// Function name mapping to match the UI requirements
const FUNCTION_DISPLAY_MAP: { [key: string]: string } = {
  'Claimant Management': 'Manage Claimants',
  'Medical Expert Management': 'Manage Experts',
  'Appointment Management': 'Manage Appointments',
  'Analytics & Reporting': 'View Reports',
  'Document Management': 'Manage Documents',
  'Report Management': 'Manage Reports',
  'User Management': 'Manage Users'
};

const FunctionPermissionsManager: React.FC<FunctionPermissionsManagerProps> = ({ user, onPermissionChange }) => {
  const { getUserFunctionPermissions, groupPermissions, updateFunctionPermission, addSubFunction, loading } = useFunctionPermissions();
  const [permissions, setPermissions] = useState<any[]>([]);
  const [groupedPermissions, setGroupedPermissions] = useState<GroupedPermissions>({});

  useEffect(() => {
    fetchPermissions();
  }, [user.id]);

  const fetchPermissions = async () => {
    const userPermissions = await getUserFunctionPermissions(user.id);
    setPermissions(userPermissions);
    setGroupedPermissions(groupPermissions(userPermissions));
  };

  const handleMainFunctionToggle = async (
    functionCategory: string,
    functionName: string,
    granted: boolean
  ) => {
    const success = await updateFunctionPermission(user.id, functionCategory, functionName, null, granted);
    
    if (success) {
      toast.success(`${FUNCTION_DISPLAY_MAP[functionCategory] || functionName} ${granted ? 'enabled' : 'disabled'}`);
      await fetchPermissions();
      onPermissionChange?.();
    } else {
      toast.error(`Failed to ${granted ? 'enable' : 'disable'} ${FUNCTION_DISPLAY_MAP[functionCategory] || functionName}`);
    }
  };

  const handleSubFunctionToggle = async (
    functionCategory: string,
    functionName: string,
    subFunction: string,
    granted: boolean
  ) => {
    // First ensure the sub-function exists in the database
    const currentSubFunctions = groupedPermissions[functionCategory]?.[functionName]?.subFunctions || {};
    
    if (!currentSubFunctions.hasOwnProperty(subFunction)) {
      // Add the sub-function first
      const addSuccess = await addSubFunction(user.id, functionCategory, functionName, subFunction, user.user_type || 'employee');
      if (!addSuccess) {
        toast.error(`Failed to create ${subFunction}`);
        return;
      }
      // Refresh permissions after adding
      await fetchPermissions();
    }

    const success = await updateFunctionPermission(user.id, functionCategory, functionName, subFunction, granted);
    
    if (success) {
      toast.success(`${subFunction} ${granted ? 'enabled' : 'disabled'}`);
      await fetchPermissions();
      onPermissionChange?.();
    } else {
      toast.error(`Failed to ${granted ? 'enable' : 'disable'} ${subFunction}`);
    }
  };

  // Get the permission status for a sub-function
  const getSubFunctionStatus = (category: string, functionName: string, subFunction: string): boolean => {
    return groupedPermissions[category]?.[functionName]?.subFunctions?.[subFunction] || false;
  };

  const getUserTypeColor = (userType: string) => {
    switch (userType) {
      case 'referring_attorney':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'employee':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Get all functions with their predefined sub-functions
  const getAllFunctions = () => {
    const functions: Array<{
      category: string;
      functionName: string;
      displayName: string;
      description: string;
      granted: boolean;
      predefinedSubFunctions: string[];
    }> = [];

    Object.entries(PREDEFINED_FUNCTIONS).forEach(([category, categoryFunctions]) => {
      Object.entries(categoryFunctions).forEach(([functionName, functionData]) => {
        const currentPermissions = groupedPermissions[category]?.[functionName];
        
        functions.push({
          category,
          functionName,
          displayName: FUNCTION_DISPLAY_MAP[category] || functionName,
          description: functionData.description,
          granted: currentPermissions?.granted || false,
          predefinedSubFunctions: functionData.subFunctions
        });
      });
    });

    return functions;
  };

  const allFunctions = getAllFunctions();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Function Permissions</h3>
          <p className="text-sm text-muted-foreground">
            Grant or revoke function permissions for {user.first_name} {user.last_name}
          </p>
        </div>
        <Badge className={getUserTypeColor(user.user_type || 'employee')}>
          {user.user_type === 'referring_attorney' ? 'Referring Attorney' : 'Internal Staff'}
        </Badge>
      </div>

      {/* Legacy Permissions Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-1">Legacy Permissions</h3>
        <p className="text-sm text-muted-foreground">
          Grant or revoke legacy permissions (Note: Admins have all permissions by default)
        </p>
      </div>

      {/* All Functions and Sub-functions List */}
      <div className="space-y-1">
        {allFunctions.map((func) => {
          const functionKey = `${func.category}-${func.functionName}`;

          return (
            <div key={functionKey} className="space-y-1">
              {/* Main Function Row */}
              <div className="flex items-center justify-between p-4 bg-background border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex-1">
                  <h4 className="text-base font-medium">{func.displayName}</h4>
                  <p className="text-sm text-muted-foreground">{func.description}</p>
                </div>
                <Switch
                  checked={func.granted}
                  onCheckedChange={(checked) => 
                    handleMainFunctionToggle(func.category, func.functionName, checked)
                  }
                />
              </div>

              {/* Sub-functions */}
              {func.predefinedSubFunctions.map((subFunction) => {
                const isGranted = getSubFunctionStatus(func.category, func.functionName, subFunction);
                
                return (
                  <div 
                    key={`${functionKey}-${subFunction}`}
                    className="flex items-center justify-between p-3 ml-6 bg-muted/30 border border-muted rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <span className="text-sm font-medium">{subFunction}</span>
                    </div>
                    <Switch
                      checked={isGranted}
                      onCheckedChange={(checked) => 
                        handleSubFunctionToggle(func.category, func.functionName, subFunction, checked)
                      }
                      disabled={!func.granted}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FunctionPermissionsManager;