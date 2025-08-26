import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePermissions, UserProfile, Permission } from '@/hooks/usePermissions';
import { useSecureLawFirms } from '@/hooks/useSecureLawFirms';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Users, Shield, Settings, UserCheck, UserX, UserPlus, Eye, EyeOff, ArrowLeft, Mail, RefreshCw, Trash2, Key, Copy, AlertTriangle } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

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
  const navigate = useNavigate();
  const { isAdmin, loading, userRole, getAllUsers, getUserPermissions, updateUserRole, grantPermission, revokePermission, resendEmailConfirmation } = usePermissions();
  const { lawFirms, loading: lawFirmsLoading } = useSecureLawFirms();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [userToChangePassword, setUserToChangePassword] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [displayPassword, setDisplayPassword] = useState<string>("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordAction, setPasswordAction] = useState<string>("");
  
  // Add user form state
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'user' as string,
    permissions: [] as string[],
    userType: '' as string, // 'attorney' or 'employee'
    lawFirmId: '' as string, // For attorneys
    employeeRole: '' as string // For employees: 'medico_legal_manager'
  });

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

  const validatePassword = (password: string): boolean => {
    return password.length >= 8;
  };

  const handleCreateUser = async () => {
    if (!newUserForm.email || !newUserForm.password) {
      toast.error('Email and password are required');
      return;
    }

    if (!validatePassword(newUserForm.password)) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    setIsCreatingUser(true);

    try {
      console.log('Creating user via edge function...');
      
      // Call the edge function to create user
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: newUserForm.email,
          password: newUserForm.password,
          firstName: newUserForm.firstName,
          lastName: newUserForm.lastName,
          role: newUserForm.role,
          permissions: newUserForm.permissions,
          lawFirmId: newUserForm.userType === 'attorney' ? newUserForm.lawFirmId : null
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        
        // Provide user-friendly error messages based on error type
        let errorMessage = 'Failed to create user';
        
        if (error.name === 'FunctionsHttpError') {
          // This typically means the function returned a non-2xx status
          errorMessage = 'Email address is already registered. Please use a different email or check if the user already exists.';
        } else {
          errorMessage = error.message || 'An unexpected error occurred while creating the user';
        }
        
        toast.error(errorMessage);
        return;
      }

      if (data?.error) {
        console.error('User creation error:', data.error);
        toast.error(data.error);
        return;
      }

      if (data?.success) {
        console.log('User created successfully:', data.user);
        toast.success('User created successfully! They will receive a confirmation email to activate their account.');
        
        // Show the password to admin
        setDisplayPassword(newUserForm.password);
        setPasswordAction("created");
        setShowPasswordDialog(true);
        
        setIsAddUserModalOpen(false);
        setNewUserForm({
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          role: 'user',
          permissions: [],
          userType: '',
          lawFirmId: '',
          employeeRole: ''
        });
        fetchUsers();
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('Failed to create user');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handlePermissionChange = (permission: string, checked: boolean) => {
    setNewUserForm(prev => ({
      ...prev,
      permissions: checked 
        ? [...prev.permissions, permission]
        : prev.permissions.filter(p => p !== permission)
    }));
  };

  const handleResendEmailConfirmation = async (user: UserProfile) => {
    if (!user.email) {
      toast.error('User email not found');
      return;
    }

    const success = await resendEmailConfirmation(user.email);
    if (success) {
      toast.success('Email confirmation sent successfully');
    } else {
      toast.error('Failed to send email confirmation');
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeletingUser(true);

    try {
      console.log('Deleting user via edge function...');
      
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: {
          userId: userToDelete.id
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        toast.error('Failed to delete user');
        return;
      }

      if (data?.error) {
        console.error('User deletion error:', data.error);
        toast.error(data.error);
        return;
      }

      if (data?.success) {
        console.log('User deleted successfully:', data.deletedUser);
        toast.success(`User ${data.deletedUser.email} has been deleted successfully`);
        setUserToDelete(null);
        fetchUsers(); // Refresh the users list
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('Failed to delete user');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleChangePassword = async () => {
    if (!userToChangePassword || !newPassword) {
      toast.error('Password is required');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    setIsChangingPassword(true);

    try {
      console.log('Changing password via user-management function...');
      
      const { data, error } = await supabase.functions.invoke('user-management', {
        body: {
          action: 'change_password',
          userId: userToChangePassword.id,
          newPassword: newPassword
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        toast.error('Failed to change password');
        return;
      }

      if (data?.error) {
        console.error('Password change error:', data.error);
        toast.error(data.error);
        return;
      }

      if (data?.success) {
        console.log('Password changed successfully');
        toast.success(`Password changed successfully for ${userToChangePassword.email}`);
        
        // Show the new password to admin
        setDisplayPassword(newPassword);
        setPasswordAction("changed");
        setShowPasswordDialog(true);
        
        setIsChangePasswordOpen(false);
        setUserToChangePassword(null);
        setNewPassword('');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const copyPasswordToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(displayPassword);
      toast.success('Password copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy password');
    }
  };

  const handleClosePasswordDialog = () => {
    setShowPasswordDialog(false);
    setDisplayPassword("");
    setPasswordAction("");
  };

  useEffect(() => {
    if (!loading && isAdmin()) {
      fetchUsers();
    }
  }, [loading, userRole]);

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
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal rounded-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">User Management</h1>
                  <p className="text-muted-foreground">Manage user roles and permissions</p>
                </div>
              </div>
              <Button 
                onClick={() => navigate('/dashboard')}
                variant="outline"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
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
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-kutlwano-blue/10 text-kutlwano-blue">
                  {users.length} Total Users
                </Badge>
                <Button 
                  onClick={() => setIsAddUserModalOpen(true)}
                  className="bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal text-white"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </div>
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
                  <div className="space-y-2">
                    <Button 
                      onClick={() => handleUserSelect(user)}
                      className="w-full"
                      variant="outline"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Manage Permissions
                    </Button>
                    <Button 
                      onClick={() => handleResendEmailConfirmation(user)}
                      className="w-full"
                      variant="outline"
                      size="sm"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Resend Email Confirmation
                    </Button>
                    <Button 
                      onClick={() => {
                        setUserToChangePassword(user);
                        setIsChangePasswordOpen(true);
                      }}
                      className="w-full"
                      variant="outline"
                      size="sm"
                    >
                      <Key className="h-4 w-4 mr-2" />
                      Change Password
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive"
                          size="sm"
                          className="w-full"
                          onClick={() => setUserToDelete(user)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete User
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the user account for{' '}
                            <strong>{user.email}</strong> and remove all their data from our servers.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setUserToDelete(null)}>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleDeleteUser}
                            disabled={isDeletingUser}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {isDeletingUser ? 'Deleting...' : 'Delete User'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
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

          {/* Add User Dialog */}
          <Dialog open={isAddUserModalOpen} onOpenChange={setIsAddUserModalOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-kutlwano-blue" />
                  Add New User
                </DialogTitle>
                <DialogDescription>
                  Create a new user account with email, password, and permissions
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        placeholder="First name"
                        value={newUserForm.firstName}
                        onChange={(e) => setNewUserForm(prev => ({ ...prev, firstName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        placeholder="Last name"
                        value={newUserForm.lastName}
                        onChange={(e) => setNewUserForm(prev => ({ ...prev, lastName: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@example.com"
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Minimum 8 characters"
                        value={newUserForm.password}
                        onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {newUserForm.password && newUserForm.password.length < 8 && (
                      <p className="text-sm text-destructive mt-1">
                        Password must be at least 8 characters long
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>User Type</Label>
                    <Select value={newUserForm.userType} onValueChange={(value) => setNewUserForm(prev => ({ ...prev, userType: value, lawFirmId: '', employeeRole: '' }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="attorney">Referring Attorney</SelectItem>
                        <SelectItem value="employee">Kutlwano & Associates Employee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newUserForm.userType === 'attorney' && (
                    <div>
                      <Label>Select Law Firm</Label>
                      <Select value={newUserForm.lawFirmId} onValueChange={(value) => setNewUserForm(prev => ({ ...prev, lawFirmId: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose law firm" />
                        </SelectTrigger>
                        <SelectContent>
                          {lawFirmsLoading ? (
                            <SelectItem value="" disabled>Loading law firms...</SelectItem>
                          ) : (
                            lawFirms.map((firm) => (
                              <SelectItem key={firm.id} value={firm.id}>
                                {firm.name} ({firm.code}) - {firm.contact_person}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {newUserForm.userType === 'employee' && (
                    <div>
                      <Label>Employee Role</Label>
                      <Select value={newUserForm.employeeRole} onValueChange={(value) => setNewUserForm(prev => ({ ...prev, employeeRole: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select employee role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="medico_legal_manager">Medico Legal Manager</SelectItem>
                          <SelectItem value="admin_assistant">Administrative Assistant</SelectItem>
                          <SelectItem value="case_manager">Case Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label>System Role</Label>
                    <Select value={newUserForm.role} onValueChange={(value) => setNewUserForm(prev => ({ ...prev, role: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select system role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                 </div>

                 <Separator />

                 {/* Permissions Selection */}
                {newUserForm.role !== 'admin' && (
                  <div>
                    <Label className="text-base font-semibold">Permissions</Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Select specific permissions for this user
                    </p>
                    
                    <div className="space-y-3">
                      {AVAILABLE_PERMISSIONS.map((permission) => (
                        <div key={permission} className="flex items-center space-x-3 p-3 border rounded-lg">
                          <Checkbox
                            id={permission}
                            checked={newUserForm.permissions.includes(permission)}
                            onCheckedChange={(checked) => handlePermissionChange(permission, checked as boolean)}
                          />
                          <div className="flex-1">
                            <Label htmlFor={permission} className="font-medium capitalize cursor-pointer">
                              {permission.replace(/_/g, ' ')}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {getPermissionDescription(permission)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {newUserForm.role === 'admin' && (
                  <div className="bg-kutlwano-blue/5 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Administrator users automatically have all permissions and don't need individual permission assignments.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsAddUserModalOpen(false)}
                    disabled={isCreatingUser}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateUser}
                    disabled={isCreatingUser || !newUserForm.email || !newUserForm.password || !newUserForm.userType || (newUserForm.userType === 'attorney' && !newUserForm.lawFirmId) || (newUserForm.userType === 'employee' && !newUserForm.employeeRole)}
                    className="bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal text-white"
                  >
                    {isCreatingUser ? 'Creating...' : 'Create User'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

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

          {/* Change Password Dialog */}
          <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-kutlwano-blue" />
                  Change User Password
                </DialogTitle>
                <DialogDescription>
                  Set a new password for {userToChangePassword?.email}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min 8 characters)"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Password must be at least 8 characters long
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setIsChangePasswordOpen(false);
                      setUserToChangePassword(null);
                      setNewPassword('');
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword || !newPassword || newPassword.length < 8}
                    className="flex-1 bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal text-white"
                  >
                    {isChangingPassword ? 'Changing...' : 'Change Password'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Password Display Dialog */}
          <Dialog open={showPasswordDialog} onOpenChange={handleClosePasswordDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Password {passwordAction === "created" ? "Created" : "Changed"}
                </DialogTitle>
                <DialogDescription>
                  The password has been successfully {passwordAction}. Please copy it and share it securely with the user.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-800 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium text-sm">Security Notice</span>
                  </div>
                  <p className="text-sm text-amber-700">
                    This password will only be shown once. Make sure to copy it and share it securely with the user.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display-password">Generated Password</Label>
                  <div className="flex gap-2">
                    <Input
                      id="display-password"
                      type="text"
                      value={displayPassword}
                      readOnly
                      className="font-mono bg-muted"
                    />
                    <Button 
                      onClick={copyPasswordToClipboard}
                      variant="outline"
                      size="icon"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button onClick={handleClosePasswordDialog} className="bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal text-white">
                  I've Copied the Password
                </Button>
              </div>
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