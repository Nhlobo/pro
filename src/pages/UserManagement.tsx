import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePermissions, UserProfile, Permission } from '@/hooks/usePermissions';
import { useSecureReferringAttorneys } from '@/hooks/useSecureReferringAttorneys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// Every "popup" on this page is a docked side panel, not a centered modal —
// Sheet is the same Radix dialog primitive under the hood, so behaviour,
// focus-trapping and state wiring are unchanged; only the presentation
// (slide-in from the edge, anchored to the page) differs. Aliased to the
// old Dialog* names so the JSX below stays identical.
import {
  Sheet as Dialog,
  SheetContent as DialogContent,
  SheetDescription as DialogDescription,
  SheetHeader as DialogHeader,
  SheetTitle as DialogTitle,
} from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Users, Shield, Settings, UserCheck, UserX, UserPlus, Eye, EyeOff, ArrowLeft, Mail,
  Trash2, Key, Copy, AlertTriangle, Shuffle, LayoutGrid, Rows3, Search, SortAsc, SortDesc,
  X, MoreHorizontal, Link2, ChevronRight, Briefcase, ShieldCheck,
} from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import EmployeeNotificationSettings from '@/components/EmployeeNotificationSettings';
import FunctionPermissionsManager from '@/components/FunctionPermissionsManager';
import { EmailConfigurationAlert } from '@/components/EmailConfigurationAlert';
import EditProfileDialog from '@/components/EditProfileDialog';
import {
  AdminPage,
  AdminHeader,
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminStatCard,
  AdminPill,
  AdminEmptyState,
  AdminLoadingState,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

/** Flat, rounded-none active/inactive treatment shared with every other admin screen. */
const flatToggle =
  'rounded-none border-black/15 text-black hover:bg-black/5 data-[state=on]:bg-black data-[state=on]:text-white';

const USER_TYPE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  employee: 'Company Employee',
  referring_attorney: 'Referring Attorney',
};

const USER_TYPE_TONE: Record<string, 'teal' | 'success' | 'neutral'> = {
  admin: 'teal',
  employee: 'success',
  referring_attorney: 'neutral',
};

interface UserManagementProps {
  /** True when rendered inside the Admin Portal (e.g. AdminIAM at /admin/iam),
   *  where the portal's top bar already shows this page's title and a
   *  "Back to Operations Dashboard" control. Hides this component's own
   *  duplicate Dashboard button so there's exactly one way back, not two
   *  that point to different places. Standalone use at /user-management
   *  (outside the portal chrome) keeps the button. */
  embedded?: boolean;
}

