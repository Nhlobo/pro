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
  const [selectedSubFunctions, setSelectedSubFunctions] = useState<{[key: string]: string}>({});

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

  const handleAddSubFunction = async (
    functionCategory: string,
    functionName: string,
    subFunction: string
  ) => {
    const success = await addSubFunction(user.id, functionCategory, functionName, subFunction, user.user_type || 'employee');
    
    if (success) {
      toast.success(`"${subFunction}" added successfully`);
      await fetchPermissions();
      onPermissionChange?.();
      // Clear the selection
      const key = `${functionCategory}-${functionName}`;
      setSelectedSubFunctions(prev => ({
        ...prev,
        [key]: ''
      }));
    } else {
      toast.error(`Failed to add "${subFunction}"`);
    }
  };

  const handleSubFunctionToggle = async (
    functionCategory: string,
    functionName: string,
    subFunction: string,
    granted: boolean
  ) => {
    const success = await updateFunctionPermission(user.id, functionCategory, functionName, subFunction, granted);
    
    if (success) {
      toast.success(`${subFunction} ${granted ? 'enabled' : 'disabled'}`);
      await fetchPermissions();
      onPermissionChange?.();
    } else {
      toast.error(`Failed to ${granted ? 'enable' : 'disable'} ${subFunction}`);
    }
  };

  const getAvailableSubFunctions = (category: string, functionName: string) => {
    const predefinedFunction = PREDEFINED_FUNCTIONS[category]?.[functionName];
    if (!predefinedFunction) return [];
    
    const currentSubFunctions = groupedPermissions[category]?.[functionName]?.subFunctions || {};
    return predefinedFunction.subFunctions.filter(subFunc => !currentSubFunctions.hasOwnProperty(subFunc));
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

  // Get main functions from each category
  const getMainFunctions = () => {
    const functions: Array<{
      category: string;
      functionName: string;
      displayName: string;
      description: string;
      granted: boolean;
      subFunctions: { [key: string]: boolean };
      availableSubFunctions: string[];
    }> = [];

    Object.entries(PREDEFINED_FUNCTIONS).forEach(([category, categoryFunctions]) => {
      Object.entries(categoryFunctions).forEach(([functionName, functionData]) => {
        const currentPermissions = groupedPermissions[category]?.[functionName];
        const availableSubFunctions = getAvailableSubFunctions(category, functionName);
        
        functions.push({
          category,
          functionName,
          displayName: FUNCTION_DISPLAY_MAP[category] || functionName,
          description: functionData.description,
          granted: currentPermissions?.granted || false,
          subFunctions: currentPermissions?.subFunctions || {},
          availableSubFunctions
        });
      });
    });

    return functions;
  };

  const mainFunctions = getMainFunctions();

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

      {/* Legacy Permissions Note */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            Grant or revoke legacy permissions (Note: Admins have all permissions by default)
          </p>
        </CardContent>
      </Card>

      {/* Main Functions */}
      <div className="space-y-4">
        {mainFunctions.map((func) => {
          const functionKey = `${func.category}-${func.functionName}`;
          const selectedSubFunction = selectedSubFunctions[functionKey] || '';
          const hasSubFunctions = Object.keys(func.subFunctions).length > 0;
          const grantedSubFunctions = Object.values(func.subFunctions).filter(Boolean).length;

          return (
            <Card key={functionKey} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                {/* Main Function Row */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div>
                        <h4 className="text-base font-medium">{func.displayName}</h4>
                        <p className="text-sm text-muted-foreground">{func.description}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    {hasSubFunctions && (
                      <Badge variant="outline" className="text-xs">
                        {grantedSubFunctions}/{Object.keys(func.subFunctions).length} sub-functions
                      </Badge>
                    )}
                    <Switch
                      checked={func.granted}
                      onCheckedChange={(checked) => 
                        handleMainFunctionToggle(func.category, func.functionName, checked)
                      }
                    />
                  </div>
                </div>

                {/* Sub-functions Section */}
                {func.granted && (
                  <div className="mt-4 pt-4 border-t space-y-4">
                    {/* Add Sub-function Dropdown */}
                    {func.availableSubFunctions.length > 0 && (
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-medium min-w-0 flex-shrink-0">
                          Add Sub-function:
                        </label>
                        <Select
                          value={selectedSubFunction}
                          onValueChange={(value) => {
                            setSelectedSubFunctions(prev => ({
                              ...prev,
                              [functionKey]: value
                            }));
                          }}
                        >
                          <SelectTrigger className="flex-1 bg-background border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors z-50">
                            <SelectValue placeholder={`Select ${func.displayName} sub-function...`} />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-lg z-[100]">
                            {func.availableSubFunctions.map((subFunc) => (
                              <SelectItem 
                                key={subFunc} 
                                value={subFunc}
                                className="hover:bg-muted cursor-pointer"
                              >
                                {subFunc}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={() => {
                            if (selectedSubFunction) {
                              handleAddSubFunction(func.category, func.functionName, selectedSubFunction);
                            }
                          }}
                          disabled={!selectedSubFunction}
                          size="sm"
                          className="flex-shrink-0"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    )}

                    {/* Current Sub-functions */}
                    {hasSubFunctions && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Current Sub-functions:</p>
                        <div className="space-y-2">
                          {Object.entries(func.subFunctions).map(([subFunction, granted]) => (
                            <div key={subFunction} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                              <div className="flex items-center space-x-2">
                                {granted ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-600" />
                                )}
                                <span className="text-sm">{subFunction}</span>
                              </div>
                              
                              <Select
                                value={granted ? "granted" : "denied"}
                                onValueChange={(value) => 
                                  handleSubFunctionToggle(func.category, func.functionName, subFunction, value === "granted")
                                }
                              >
                                <SelectTrigger className="w-28 h-8 bg-background z-50">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background border shadow-lg z-[100]">
                                  <SelectItem value="granted" className="hover:bg-muted cursor-pointer">
                                    <div className="flex items-center space-x-2">
                                      <CheckCircle className="h-3 w-3 text-green-600" />
                                      <span>Allow</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="denied" className="hover:bg-muted cursor-pointer">
                                    <div className="flex items-center space-x-2">
                                      <XCircle className="h-3 w-3 text-red-600" />
                                      <span>Deny</span>
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default FunctionPermissionsManager;