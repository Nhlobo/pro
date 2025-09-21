import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Settings, Shield, Users, FileText, BarChart, FolderOpen, Calendar, CheckCircle, XCircle, Plus, Save } from 'lucide-react';
import { useFunctionPermissions, GroupedPermissions, PREDEFINED_FUNCTIONS } from '@/hooks/useFunctionPermissions';
import { UserProfile, usePermissions } from '@/hooks/usePermissions';
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
  const { updateUserRole, isAdmin } = usePermissions();
  const [permissions, setPermissions] = useState<any[]>([]);
  const [groupedPermissions, setGroupedPermissions] = useState<GroupedPermissions>({});
  const [selectedRole, setSelectedRole] = useState<string>(user.role || 'user');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchPermissions();
    setSelectedRole(user.role || 'user');
  }, [user.id, user.role]);

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
      setHasChanges(true);
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
      setHasChanges(true);
      onPermissionChange?.();
    } else {
      toast.error(`Failed to ${granted ? 'enable' : 'disable'} ${subFunction}`);
    }
  };

  const handleRoleChange = (newRole: string) => {
    setSelectedRole(newRole);
    setHasChanges(user.role !== newRole);
  };

  const handleSaveChanges = async () => {
    if (!isAdmin()) {
      toast.error('Only administrators can change user roles');
      return;
    }

    if (selectedRole !== user.role) {
      const success = await updateUserRole(user.id, selectedRole);
      if (success) {
        toast.success('User role updated successfully');
        setHasChanges(false);
        onPermissionChange?.();
      } else {
        toast.error('Failed to update user role');
      }
    } else {
      setHasChanges(false);
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
    <div className="space-y-2">
      {/* Compact Header with Role Selection */}
      <div className="flex items-center justify-between p-2 bg-muted/30 border rounded-md">
        <div className="flex items-center space-x-3">
          <div>
            <h3 className="text-xs font-semibold">{user.first_name} {user.last_name}</h3>
            <p className="text-xs text-muted-foreground truncate max-w-32">{user.email}</p>
          </div>
          <Badge className={getUserTypeColor(user.user_type || 'employee')} variant="outline">
            {user.user_type === 'referring_attorney' ? 'Attorney' : 'Staff'}
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          {isAdmin() && (
            <>
              <Select value={selectedRole} onValueChange={handleRoleChange}>
                <SelectTrigger className="w-[100px] h-7">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="referring_attorney">Attorney</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              
              {hasChanges && (
                <Button size="sm" onClick={handleSaveChanges} className="h-7 px-2 text-xs">
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Compact Functions Grid */}
      <div className="max-h-[300px] overflow-y-auto border rounded-md">
        <div className="p-2 space-y-1">
          {allFunctions.map((func) => {
            const functionKey = `${func.category}-${func.functionName}`;

            return (
              <div key={functionKey} className="space-y-1">
                {/* Main Function Row - Condensed */}
                <div className="flex items-center justify-between p-2 bg-background hover:bg-muted/30 transition-colors rounded border border-muted/50">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    {getCategoryIcon(func.category)}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-medium truncate">{func.displayName}</h4>
                    </div>
                  </div>
                  <Switch
                    checked={func.granted}
                    onCheckedChange={(checked) => 
                      handleMainFunctionToggle(func.category, func.functionName, checked)
                    }
                  />
                </div>

                {/* Sub-functions - Compact Grid Layout */}
                {func.predefinedSubFunctions.length > 0 && (
                  <div className="ml-6 grid grid-cols-2 gap-1">
                    {func.predefinedSubFunctions.map((subFunction) => {
                      const isGranted = getSubFunctionStatus(func.category, func.functionName, subFunction);
                      
                      return (
                        <div 
                          key={`${functionKey}-${subFunction}`}
                          className="flex items-center justify-between p-1.5 bg-muted/20 hover:bg-muted/40 transition-colors rounded border border-muted/30"
                        >
                          <span className="text-xs font-medium truncate flex-1 pr-2">{subFunction}</span>
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
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span>Total Functions: {allFunctions.length}</span>
        <span>Active: {allFunctions.filter(f => f.granted).length}</span>
      </div>
    </div>
  );
};

export default FunctionPermissionsManager;