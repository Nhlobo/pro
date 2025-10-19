import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Shield, 
  Users, 
  Calendar, 
  FileText, 
  FolderOpen, 
  BarChart,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Save,
  RotateCcw
} from 'lucide-react';
import { useFunctionPermissions, PREDEFINED_FUNCTIONS, GroupedPermissions } from '@/hooks/useFunctionPermissions';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';

interface RoleBasedPermissionManagerProps {
  user: any;
  onPermissionChange?: () => void;
  mode?: 'compact' | 'detailed';
}

const FUNCTION_CATEGORIES = {
  'Claimant Management': {
    icon: Shield,
    color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    description: 'Manage claimant records and information'
  },
  'Medical Expert Management': {
    icon: Users,
    color: 'bg-green-500/10 text-green-700 dark:text-green-300',
    description: 'Handle medical expert directory and profiles'
  },
  'Appointment Management': {
    icon: Calendar,
    color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
    description: 'Schedule and manage appointments'
  },
  'Case Management': {
    icon: FileText,
    color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    description: 'Manage appointment requests, progress reports, and case updates'
  },
  'Report Management': {
    icon: FileText,
    color: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
    description: 'Track and manage reports'
  },
  'Document Management': {
    icon: FolderOpen,
    color: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
    description: 'Handle document uploads and storage'
  },
  'Analytics & Reporting': {
    icon: BarChart,
    color: 'bg-red-500/10 text-red-700 dark:text-red-300',
    description: 'View analytics and generate reports'
  },
  'User Management': {
    icon: Users,
    color: 'bg-gray-500/10 text-gray-700 dark:text-gray-300',
    description: 'Manage user accounts and permissions'
  }
} as const;