const UserManagement: React.FC<UserManagementProps> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const { isAdmin, loading, userRole, getAllUsers, getUserPermissions, updateUserRole, grantPermission, revokePermission, resendEmailConfirmation } = usePermissions();
  const { referringAttorneys, loading: referringAttorneysLoading } = useSecureReferringAttorneys();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [pendingPermissions, setPendingPermissions] = useState<Record<string, boolean>>({});
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  // Pending state forwarded from FunctionPermissionsManager so the modal footer Save can trigger its save.
  const [fnPending, setFnPending] = useState<{ count: number; saving: boolean; save: () => Promise<boolean>; reset: () => void }>({
    count: 0,
    saving: false,
    save: async () => true,
    reset: () => {},
  });
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [userToChangePassword, setUserToChangePassword] = useState<UserProfile | null>(null);
  const [showEmailConfigAlert, setShowEmailConfigAlert] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [displayPassword, setDisplayPassword] = useState<string>("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordAction, setPasswordAction] = useState<string>("");
  const [createdUserSummary, setCreatedUserSummary] = useState<{ firstName: string; lastName: string; email: string; position: string; userType: string } | null>(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [userToEditProfile, setUserToEditProfile] = useState<UserProfile | null>(null);
  
  // Link attorney state
  const [isLinkAttorneyOpen, setIsLinkAttorneyOpen] = useState(false);
  const [userToLinkAttorney, setUserToLinkAttorney] = useState<UserProfile | null>(null);
  const [selectedAttorneyId, setSelectedAttorneyId] = useState<string>('');
  const [isLinkingAttorney, setIsLinkingAttorney] = useState(false);
  
  // Browser bar state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'role'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterUserType, setFilterUserType] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Add user form state
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'employee' as string,
    userType: 'employee' as string,
    position: '' as string, // For employees: position like 'Admin Assistant'
    lawFirmId: '' as string, // For referring attorneys
    permissions: [] as string[]
  });

  const fetchUsers = async () => {
    const allUsers = await getAllUsers();
    setUsers(allUsers);
  };

  const handleUserSelect = async (user: UserProfile) => {
    setSelectedUser(user);
    const permissions = await getUserPermissions(user.id);
    setUserPermissions(permissions);
    setPendingPermissions({});
    setPendingRole(null);
    setIsManageModalOpen(true);
  };

  const handleRoleUpdate = (newRole: string) => {
    if (!selectedUser) return;
    setPendingRole(newRole);
    setSelectedUser({ ...selectedUser, role: newRole });
  };

  const handlePermissionToggle = (permissionName: string, granted: boolean) => {
    if (!selectedUser) return;
    setPendingPermissions(prev => ({ ...prev, [permissionName]: granted }));
  };

  const hasPendingChanges = pendingRole !== null || Object.keys(pendingPermissions).length > 0 || fnPending.count > 0;

  const handleSaveAllChanges = async () => {
    if (!selectedUser) return;
    setIsSavingPermissions(true);

    try {
      if (pendingRole !== null) {
        const success = await updateUserRole(selectedUser.id, pendingRole);
        if (!success) {
          toast.error('Failed to update user role');
          setIsSavingPermissions(false);
          return;
        }
      }

      for (const [permissionName, granted] of Object.entries(pendingPermissions)) {
        const success = granted
          ? await grantPermission(selectedUser.id, permissionName)
          : await revokePermission(selectedUser.id, permissionName);
        if (!success) {
          toast.error(`Failed to ${granted ? 'grant' : 'revoke'} ${permissionName.replace(/_/g, ' ')}`);
        }
      }

      // Forward to FunctionPermissionsManager to persist its staged module/sub-function changes via the atomic RPC.
      if (fnPending.count > 0) {
        try {
          await fnPending.save();
        } catch {
          // savePending already surfaced a specific error toast; abort the overall save flow.
          setIsSavingPermissions(false);
          return;
        }
      }


      const updatedPermissions = await getUserPermissions(selectedUser.id);
      setUserPermissions(updatedPermissions);
      setPendingPermissions({});
      setPendingRole(null);
      fetchUsers();
      toast.success('All changes saved successfully');
      setIsManageModalOpen(false);
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const getEffectivePermissionState = (permissionName: string): boolean => {
    if (permissionName in pendingPermissions) {
      return pendingPermissions[permissionName];
    }
    return hasPermission(permissionName);
  };

  const filteredUsers = users
    .filter(user => {
      const matchesSearch = user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = filterRole === 'all' || user.role === filterRole;
      const matchesUserType = filterUserType === 'all' || user.user_type === filterUserType;
      
      return matchesSearch && matchesRole && matchesUserType;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = (`${a.first_name} ${a.last_name}`).localeCompare(`${b.first_name} ${b.last_name}`);
          break;
        case 'email':
          comparison = (a.email || '').localeCompare(b.email || '');
          break;
        case 'role':
          comparison = (a.role || '').localeCompare(b.role || '');
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  const clearAllFilters = () => {
    setSearchTerm('');
    setFilterRole('all');
    setFilterUserType('all');
    setSortBy('name');
    setSortOrder('asc');
  };

  const hasActiveFilters = searchTerm || filterRole !== 'all' || filterUserType !== 'all' || sortBy !== 'name' || sortOrder !== 'asc';

  const adminCount = users.filter(u => u.user_type === 'admin').length;
  const employeeCount = users.filter(u => u.user_type === 'employee').length;
  const attorneyCount = users.filter(u => u.user_type === 'referring_attorney').length;

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
      
      // Determine role based on position
      const userRole = newUserForm.position === 'Sales Consultant' ? 'sales_consultant' : newUserForm.role;
      
      // Call the edge function to create user
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: newUserForm.email,
          password: newUserForm.password,
          firstName: newUserForm.firstName,
          lastName: newUserForm.lastName,
          role: userRole,
          userType: newUserForm.userType,
          position: newUserForm.position,
          permissions: newUserForm.permissions,
          lawFirmId: newUserForm.userType === 'referring_attorney' ? newUserForm.lawFirmId : null
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
        
        // Save summary of created user before resetting form
        setCreatedUserSummary({
          firstName: newUserForm.firstName,
          lastName: newUserForm.lastName,
          email: newUserForm.email,
          position: newUserForm.position,
          userType: newUserForm.userType,
        });
        
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
          role: 'employee',
          userType: 'employee',
          position: '',
          lawFirmId: '',
          permissions: []
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

    const result = await resendEmailConfirmation(user.email);
    if (result.success) {
      toast.success(result.message || "Email confirmation sent successfully");
    } else {
      // Check if it's an SMTP configuration issue
      if (result.message?.includes('SMTP') || result.message?.includes('email system')) {
        setShowEmailConfigAlert(true);
      }
      toast.error(result.message || "Failed to send email confirmation");
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
        toast.success(`User ${data.deletedUser.email} has been permanently deleted. This email address can now be reused for new registrations.`);
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

  const generateRandomPassword = () => {
    const upperCase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowerCase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '#@!$%&*';
    
    // Ensure at least one character from each category
    let password = '';
    password += upperCase[Math.floor(Math.random() * upperCase.length)];
    password += lowerCase[Math.floor(Math.random() * lowerCase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest (6 more characters to make 10 total)
    const allChars = upperCase + lowerCase + numbers + symbols;
    for (let i = 4; i < 10; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password to randomize position of required characters
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const handleAutoGeneratePassword = () => {
    const generatedPassword = generateRandomPassword();
    setNewPassword(generatedPassword);
    toast.success('Password auto-generated');
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
    setCreatedUserSummary(null);
  };

  const handleEditProfileOpen = (user: UserProfile) => {
    setUserToEditProfile(user);
    setIsEditProfileOpen(true);
  };

  const handleLinkAttorneyOpen = (user: UserProfile) => {
    setUserToLinkAttorney(user);
    setSelectedAttorneyId(user.referring_attorney_id || '');
    setIsLinkAttorneyOpen(true);
  };

  const handleLinkAttorney = async () => {
    if (!userToLinkAttorney) return;

    if (!selectedAttorneyId) {
      toast.error('Please select a referring attorney');
      return;
    }

    setIsLinkingAttorney(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ referring_attorney_id: selectedAttorneyId })
        .eq('id', userToLinkAttorney.id);

      if (error) {
        console.error('Error linking attorney:', error);
        throw error;
      }

      toast.success('User linked to referring attorney successfully');
      setIsLinkAttorneyOpen(false);
      setUserToLinkAttorney(null);
      setSelectedAttorneyId('');
      fetchUsers();
    } catch (error) {
      console.error('Failed to link attorney:', error);
      toast.error(`Failed to link attorney: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLinkingAttorney(false);
    }
  };


  useEffect(() => {
    if (!loading && isAdmin()) {
      fetchUsers();
    }
  }, [loading, userRole]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <AdminLoadingState label="Loading user directory…" />
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

      <AdminPage className="brand-legal-theme max-w-7xl">
        <AdminHeader
          eyebrow="Directory"
          title="All Users"
          description="Manage roles, permissions and account access across the platform."
          icon={Users}
          actions={
            <>
              {!embedded && (
                <Button
                  onClick={() => navigate('/dashboard')}
                  variant="outline"
                  size="sm"
                  className="rounded-none border-black/15 text-black hover:bg-black/5"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Dashboard
                </Button>
              )}
              <Button
                onClick={() => setIsAddUserModalOpen(true)}
                size="sm"
                className="rounded-none text-white hover:opacity-90"
                style={{ backgroundColor: BRAND_TEAL }}
              >
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                Add User
              </Button>
            </>
          }
        />

        <EmailConfigurationAlert
          isVisible={showEmailConfigAlert}
          onDismiss={() => setShowEmailConfigAlert(false)}
        />

        {/* Directory at a glance — the numbers a manager checks first, before drilling into any single record. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <AdminStatCard label="Total Users" value={users.length} icon={Users} />
          <AdminStatCard label="Administrators" value={adminCount} icon={ShieldCheck} />
          <AdminStatCard label="Company Employees" value={employeeCount} icon={UserCheck} />
          <AdminStatCard label="Referring Attorneys" value={attorneyCount} icon={Briefcase} />
        </div>

        {/* Search, filter & sort */}
        <AdminCard>
          <AdminCardHeader
            icon={Search}
            title="Search & Filter"
            description="Narrow the directory below."
            actions={<AdminPill tone="neutral">{filteredUsers.length} of {users.length} users</AdminPill>}
          />
          <AdminCardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Search users
                </label>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="search"
                    placeholder="Search by name or email…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="rounded-none pl-8"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Role</label>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="mt-1 rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="employee">Company Employee</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">User Type</label>
                <Select value={filterUserType} onValueChange={setFilterUserType}>
                  <SelectTrigger className="mt-1 rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="referring_attorney">Referring Attorney</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Sort</Label>
                  <Select value={sortBy} onValueChange={(value: 'name' | 'email' | 'role') => setSortBy(value)}>
                    <SelectTrigger className="h-8 w-28 rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="role">Role</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="h-8 rounded-none border-black/15 px-2 text-black hover:bg-black/5"
                  >
                    {sortOrder === 'asc' ? <SortAsc className="h-3.5 w-3.5" /> : <SortDesc className="h-3.5 w-3.5" />}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">View</Label>
                  <div className="flex border border-black/15">
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`flex h-8 w-8 items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-black text-white' : 'text-slate-500 hover:bg-black/5'}`}
                      title="Table view"
                    >
                      <Rows3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`flex h-8 w-8 items-center justify-center border-l border-black/15 transition-colors ${viewMode === 'grid' ? 'bg-black text-white' : 'text-slate-500 hover:bg-black/5'}`}
                      title="Card view"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {hasActiveFilters ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="rounded-none text-destructive hover:bg-destructive/5 hover:text-destructive"
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Clear filters
                </Button>
              ) : null}
            </div>
          </AdminCardBody>
        </AdminCard>

        {/* Directory */}
        <AdminCard>
          <AdminCardHeader
            icon={Users}
            title="Users"
            description={searchTerm || hasActiveFilters ? 'Filtered results from the directory.' : 'Everyone with access to this platform.'}
          />

          {filteredUsers.length === 0 ? (
            <AdminEmptyState
              icon={UserX}
              title="No users found"
              description={searchTerm ? 'No users match your search criteria.' : 'No users available to manage.'}
            />
          ) : viewMode === 'list' ? (
            <>
              {/* Desktop / tablet-landscape table */}
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="border-black/10 hover:bg-transparent">
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} className="border-black/10">
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                              style={{ backgroundColor: BRAND_TEAL }}
                            >
                              {(user.first_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-black">
                                {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : 'No Name Set'}
                                {user.user_type === 'employee' && user.position && (
                                  <span className="font-normal text-slate-400"> · {user.position}</span>
                                )}
                              </p>
                              <p className="truncate text-xs text-slate-500">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <AdminPill tone={USER_TYPE_TONE[user.user_type] || 'neutral'}>
                            {USER_TYPE_LABEL[user.user_type] || user.user_type || 'User'}
                          </AdminPill>
                        </TableCell>
                        <TableCell className="text-sm capitalize text-slate-600">{(user.role || 'user').replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              onClick={() => handleUserSelect(user)}
                              size="sm"
                              variant="outline"
                              className="rounded-none border-black/15 text-black hover:bg-black/5"
                            >
                              <Settings className="mr-1.5 h-3.5 w-3.5" />
                              Manage
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" className="rounded-none hover:bg-black/5">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-none border-black/10">
                                <DropdownMenuItem onClick={() => handleEditProfileOpen(user)}>
                                  <Settings className="mr-2 h-3.5 w-3.5" /> Edit Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleLinkAttorneyOpen(user)}>
                                  <Link2 className="mr-2 h-3.5 w-3.5" /> Link Attorney
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleResendEmailConfirmation(user)}>
                                  <Mail className="mr-2 h-3.5 w-3.5" /> Resend Email Confirmation
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setUserToChangePassword(user);
                                    setIsChangePasswordOpen(true);
                                  }}
                                >
                                  <Key className="mr-2 h-3.5 w-3.5" /> Change Password
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setUserToDelete(user)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile / tablet-portrait card list — same data, no horizontal scroll. */}
              <div className="divide-y divide-black/10 lg:hidden">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleUserSelect(user)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.03]"
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: BRAND_TEAL }}
                    >
                      {(user.first_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-black">
                        {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : 'No Name Set'}
                      </p>
                      <p className="truncate text-xs text-slate-500">{user.email}</p>
                    </div>
                    <AdminPill tone={USER_TYPE_TONE[user.user_type] || 'neutral'} className="shrink-0">
                      {USER_TYPE_LABEL[user.user_type] || user.user_type || 'User'}
                    </AdminPill>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Card grid view */
            <AdminCardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredUsers.map((user) => (
                <div key={user.id} className="flex min-w-0 flex-col gap-3 border border-black/10 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: BRAND_TEAL }}
                      >
                        {(user.first_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-black">
                          {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : 'No Name Set'}
                        </p>
                        <p className="truncate text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <AdminPill tone={USER_TYPE_TONE[user.user_type] || 'neutral'} className="shrink-0">
                      {USER_TYPE_LABEL[user.user_type] || user.user_type || 'User'}
                    </AdminPill>
                  </div>

                  {user.user_type === 'employee' && user.position && (
                    <p className="text-xs text-slate-500">{user.position}</p>
                  )}

                  <div className="mt-auto grid grid-cols-2 gap-2 border-t border-black/10 pt-3">
                    <Button
                      onClick={() => handleUserSelect(user)}
                      variant="outline"
                      size="sm"
                      className="col-span-2 rounded-none border-black/15 text-black hover:bg-black/5"
                    >
                      <Settings className="mr-1.5 h-3.5 w-3.5" />
                      Manage Permissions
                    </Button>
                    <Button
                      onClick={() => handleEditProfileOpen(user)}
                      variant="ghost"
                      size="sm"
                      className="rounded-none text-xs hover:bg-black/5"
                    >
                      Edit Profile
                    </Button>
                    <Button
                      onClick={() => {
                        setUserToChangePassword(user);
                        setIsChangePasswordOpen(true);
                      }}
                      variant="ghost"
                      size="sm"
                      className="rounded-none text-xs hover:bg-black/5"
                    >
                      <Key className="mr-1 h-3 w-3" />
                      Password
                    </Button>
                    <Button
                      onClick={() => handleLinkAttorneyOpen(user)}
                      variant="ghost"
                      size="sm"
                      className="rounded-none text-xs hover:bg-black/5"
                    >
                      <Link2 className="mr-1 h-3 w-3" />
                      Link Attorney
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-none text-xs text-destructive hover:bg-destructive/5 hover:text-destructive"
                      onClick={() => setUserToDelete(user)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </AdminCardBody>
          )}
        </AdminCard>

        {/* Shared delete confirmation — one panel reused by every row/card instead of one per user. */}
        <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
          <DialogContent side="right" className="brand-legal-theme flex h-full w-full flex-col rounded-none border-black/10 p-0 shadow-none sm:max-w-md">
            <DialogHeader className="space-y-0 border-b border-black/10 px-5 py-4">
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Are you absolutely sure?
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                This action will permanently delete the user account for{' '}
                <strong className="text-black">{userToDelete?.email}</strong> and remove all their data from our servers.
                <br /><br />
                <strong className="text-black">Note:</strong> After deletion, the email address <strong className="text-black">{userToDelete?.email}</strong> will
                be available for reuse and can be registered again if needed (e.g., if this user was deleted by mistake).
              </DialogDescription>
            </DialogHeader>
            <div className="mt-auto flex gap-2 border-t border-black/10 px-5 py-4">
              <Button
                variant="outline"
                onClick={() => setUserToDelete(null)}
                className="flex-1 rounded-none border-black/15 text-black hover:bg-black/5"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteUser}
                disabled={isDeletingUser}
                className="flex-1 rounded-none bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeletingUser ? 'Deleting...' : 'Delete User'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

          {/* Add User panel */}
          <Dialog open={isAddUserModalOpen} onOpenChange={setIsAddUserModalOpen}>
            <DialogContent side="right" className="brand-legal-theme flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-xl">
              <DialogHeader className="space-y-0 border-b border-black/10 px-5 py-4">
                <DialogTitle className="flex items-center gap-2 text-base font-bold text-black">
                  <UserPlus className="h-4 w-4" style={{ color: BRAND_TEAL }} />
                  Add New User
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Create a new user account with email, password, and permissions
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 px-5 py-5">
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
                        className="mt-1 rounded-none"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        placeholder="Last name"
                        value={newUserForm.lastName}
                        onChange={(e) => setNewUserForm(prev => ({ ...prev, lastName: e.target.value }))}
                        className="mt-1 rounded-none"
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
                      className="mt-1 rounded-none"
                    />
                  </div>

                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative mt-1">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Minimum 8 characters"
                        value={newUserForm.password}
                        onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                        className="rounded-none"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full rounded-none px-3 py-2 hover:bg-transparent"
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
                      <p className="mt-1 text-xs text-destructive">
                        Password must be at least 8 characters long
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>User Type</Label>
                    <div className="mt-1 border border-black/10 bg-black/[0.02] p-2 text-sm text-slate-500">
                      Company Employee
                    </div>
                  </div>

                  <div>
                    <Label>Position</Label>
                    <Select value={newUserForm.position} onValueChange={(value) => setNewUserForm(prev => ({ ...prev, position: value }))}>
                      <SelectTrigger className="mt-1 rounded-none">
                        <SelectValue placeholder="Select position" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Case Manager - RAF">Case Manager - RAF</SelectItem>
                        <SelectItem value="Admin Assistant">Admin Assistant</SelectItem>
                        <SelectItem value="Case Manager - Med Neg">Case Manager - Med Neg</SelectItem>
                        <SelectItem value="Administrator">Administrator</SelectItem>
                        <SelectItem value="Sales Consultant">Sales Consultant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>System Role</Label>
                    <div className="mt-1 border border-black/10 bg-black/[0.02] p-2 text-sm text-slate-500">
                      {newUserForm.position === 'Sales Consultant' 
                        ? 'Sales Consultant (Attorney Pitchlog, Attorney Management & Claimant access only)' 
                        : 'Employee (Full system access)'}
                    </div>
                  </div>
                 </div>

                 <div className="h-px bg-black/10" />

                 {/* Module access notice — set after creation in Manage */}
                {newUserForm.role !== 'admin' && newUserForm.userType !== 'employee' && (
                  <div className="border border-dashed border-black/15 bg-black/[0.02] p-4">
                    <Label className="text-sm font-semibold text-black">Admin Portal Module Access</Label>
                    <p className="mt-1 text-xs text-slate-500">
                      After the user is created, open <strong className="text-black">Manage</strong> to allocate Admin Portal modules
                      (Attorney CRM, Case Management, Expert Network, Availability Heatmap, Support Hub,
                      Report Management, Reporting System, Document Vault, Finance & Payments, Appointment Engine, etc.)
                      or apply a one-click role preset.
                    </p>
                  </div>
                )}

                {(newUserForm.role === 'admin' || newUserForm.userType === 'employee') && (
                  <div className="border border-black/10 p-4" style={{ backgroundColor: `${BRAND_TEAL}0D` }}>
                    <p className="text-xs text-slate-600">
                      {newUserForm.role === 'admin' ? 'Administrator' : 'Company Employee'} users automatically have full system access including creating, editing, deleting, and approving records across all modules.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t border-black/10 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsAddUserModalOpen(false)}
                    disabled={isCreatingUser}
                    className="rounded-none border-black/15 text-black hover:bg-black/5"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateUser}
                    disabled={isCreatingUser || !newUserForm.email || !newUserForm.password || !newUserForm.position}
                    className="rounded-none text-white hover:opacity-90"
                    style={{ backgroundColor: BRAND_TEAL }}
                  >
                    {isCreatingUser ? 'Creating...' : 'Create User'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

        {/* Manage User panel */}
          <Dialog open={isManageModalOpen} onOpenChange={setIsManageModalOpen}>
            <DialogContent side="right" className="brand-legal-theme flex h-full w-full flex-col overflow-hidden rounded-none border-black/10 p-0 shadow-none sm:max-w-2xl lg:max-w-4xl">
              <DialogHeader className="space-y-0 border-b border-black/10 px-5 py-4">
                <DialogTitle className="flex items-center gap-2 text-base font-bold text-black">
                  <Shield className="h-4 w-4" style={{ color: BRAND_TEAL }} />
                  Manage User: {selectedUser?.first_name} {selectedUser?.last_name}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Update user role and manage individual permissions
                </DialogDescription>
              </DialogHeader>

              {selectedUser && (
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto px-5 pt-4 lg:grid-cols-3">
                  {/* Left Column - User Info & Role */}
                  <div className="space-y-4">
                    {/* User Info */}
                    <div className="border border-black/10 bg-black/[0.02] p-3">
                      <p className="text-sm font-medium text-black">{selectedUser.email}</p>
                      <p className="text-xs text-slate-500">ID: {selectedUser.id.slice(0, 8)}...</p>
                    </div>

                    {/* Role Management */}
                    <div>
                      <Label className="text-sm font-semibold text-black">User Role</Label>
                      <Select value={selectedUser.role || 'user'} onValueChange={handleRoleUpdate}>
                        <SelectTrigger className="mt-1 h-8 rounded-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User (no admin)</SelectItem>
                          <SelectItem value="sales_consultant">Sales Consultant</SelectItem>
                          <SelectItem value="medical_expert">Medical Expert</SelectItem>
                          <SelectItem value="referring_attorney">Referring Attorney</SelectItem>
                          <SelectItem value="finance">Finance</SelectItem>
                          <SelectItem value="director">Director</SelectItem>
                          <SelectItem value="employee">Company Employee (full access)</SelectItem>
                          <SelectItem value="admin">Administrator (full access)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-xs text-slate-500">
                        Only Admin and Company Employee receive full admin access. All others are restricted to their role-specific portal.
                      </p>
                      {pendingRole !== null && (
                        <p className="mt-1 text-xs font-medium" style={{ color: BRAND_TEAL }}>Role changed — click Update to save</p>
                      )}
                    </div>

                  </div>

                  {/* Right Column - Admin Portal Module Access (mirrors sidebar) */}
                  <div className="lg:col-span-2">
                    <Label className="text-sm font-semibold text-black">Admin Portal Module Access</Label>
                    <p className="mb-3 text-xs text-slate-500">
                      Toggle modules to match the Admin Portal sidebar. Use a preset for quick role allocation.
                    </p>
                    <div className="h-full">
                      <FunctionPermissionsManager
                        user={selectedUser}
                        onPermissionChange={fetchUsers}
                        onPendingStateChange={(s) =>
                          setFnPending({ count: s.pendingCount, saving: s.saving, save: s.save, reset: s.reset })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Pending Changes Indicator */}
              {selectedUser && hasPendingChanges && (
                <div className="mx-5 mt-3 flex items-center gap-2 border border-warning/40 bg-warning/5 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                  <p className="text-xs text-warning">
                    You have unsaved changes ({pendingRole ? 'role' : ''}{pendingRole && Object.keys(pendingPermissions).length > 0 ? ', ' : ''}{Object.keys(pendingPermissions).length > 0 ? `${Object.keys(pendingPermissions).length} permission(s)` : ''}). Click <strong>Update</strong> to save.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              {selectedUser && (
                <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-black/10 bg-white/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/80">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-none border-black/15 text-black hover:bg-black/5"
                    onClick={() => {
                      setUserToEditProfile(selectedUser);
                      setIsEditProfileOpen(true);
                      setIsManageModalOpen(false);
                    }}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Edit Full Profile
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-none border-black/15 text-black hover:bg-black/5"
                      onClick={() => setIsManageModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-none text-white hover:opacity-90"
                      style={{ backgroundColor: BRAND_TEAL }}
                      onClick={handleSaveAllChanges}
                      disabled={!hasPendingChanges || isSavingPermissions || fnPending.saving}
                    >
                      {isSavingPermissions || fnPending.saving
                        ? 'Saving...'
                        : hasPendingChanges
                          ? `Save Changes${fnPending.count > 0 ? ` (${fnPending.count})` : ''}`
                          : 'Saved'}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Edit Profile Dialog */}
          <EditProfileDialog
            open={isEditProfileOpen}
            onOpenChange={setIsEditProfileOpen}
            user={userToEditProfile}
            referringAttorneys={referringAttorneys}
            referringAttorneysLoading={referringAttorneysLoading}
            onProfileUpdated={fetchUsers}
          />

          {/* Change Password panel */}
          <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
            <DialogContent side="right" className="brand-legal-theme flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-md">
              <DialogHeader className="space-y-0 border-b border-black/10 px-5 py-4">
                <DialogTitle className="flex items-center gap-2 text-base font-bold text-black">
                  <Key className="h-4 w-4" style={{ color: BRAND_TEAL }} />
                  Change User Password
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Set a new password for {userToChangePassword?.email}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 px-5 py-5">
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="mt-1 flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min 8 characters)"
                        className="rounded-none pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full rounded-none px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleAutoGeneratePassword}
                      title="Auto-generate secure password"
                      className="rounded-none border-black/15 hover:bg-black/5"
                    >
                      <Shuffle className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Password must be at least 8 characters long. Click <Shuffle className="mx-1 inline h-3 w-3" /> to auto-generate a secure password.
                  </p>
                </div>

                <div className="flex gap-2 border-t border-black/10 pt-4">
                  <Button
                    onClick={() => {
                      setIsChangePasswordOpen(false);
                      setUserToChangePassword(null);
                      setNewPassword('');
                    }}
                    variant="outline"
                    className="flex-1 rounded-none border-black/15 text-black hover:bg-black/5"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword || !newPassword || newPassword.length < 8}
                    className="flex-1 rounded-none text-white hover:opacity-90"
                    style={{ backgroundColor: BRAND_TEAL }}
                  >
                    {isChangingPassword ? 'Changing...' : 'Change Password'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Password Display panel */}
          <Dialog open={showPasswordDialog} onOpenChange={handleClosePasswordDialog}>
            <DialogContent side="right" className="brand-legal-theme flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-md">
              <DialogHeader className="space-y-0 border-b border-black/10 px-5 py-4">
                <DialogTitle className="flex items-center gap-2 text-base font-bold text-black">
                  <Key className="h-4 w-4" style={{ color: BRAND_TEAL }} />
                  Password {passwordAction === "created" ? "Created" : "Changed"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  The password has been successfully {passwordAction}. Please copy it and share it securely with the user.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 px-5 py-5">
                <div className="border border-warning/40 bg-warning/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-warning">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Security Notice</span>
                  </div>
                  <p className="text-xs text-warning">
                    This password will only be shown once. Make sure to copy it and share it securely with the user.
                  </p>
                </div>

                {/* Created User Summary */}
                {passwordAction === "created" && createdUserSummary && (
                  <div className="space-y-2 border border-black/10 bg-black/[0.02] p-4">
                    <h4 className="text-sm font-semibold text-black">User Details</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-slate-500">Name:</span>
                      <span className="font-medium text-black">{createdUserSummary.firstName} {createdUserSummary.lastName}</span>
                      <span className="text-slate-500">Email:</span>
                      <span className="font-medium text-black">{createdUserSummary.email}</span>
                      <span className="text-slate-500">User Type:</span>
                      <span className="font-medium text-black">
                        {createdUserSummary.userType === 'employee' ? 'Company Employee' : 
                         createdUserSummary.userType === 'admin' ? 'Administrator' : 
                         createdUserSummary.userType}
                      </span>
                      <span className="text-slate-500">Position:</span>
                      <span className="font-medium text-black">{createdUserSummary.position || 'Not set'}</span>
                      <span className="text-slate-500">System Role:</span>
                      <span className="font-medium text-black">
                        {createdUserSummary.position === 'Sales Consultant' 
                          ? 'Sales Consultant' 
                          : 'Employee (Full Access)'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="display-password">Generated Password</Label>
                  <div className="flex gap-2">
                    <Input
                      id="display-password"
                      type="text"
                      value={displayPassword}
                      readOnly
                      className="rounded-none bg-black/[0.02] font-mono"
                    />
                    <Button 
                      onClick={copyPasswordToClipboard}
                      variant="outline"
                      size="icon"
                      className="rounded-none border-black/15 hover:bg-black/5"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-auto flex justify-end gap-2 border-t border-black/10 px-5 py-4">
                <Button
                  onClick={handleClosePasswordDialog}
                  className="rounded-none text-white hover:opacity-90"
                  style={{ backgroundColor: BRAND_TEAL }}
                >
                  I've Copied the Password
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Link Attorney panel */}
          <Dialog open={isLinkAttorneyOpen} onOpenChange={setIsLinkAttorneyOpen}>
            <DialogContent side="right" className="brand-legal-theme flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-md">
              <DialogHeader className="space-y-0 border-b border-black/10 px-5 py-4">
                <DialogTitle className="flex items-center gap-2 text-base font-bold text-black">
                  <Link2 className="h-4 w-4" style={{ color: BRAND_TEAL }} />
                  Link Referring Attorney
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Associate {userToLinkAttorney?.email} with a referring attorney to enable appointment creation
                  {userToLinkAttorney?.user_type === 'admin' && (
                    <span className="mt-1 block font-medium" style={{ color: BRAND_TEAL }}>
                      Administrator Account
                    </span>
                  )}
                  {userToLinkAttorney?.user_type === 'employee' && (
                    <span className="mt-1 block font-medium text-slate-600">
                      Employee Account
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 px-5 py-5">
                <div>
                  <Label htmlFor="selectAttorney">Select Referring Attorney</Label>
                  <Select
                    value={selectedAttorneyId}
                    onValueChange={setSelectedAttorneyId}
                  >
                    <SelectTrigger id="selectAttorney" className="mt-1 rounded-none">
                      <SelectValue placeholder="Choose a referring attorney" />
                    </SelectTrigger>
                    <SelectContent>
                      {referringAttorneysLoading ? (
                        <SelectItem value="loading" disabled>Loading attorneys...</SelectItem>
                      ) : referringAttorneys.length === 0 ? (
                        <SelectItem value="none" disabled>No attorneys available</SelectItem>
                      ) : (
                        referringAttorneys.map((attorney) => (
                          <SelectItem key={attorney.id} value={attorney.id}>
                            {attorney.name} - {attorney.code}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {selectedAttorneyId && (
                    <p className="mt-2 text-xs text-slate-500">
                      This user will be linked to the selected referring attorney for appointment creation.
                    </p>
                  )}
                </div>

                <div className="flex gap-2 border-t border-black/10 pt-4">
                  <Button
                    onClick={() => {
                      setIsLinkAttorneyOpen(false);
                      setUserToLinkAttorney(null);
                      setSelectedAttorneyId('');
                    }}
                    variant="outline"
                    className="flex-1 rounded-none border-black/15 text-black hover:bg-black/5"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleLinkAttorney}
                    disabled={isLinkingAttorney || !selectedAttorneyId || referringAttorneysLoading}
                    className="flex-1 rounded-none text-white hover:opacity-90"
                    style={{ backgroundColor: BRAND_TEAL }}
                  >
                    {isLinkingAttorney ? 'Linking...' : 'Link Attorney'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

        {/* Employee Notification Settings */}
        <EmployeeNotificationSettings />
      </AdminPage>
    </>
  );
};

export default UserManagement;
