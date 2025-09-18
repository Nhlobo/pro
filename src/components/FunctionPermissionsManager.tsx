import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Settings, Shield, Users, FileText, BarChart, FolderOpen, Calendar, CheckCircle, XCircle, Plus } from 'lucide-react';
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

const FunctionPermissionsManager: React.FC<FunctionPermissionsManagerProps> = ({ user, onPermissionChange }) => {
  const { getUserFunctionPermissions, groupPermissions, updateFunctionPermission, addSubFunction, loading } = useFunctionPermissions();
  const [permissions, setPermissions] = useState<any[]>([]);
  const [groupedPermissions, setGroupedPermissions] = useState<GroupedPermissions>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedFunctions, setExpandedFunctions] = useState<Set<string>>(new Set());
  const [selectedSubFunctions, setSelectedSubFunctions] = useState<{[key: string]: string}>({});

  useEffect(() => {
    fetchPermissions();
  }, [user.id]);

  const fetchPermissions = async () => {
    const userPermissions = await getUserFunctionPermissions(user.id);
    setPermissions(userPermissions);
    setGroupedPermissions(groupPermissions(userPermissions));
  };

  const handlePermissionToggle = async (
    functionCategory: string,
    functionName: string,
    subFunction: string | null,
    granted: boolean
  ) => {
    const success = await updateFunctionPermission(user.id, functionCategory, functionName, subFunction, granted);
    
    if (success) {
      toast.success(`Permission ${granted ? 'granted' : 'revoked'} successfully`);
      await fetchPermissions();
      onPermissionChange?.();
    } else {
      toast.error(`Failed to ${granted ? 'grant' : 'revoke'} permission`);
    }
  };

  const handleAddSubFunction = async (
    functionCategory: string,
    functionName: string,
    subFunction: string
  ) => {
    const success = await addSubFunction(user.id, functionCategory, functionName, subFunction, user.user_type || 'employee');
    
    if (success) {
      toast.success(`Sub-function "${subFunction}" added successfully`);
      await fetchPermissions();
      onPermissionChange?.();
      // Clear the selection
      const key = `${functionCategory}-${functionName}`;
      setSelectedSubFunctions(prev => ({
        ...prev,
        [key]: ''
      }));
    } else {
      toast.error(`Failed to add sub-function "${subFunction}"`);
    }
  };

  const getAvailableSubFunctions = (category: string, functionName: string) => {
    const predefinedFunction = PREDEFINED_FUNCTIONS[category]?.[functionName];
    if (!predefinedFunction) return [];
    
    const currentSubFunctions = groupedPermissions[category]?.[functionName]?.subFunctions || {};
    return predefinedFunction.subFunctions.filter(subFunc => !currentSubFunctions.hasOwnProperty(subFunc));
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleFunction = (functionKey: string) => {
    const newExpanded = new Set(expandedFunctions);
    if (newExpanded.has(functionKey)) {
      newExpanded.delete(functionKey);
    } else {
      newExpanded.add(functionKey);
    }
    setExpandedFunctions(newExpanded);
  };

  const getUserTypeColor = (userType: string) => {
    switch (userType) {
      case 'referring_attorney':
        return 'bg-blue-100 text-blue-800';
      case 'employee':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Function Permissions</h3>
          <p className="text-sm text-muted-foreground">
            Manage detailed function and sub-function permissions for {user.first_name} {user.last_name}
          </p>
        </div>
        <Badge className={getUserTypeColor(user.user_type || 'employee')}>
          {user.user_type === 'referring_attorney' ? 'Referring Attorney' : 'Internal Staff'}
        </Badge>
      </div>

      <div className="space-y-3">
        {Object.entries(groupedPermissions).map(([category, functions]) => (
          <Card key={category} className="border-l-4 border-l-primary/20">
            <Collapsible 
              open={expandedCategories.has(category)}
              onOpenChange={() => toggleCategory(category)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getCategoryIcon(category)}
                      <div>
                        <CardTitle className="text-base">{category}</CardTitle>
                        <CardDescription className="text-xs">
                          {Object.keys(functions).length} functions available
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {Object.values(functions).filter(f => f.granted).length}/{Object.keys(functions).length}
                      </Badge>
                      {expandedCategories.has(category) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0 space-y-3">
                  {Object.entries(functions).map(([functionName, functionData]) => {
                    const functionKey = `${category}-${functionName}`;
                    const hasSubFunctions = Object.keys(functionData.subFunctions).length > 0;
                    const availableSubFunctions = getAvailableSubFunctions(category, functionName);
                    const selectedSubFunction = selectedSubFunctions[functionKey] || '';

                    return (
                      <div key={functionName} className="border rounded-lg p-4 bg-card/50 hover:bg-card/70 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id={`function-${functionKey}`}
                              checked={functionData.granted}
                              onCheckedChange={(checked) => 
                                handlePermissionToggle(category, functionName, null, checked as boolean)
                              }
                            />
                            <div>
                              <label 
                                htmlFor={`function-${functionKey}`}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {functionName}
                              </label>
                              <p className="text-xs text-muted-foreground">
                                Manage sub-function permissions and add new ones
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            {hasSubFunctions && (
                              <Select
                                value={
                                  Object.values(functionData.subFunctions).every(Boolean) ? "all" :
                                  Object.values(functionData.subFunctions).some(Boolean) ? "partial" : "none"
                                }
                                onValueChange={(value) => {
                                  const grantAll = value === "all";
                                  Object.keys(functionData.subFunctions).forEach(subFunc => {
                                    handlePermissionToggle(category, functionName, subFunc, grantAll);
                                  });
                                }}
                                disabled={!functionData.granted}
                              >
                                <SelectTrigger className="w-32 h-7 text-xs">
                                  <SelectValue placeholder="Bulk Actions" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all" className="text-xs">Grant All</SelectItem>
                                  <SelectItem value="none" className="text-xs">Deny All</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            
                            {hasSubFunctions && (
                              <Badge variant="secondary" className="text-xs">
                                {Object.values(functionData.subFunctions).filter(Boolean).length}/{Object.keys(functionData.subFunctions).length}
                              </Badge>
                            )}
                            
                            <button
                              onClick={() => toggleFunction(functionKey)}
                              className="p-1 hover:bg-muted rounded"
                            >
                              {expandedFunctions.has(functionKey) ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Add New Sub-function Section */}
                        {functionData.granted && availableSubFunctions.length > 0 && (
                          <div className="mb-3 p-3 bg-muted/20 rounded-lg border border-dashed">
                            <div className="flex items-center gap-2">
                              <Select
                                value={selectedSubFunction}
                                onValueChange={(value) => {
                                  setSelectedSubFunctions(prev => ({
                                    ...prev,
                                    [functionKey]: value
                                  }));
                                }}
                              >
                                <SelectTrigger className="flex-1 h-8 text-xs">
                                  <SelectValue placeholder="Select sub-function to add..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableSubFunctions.map((subFunc) => (
                                    <SelectItem key={subFunc} value={subFunc} className="text-xs">
                                      {subFunc}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <button
                                onClick={() => {
                                  if (selectedSubFunction) {
                                    handleAddSubFunction(category, functionName, selectedSubFunction);
                                  }
                                }}
                                disabled={!selectedSubFunction}
                                className="h-8 px-3 bg-primary text-primary-foreground rounded-md text-xs hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                              >
                                <Plus className="h-3 w-3" />
                                Add
                              </button>
                            </div>
                          </div>
                        )}

                        {expandedFunctions.has(functionKey) && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground font-medium">Sub-function Permissions:</p>
                                <Badge variant="outline" className="text-xs">
                                  {Object.values(functionData.subFunctions).filter(Boolean).length}/{Object.keys(functionData.subFunctions).length} granted
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-1 gap-3 ml-2">
                                {Object.entries(functionData.subFunctions).map(([subFunction, granted]) => (
                                  <div key={subFunction} className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                                    <div className="flex items-center space-x-2 flex-1">
                                      <div className="flex items-center space-x-2">
                                        {granted ? (
                                          <CheckCircle className="h-3 w-3 text-green-600" />
                                        ) : (
                                          <XCircle className="h-3 w-3 text-red-600" />
                                        )}
                                        <label className="text-sm font-medium">{subFunction}</label>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center space-x-2">
                                      <Select
                                        value={granted ? "granted" : "denied"}
                                        onValueChange={(value) => 
                                          handlePermissionToggle(category, functionName, subFunction, value === "granted")
                                        }
                                        disabled={!functionData.granted}
                                      >
                                        <SelectTrigger className="w-24 h-7 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="granted" className="text-xs">
                                            <div className="flex items-center space-x-1">
                                              <CheckCircle className="h-3 w-3 text-green-600" />
                                              <span>Allow</span>
                                            </div>
                                          </SelectItem>
                                          <SelectItem value="denied" className="text-xs">
                                            <div className="flex items-center space-x-1">
                                              <XCircle className="h-3 w-3 text-red-600" />
                                              <span>Deny</span>
                                            </div>
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                      
                                      <Checkbox
                                        id={`sub-function-${functionKey}-${subFunction}`}
                                        checked={granted}
                                        onCheckedChange={(checked) => 
                                          handlePermissionToggle(category, functionName, subFunction, checked as boolean)
                                        }
                                        disabled={!functionData.granted}
                                        className="h-3 w-3"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>

      {Object.keys(groupedPermissions).length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No function permissions available for this user type.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FunctionPermissionsManager;