const RoleBasedPermissionManager: React.FC<RoleBasedPermissionManagerProps> = ({ 
  user, 
  onPermissionChange,
  mode = 'detailed'
}) => {
  const { getUserFunctionPermissions, groupPermissions, updateFunctionPermission, addSubFunction, loading } = useFunctionPermissions();
  const { isAdmin } = usePermissions();
  const [permissions, setPermissions] = useState<any[]>([]);
  const [groupedPermissions, setGroupedPermissions] = useState<GroupedPermissions>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [savingChanges, setSavingChanges] = useState(false);

  useEffect(() => {
    fetchPermissions();
  }, [user.id]);

  const fetchPermissions = async () => {
    const userPermissions = await getUserFunctionPermissions(user.id);
    setPermissions(userPermissions);
    setGroupedPermissions(groupPermissions(userPermissions));
    
    // Auto-expand categories that have permissions
    const categoriesWithPermissions = new Set<string>();
    userPermissions.forEach(perm => {
      if (perm.granted) {
        categoriesWithPermissions.add(perm.function_category);
      }
    });
    setOpenCategories(categoriesWithPermissions);
  };

  const handleMainFunctionToggle = async (
    functionCategory: string,
    functionName: string,
    granted: boolean
  ) => {
    const success = await updateFunctionPermission(user.id, functionCategory, functionName, null, granted);
    
    if (success) {
      toast.success(`${functionName} ${granted ? 'enabled' : 'disabled'}`);
      await fetchPermissions();
      setHasChanges(true);
      onPermissionChange?.();
    } else {
      toast.error(`Failed to ${granted ? 'enable' : 'disable'} ${functionName}`);
    }
  };

  const handleSubFunctionToggle = async (
    functionCategory: string,
    functionName: string,
    subFunction: string,
    granted: boolean
  ) => {
    // Ensure the sub-function exists in the database
    const currentSubFunctions = groupedPermissions[functionCategory]?.[functionName]?.subFunctions || {};
    
    if (!currentSubFunctions.hasOwnProperty(subFunction)) {
      const addSuccess = await addSubFunction(user.id, functionCategory, functionName, subFunction, user.user_type || 'employee');
      if (!addSuccess) {
        toast.error(`Failed to create ${subFunction}`);
        return;
      }
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

  const toggleCategory = (category: string) => {
    const newOpenCategories = new Set(openCategories);
    if (newOpenCategories.has(category)) {
      newOpenCategories.delete(category);
    } else {
      newOpenCategories.add(category);
    }
    setOpenCategories(newOpenCategories);
  };

  const getSubFunctionStatus = (category: string, functionName: string, subFunction: string): boolean => {
    return groupedPermissions[category]?.[functionName]?.subFunctions?.[subFunction] || false;
  };

  const getMainFunctionStatus = (category: string, functionName: string): boolean => {
    return groupedPermissions[category]?.[functionName]?.granted || false;
  };

  const getCategoryStats = (category: string) => {
    const categoryData = PREDEFINED_FUNCTIONS[category];
    if (!categoryData) return { total: 0, enabled: 0 };

    let total = 0;
    let enabled = 0;

    Object.entries(categoryData).forEach(([functionName, functionData]) => {
      const mainEnabled = getMainFunctionStatus(category, functionName);
      if (mainEnabled) enabled++;
      total++;

      functionData.subFunctions.forEach(subFunction => {
        const subEnabled = getSubFunctionStatus(category, functionName, subFunction);
        if (subEnabled) enabled++;
        total++;
      });
    });

    return { total, enabled };
  };

  const handleSaveAllChanges = async () => {
    setSavingChanges(true);
    try {
      // In a real implementation, you might want to batch these operations
      toast.success('All changes saved successfully');
      setHasChanges(false);
      onPermissionChange?.();
    } catch (error) {
      toast.error('Failed to save changes');
    } finally {
      setSavingChanges(false);
    }
  };

  const handleResetChanges = async () => {
    await fetchPermissions();
    setHasChanges(false);
    toast.info('Changes reset');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Loading permissions...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (mode === 'compact') {
    return (
      <div className="space-y-3">
        {hasChanges && (
          <Alert className="py-2">
            <AlertTriangle className="h-3 w-3" />
            <AlertDescription className="text-xs">
              You have unsaved changes
              <div className="flex gap-1 mt-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleResetChanges}
                  className="h-6 px-2 text-xs"
                >
                  Reset
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSaveAllChanges}
                  disabled={savingChanges}
                  className="h-6 px-2 text-xs"
                >
                  Save All
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Compact Permission Categories */}
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {Object.entries(PREDEFINED_FUNCTIONS).map(([category, categoryFunctions]) => {
            const categoryInfo = FUNCTION_CATEGORIES[category];
            const stats = getCategoryStats(category);
            const isOpen = openCategories.has(category);
            const IconComponent = categoryInfo?.icon || Shield;

            return (
              <div key={category} className="border rounded-lg">
                <div 
                  className="p-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleCategory(category)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded ${categoryInfo?.color}`}>
                        <IconComponent className="h-3 w-3" />
                      </div>
                      <div>
                        <h4 className="font-medium text-xs">{category}</h4>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs px-1 py-0">
                        {stats.enabled}/{stats.total}
                      </Badge>
                      {isOpen ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
                
                {isOpen && (
                  <div className="px-2 pb-2">
                    <div className="space-y-1">
                      {Object.entries(categoryFunctions).map(([functionName, functionData]) => {
                        const mainGranted = getMainFunctionStatus(category, functionName);
                        
                        return (
                          <div key={functionName} className="space-y-1">
                            {/* Main Function - Compact */}
                            <div className="flex items-center justify-between p-1 bg-muted/30 rounded text-xs">
                              <div className="flex items-center gap-1 flex-1 min-w-0">
                                <div className="w-3 h-3 flex items-center justify-center">
                                  {mainGranted ? (
                                    <CheckCircle2 className="h-2 w-2 text-green-600" />
                                  ) : (
                                    <XCircle className="h-2 w-2 text-red-600" />
                                  )}
                                </div>
                                <span className="font-medium truncate">{functionName}</span>
                              </div>
                              <Switch
                                checked={mainGranted}
                                onCheckedChange={(checked) => 
                                  handleMainFunctionToggle(category, functionName, checked)
                                }
                                className="scale-75"
                              />
                            </div>

                            {/* Sub-functions - Even more compact */}
                            {functionData.subFunctions.length > 0 && mainGranted && (
                              <div className="ml-3 space-y-0.5">
                                {functionData.subFunctions.map((subFunction) => {
                                  const subGranted = getSubFunctionStatus(category, functionName, subFunction);
                                  
                                  return (
                                    <div key={subFunction} className="flex items-center justify-between py-0.5 text-xs">
                                      <span className="text-muted-foreground truncate flex-1 min-w-0">
                                        {subFunction}
                                      </span>
                                      <Switch
                                        checked={subGranted}
                                        onCheckedChange={(checked) => 
                                          handleSubFunctionToggle(category, functionName, subFunction, checked)
                                        }
                                        disabled={!mainGranted}
                                        className="scale-75"
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
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">
                  Role-Based Permissions
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Manage function-level access for {user.first_name} {user.last_name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {user.role}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {user.user_type === 'referring_attorney' ? 'Attorney' : 'Staff'}
              </Badge>
            </div>
          </div>
          
          {hasChanges && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You have unsaved changes
                <div className="flex gap-2 mt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleResetChanges}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleSaveAllChanges}
                    disabled={savingChanges}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save All
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>
      </Card>

      {/* Permission Categories */}
      <div className="space-y-4">
        <div className="grid gap-4">
          {Object.entries(PREDEFINED_FUNCTIONS).map(([category, categoryFunctions]) => {
            const categoryInfo = FUNCTION_CATEGORIES[category];
            const stats = getCategoryStats(category);
            const isOpen = openCategories.has(category);
            const IconComponent = categoryInfo?.icon || Shield;

            return (
              <Card key={category} className="overflow-hidden">
                <Collapsible open={isOpen} onOpenChange={() => toggleCategory(category)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${categoryInfo?.color}`}>
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="font-medium">{category}</h4>
                            <p className="text-sm text-muted-foreground">
                              {categoryInfo?.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {stats.enabled}/{stats.total} enabled
                          </Badge>
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <Separator className="mb-4" />
                      <div className="space-y-4">
                        {Object.entries(categoryFunctions).map(([functionName, functionData]) => {
                          const mainGranted = getMainFunctionStatus(category, functionName);
                          
                          return (
                            <div key={functionName} className="space-y-3">
                              {/* Main Function */}
                              <div className="flex items-center justify-between p-3 rounded-lg border">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center justify-center w-6 h-6">
                                    {mainGranted ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-red-600" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">{functionName}</p>
                                    <p className="text-xs text-muted-foreground">{functionData.description}</p>
                                  </div>
                                </div>
                                <Switch
                                  checked={mainGranted}
                                  onCheckedChange={(checked) => 
                                    handleMainFunctionToggle(category, functionName, checked)
                                  }
                                />
                              </div>

                              {/* Sub-functions */}
                              {functionData.subFunctions.length > 0 && (
                                <div className="ml-6 space-y-2">
                                  <Separator />
                                  <div className="space-y-2">
                                    {functionData.subFunctions.map((subFunction) => {
                                      const subGranted = getSubFunctionStatus(category, functionName, subFunction);
                                      
                                      return (
                                        <div key={subFunction} className="flex items-center justify-between py-2">
                                          <div className="flex items-center gap-2">
                                            <div className="w-4 h-4" />
                                            <span className="text-sm">{subFunction}</span>
                                          </div>
                                          <Switch
                                            checked={subGranted}
                                            onCheckedChange={(checked) => 
                                              handleSubFunctionToggle(category, functionName, subFunction, checked)
                                            }
                                            disabled={!mainGranted}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RoleBasedPermissionManager;