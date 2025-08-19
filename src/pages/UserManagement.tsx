import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePermissions, UserProfile, Permission } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Users, Shield, Settings, UserCheck, UserX } from 'lucide-react';
import { Navigate } from 'react-router-dom';

const AVAILABLE_PERMISSIONS = [
  'manage_claimants',
  'manage_attorneys',
  'manage_experts',
  'manage_appointments',
  'view_reports',
  'manage_documents',
  'view_analytics',
  'manage_leads'
];

const UserManagement: React.FC = () => {
  const { isAdmin, loading, getAllUsers, getUserPermissions, updateUserRole, grantPermission, revokePermission } = usePermissions();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = async () => {
    const allUsers = await getAllUsers();
    setUsers(allUsers);
  };

  const handleUserSelect = async (user: UserProfile) => {
    setSelectedUser(user);
    const permissions = await getUserPermissions(user.id);
    setUserPermissions(permissions);
    setIsManageModalOpen(true);
  };

  const handleRoleUpdate = async (newRole: string) => {
    if (!selectedUser) return;

    const success = await updateUserRole(selectedUser.id, newRole);
    if (success) {
      toast.success(`User role updated to ${newRole}`);
      setSelectedUser({ ...selectedUser, role: newRole });
      fetchUsers();
    } else {
      toast.error('Failed to update user role');
    }
  };

  const handlePermissionToggle = async (permissionName: string, granted: boolean) => {
    if (!selectedUser) return;

    const success = granted 
      ? await grantPermission(selectedUser.id, permissionName)
      : await revokePermission(selectedUser.id, permissionName);

    if (success) {
      toast.success(`Permission ${granted ? 'granted' : 'revoked'}`);
      const updatedPermissions = await getUserPermissions(selectedUser.id);
      setUserPermissions(updatedPermissions);
    } else {
      toast.error(`Failed to ${granted ? 'grant' : 'revoke'} permission`);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hasPermission = (permissionName: string): boolean => {
    return userPermissions.some(p => p.permission_name === permissionName && p.granted);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kutlwano-blue"></div>
      </div>
    );
  }

  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <Helmet>
        <title>User Management - Kutlwano & Associate</title>
        <meta name="description" content="Manage user roles and permissions for the medico-legal management system" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-kutlwano-blue/5 to-kutlwano-teal/5 p-6">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal rounded-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">User Management</h1>
                <p className="text-muted-foreground">Manage user roles and permissions</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-md">
                <Label htmlFor="search">Search Users</Label>
                <Input
                  id="search"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Badge variant="secondary" className="bg-kutlwano-blue/10 text-kutlwano-blue">
                {users.length} Total Users
              </Badge>
            </div>
          </div>

          {/* Users Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map((user) => (
              <Card key={user.id} className="hover:shadow-lg transition-shadow border-border/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-r from-kutlwano-blue/10 to-kutlwano-teal/10 rounded-full">
                        {user.role === 'admin' ? (
                          <Shield className="h-5 w-5 text-kutlwano-blue" />
                        ) : (
                          <UserCheck className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {user.first_name && user.last_name 
                            ? `${user.first_name} ${user.last_name}`
                            : 'No Name Set'
                          }
                        </CardTitle>
                        <CardDescription>{user.email}</CardDescription>
                      </div>
                    </div>
                    <Badge 
                      variant={user.role === 'admin' ? 'default' : 'secondary'}
                      className={user.role === 'admin' ? 'bg-kutlwano-blue text-white' : ''}
                    >
                      {user.role || 'user'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => handleUserSelect(user)}
                    className="w-full"
                    variant="outline"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Permissions
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredUsers.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <UserX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Users Found</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? 'No users match your search criteria.' : 'No users available to manage.'}
                </p>
              </CardContent>
            </Card>
          )}

          {/* User Management Dialog */}
          <Dialog open={isManageModalOpen} onOpenChange={setIsManageModalOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-kutlwano-blue" />
                  Manage User: {selectedUser?.first_name} {selectedUser?.last_name}
                </DialogTitle>
                <DialogDescription>
                  Update user role and manage individual permissions
                </DialogDescription>
              </DialogHeader>

              {selectedUser && (
                <div className="space-y-6">
                  {/* User Info */}
                  <div className="bg-gradient-to-r from-kutlwano-blue/5 to-kutlwano-teal/5 p-4 rounded-lg">
                    <p className="font-medium">{selectedUser.email}</p>
                    <p className="text-sm text-muted-foreground">User ID: {selectedUser.id}</p>
                  </div>

                  {/* Role Management */}
                  <div>
                    <Label className="text-base font-semibold">User Role</Label>
                    <Select value={selectedUser.role || 'user'} onValueChange={handleRoleUpdate}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground mt-1">
                      Administrators have full access to all system functions
                    </p>
                  </div>

                  <Separator />

                  {/* Permissions Management */}
                  <div>
                    <Label className="text-base font-semibold">Individual Permissions</Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Grant or revoke specific permissions (Note: Admins have all permissions by default)
                    </p>
                    
                    <div className="space-y-3">
                      {AVAILABLE_PERMISSIONS.map((permission) => (
                        <div key={permission} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium capitalize">
                              {permission.replace(/_/g, ' ')}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {getPermissionDescription(permission)}
                            </p>
                          </div>
                          <Switch
                            checked={selectedUser.role === 'admin' || hasPermission(permission)}
                            onCheckedChange={(checked) => handlePermissionToggle(permission, checked)}
                            disabled={selectedUser.role === 'admin'}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  );
};

const getPermissionDescription = (permission: string): string => {
  const descriptions: Record<string, string> = {
    manage_claimants: 'Create, edit, and manage claimant records',
    manage_attorneys: 'Manage referring attorney information',
    manage_experts: 'Add and manage medical expert profiles',
    manage_appointments: 'Schedule and manage appointments',
    view_reports: 'Access and view system reports',
    manage_documents: 'Upload and manage documents',
    view_analytics: 'Access analytics and statistics',
    manage_leads: 'Manage lead generation and tracking'
  };
  return descriptions[permission] || 'System permission';
};

export default UserManagement;