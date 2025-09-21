import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Users, Search, Shield, Settings, UserCheck, Filter, X } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { usePermissions, UserProfile } from '@/hooks/usePermissions';
import FunctionPermissionsManager from '@/components/FunctionPermissionsManager';
import { toast } from 'sonner';

const PermissionManagement: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, loading, getAllUsers } = usePermissions();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterUserType, setFilterUserType] = useState<string>('all');

  const fetchUsers = async () => {
    const allUsers = await getAllUsers();
    setUsers(allUsers);
  };

  useEffect(() => {
    if (!loading && isAdmin()) {
      fetchUsers();
    }
  }, [loading]);

  const filteredUsers = users
    .filter(user => {
      const matchesSearch = user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = filterRole === 'all' || user.role === filterRole;
      const matchesUserType = filterUserType === 'all' || user.user_type === filterUserType;
      
      return matchesSearch && matchesRole && matchesUserType;
    });

  const clearFilters = () => {
    setSearchTerm('');
    setFilterRole('all');
    setFilterUserType('all');
  };

  const hasActiveFilters = searchTerm || filterRole !== 'all' || filterUserType !== 'all';

  const getUserTypeDisplay = (userType: string) => {
    switch (userType) {
      case 'referring_attorney':
        return 'Attorney';
      case 'employee':
        return 'Staff';
      default:
        return 'User';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'employee':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'referring_attorney':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <Helmet>
        <title>Permission Management - Kutlwano & Associate</title>
        <meta name="description" content="Manage user permissions and function access for the medico-legal management system" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
        <div className="container mx-auto max-w-6xl">
          {/* Compact Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/user-management')}
                  className="p-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="p-2 bg-gradient-to-r from-primary to-secondary rounded-lg">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Permission Management</h1>
                  <p className="text-sm text-muted-foreground">Manage user function permissions</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            {/* Compact Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-48 h-9"
                />
              </div>
              
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-24 h-9">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="referring_attorney">Attorney</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterUserType} onValueChange={setFilterUserType}>
                <SelectTrigger className="w-24 h-9">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="employee">Staff</SelectItem>
                  <SelectItem value="referring_attorney">Attorney</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="h-9 px-2">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Main Content - Split Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-200px)]">
            {/* Users List - Compact */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Users
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-280px)]">
                  <div className="space-y-1 p-3">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => setSelectedUser(user)}
                        className={`p-2 rounded border cursor-pointer transition-all hover:bg-muted/50 ${
                          selectedUser?.id === user.id ? 'bg-primary/10 border-primary/30' : 'border-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {user.first_name} {user.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                          <div className="flex flex-col gap-1 ml-2">
                            <Badge 
                              variant="outline" 
                              className={`text-xs px-1 py-0 ${getRoleBadgeColor(user.role || 'user')}`}
                            >
                              {user.role || 'user'}
                            </Badge>
                            <Badge variant="secondary" className="text-xs px-1 py-0">
                              {getUserTypeDisplay(user.user_type || 'employee')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Permission Management Panel */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Function Permissions
                </CardTitle>
                {selectedUser && (
                  <CardDescription className="text-xs">
                    Managing permissions for {selectedUser.first_name} {selectedUser.last_name}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="p-3">
                {selectedUser ? (
                  <div className="h-[calc(100vh-320px)]">
                    <FunctionPermissionsManager 
                      user={selectedUser} 
                      onPermissionChange={fetchUsers}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[calc(100vh-320px)] text-center">
                    <UserCheck className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground mb-1">Select a user to manage permissions</p>
                    <p className="text-xs text-muted-foreground">Choose from the users list on the left</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default PermissionManagement;