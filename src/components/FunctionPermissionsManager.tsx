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
    <div className="space-y-1 max-w-2xl">
      {/* Micro Header */}
      <div className="flex items-center justify-between p-1 bg-muted/10 border rounded text-xs">
        <div className="flex items-center space-x-1.5">
          <div className="flex items-center space-x-1">
            <span className="font-medium">{user.first_name} {user.last_name}</span>
            <Badge className={getUserTypeColor(user.user_type || 'employee')} variant="outline">
              {user.user_type === 'referring_attorney' ? 'Attorney' : 'Staff'}
            </Badge>
          </div>
        </div>
        
        {isAdmin() && (
          <div className="flex items-center space-x-1">
            <Select value={selectedRole} onValueChange={handleRoleChange}>
              <SelectTrigger className="w-[80px] h-5 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="referring_attorney">Attorney</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            
            {hasChanges && (
              <Button onClick={handleSaveChanges} className="h-5 px-1.5 text-xs">
                <Save className="h-2.5 w-2.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Functions List - Only show granted functions */}
      <ScrollArea className="h-[500px] border rounded bg-background">
        <div className="p-0.5 space-y-0.5">
          {allFunctions.filter(func => func.granted).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <XCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No functions allocated</p>
              <p className="text-xs text-muted-foreground">Use the Permission Management page to allocate functions</p>
            </div>
          ) : (
            allFunctions.filter(func => func.granted).map((func) => {
              const functionKey = `${func.category}-${func.functionName}`;
              const grantedSubFunctions = func.predefinedSubFunctions.filter(sub => 
                getSubFunctionStatus(func.category, func.functionName, sub)
              );

              return (
                <div key={functionKey} className="border border-muted/30 rounded bg-card">
                  {/* Main Function Row */}
                  <div className="flex items-center justify-between p-1 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center space-x-1 flex-1 min-w-0">
                      <div className="p-0.5 bg-primary/10 rounded">
                        {getCategoryIcon(func.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1">
                          <h4 className="text-xs font-medium truncate">{func.displayName}</h4>
                          {grantedSubFunctions.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ({grantedSubFunctions.length}/{func.predefinedSubFunctions.length})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{func.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      <Switch
                        checked={func.granted}
                        onCheckedChange={(checked) => 
                          handleMainFunctionToggle(func.category, func.functionName, checked)
                        }
                      />
                    </div>
                  </div>

                  {/* Sub-functions - Only show granted ones */}
                  {grantedSubFunctions.length > 0 && (
                    <div className="bg-muted/5 border-t border-muted/20">
                      <div className="p-0.5 space-y-0.5">
                        {grantedSubFunctions.map((subFunction) => (
                          <div 
                            key={`${functionKey}-${subFunction}`}
                            className="flex items-center justify-between p-0.5 bg-background hover:bg-muted/10 transition-colors rounded text-xs"
                          >
                            <div className="flex items-center space-x-1 flex-1 min-w-0">
                              <div className="w-1 h-1 rounded-full bg-green-500 ml-1"></div>
                              <span className="font-normal truncate text-xs">{subFunction}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Update/Save Button - always visible */}
      <div className="flex justify-end pt-2">
        <Button 
          onClick={handleSaveChanges} 
          size="sm" 
          className="gap-1.5"
          variant={hasChanges ? 'default' : 'outline'}
          disabled={!hasChanges}
        >
          <Save className="h-3.5 w-3.5" />
          {hasChanges ? 'Update Permissions' : 'Permissions Saved'}
        </Button>
      </div>

      {/* Compact Stats */}
      <div className="flex justify-between items-center text-xs bg-muted/10 p-1 rounded border">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>Active: {allFunctions.filter(f => f.granted).length}</span>
          </div>
        </div>
        <span className="text-muted-foreground">Total: {allFunctions.length}</span>
      </div>
    </div>
  );
};

export default FunctionPermissionsManager;