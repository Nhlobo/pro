import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Calendar, Users, Building, BarChart3, Target } from "lucide-react";
import { User, UserCheck, Gavel, Stethoscope, ChevronDown, Clock, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import PermissionGuard from '@/components/PermissionGuard';
import { 
  LogOut, Settings, TrendingUp, Activity, CheckCircle,
  AlertTriangle, Briefcase, PieChart as PieChartIcon
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Index = () => {
  const { user, signOut } = useAuth();
  const { isAdmin, userRole, hasPermission, loading } = usePermissions();
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [userLawFirm, setUserLawFirm] = useState('');
  const [recentActivity] = useState([
    { action: "New claimant added", time: "2 hours ago", type: "success" },
    { action: "Expert report received", time: "4 hours ago", type: "info" },
    { action: "Appointment scheduled", time: "6 hours ago", type: "success" },
  ]);

  const [quickStats, setQuickStats] = useState({
    totalClaimants: 0,
    scheduledAppointments: 0,
    completedReports: 0,
    pendingReviews: 0
  });

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (user) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select(`
              first_name, 
              last_name, 
              law_firms:law_firm_id (name)
            `)
            .eq('id', user.id)
            .single();

          if (profile) {
            setUserName(`${profile.first_name || ''} ${profile.last_name || ''}`.trim());
            setUserLawFirm(profile.law_firms?.name || '');
          }
        } catch (error) {
          console.error('Error fetching user info:', error);
        }
      }
    };

    fetchUserInfo();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
    } catch (error) {
      toast.error("Error signing out");
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const canonicalUrl = `${window.location.origin}${window.location.pathname}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Dashboard - Kutlwano & Associate</title>
        <meta name="description" content="Comprehensive medico-legal case management dashboard for law firms and medical professionals" />
        <meta name="keywords" content="medico-legal, case management, dashboard, law firms, medical experts, appointments" />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
        {/* Header */}
        <div className="border-b border-border/40 bg-card/30 backdrop-blur-md">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal rounded-xl shadow-lg">
                    <Building className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal bg-clip-text text-transparent">
                      Kutlwano & Associate
                    </h1>
                    <p className="text-sm text-muted-foreground">Medico-Legal Management System</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {getGreeting()}, {userName || user?.email?.split('@')[0] || 'User'}!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {userLawFirm && `${userLawFirm} • `}
                    {userRole === 'admin' ? 'Administrator' : 'User'}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src="/placeholder-user.jpg" alt="Profile" />
                        <AvatarFallback className="bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal text-white">
                          {(userName || user?.email || 'U')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 bg-card/95 backdrop-blur-sm border-border/50" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{userName || 'User'}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user?.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="cursor-pointer text-red-600 dark:text-red-400" 
                      onClick={handleSignOut}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-6 py-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <Card className="bg-gradient-to-r from-kutlwano-blue/10 via-kutlwano-teal/10 to-kutlwano-blue/10 border-border/50 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground mb-2">
                      Welcome to your Dashboard
                    </h2>
                    <p className="text-muted-foreground">
                      Manage your medico-legal cases efficiently and effectively
                      {userLawFirm && ` for ${userLawFirm}`}
                    </p>
                  </div>
                  <div className="hidden md:block">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-kutlwano-blue">{quickStats.totalClaimants}</div>
                        <div className="text-xs text-muted-foreground">Total Claimants</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-kutlwano-teal">{quickStats.scheduledAppointments}</div>
                        <div className="text-xs text-muted-foreground">Appointments</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{quickStats.completedReports}</div>
                        <div className="text-xs text-muted-foreground">Completed Reports</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Function Categories */}
            <div className="lg:col-span-2">
              <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-kutlwano-blue" />
                    System Functions
                  </CardTitle>
                  <CardDescription>
                    Access all available system functions based on your permissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                   {/* Enhanced Grid Layout */}
                   <div className="grid md:grid-cols-2 gap-6">
                     {/* Claimant Management */}
                     <PermissionGuard permission="manage_claimants">
                      <div className="space-y-3 group">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal rounded-lg group-hover:scale-110 transition-transform duration-300">
                            <User className="h-4 w-4 text-white" />
                          </div>
                          <h3 className="text-sm font-medium text-foreground">Claimant Management</h3>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full h-10 text-xs bg-card/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-kutlwano-blue hover:to-kutlwano-teal hover:text-white transition-all duration-300 group-hover:scale-105">
                              Claimant Options
                              <ChevronDown className="ml-1 h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-48 bg-card/95 backdrop-blur-sm border-border/50">
                            <DropdownMenuItem asChild>
                              <Link to="/claimant" className="w-full flex items-center gap-2 text-xs">
                                <User className="h-3 w-3" />
                                Add Claimant
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to="/claimant-list" className="w-full flex items-center gap-2 text-xs">
                                <Users className="h-3 w-3" />
                                Claimant List
                              </Link>
                            </DropdownMenuItem>
                             <PermissionGuard permission={["manage_claimants", "view_reports"]}>
                               <DropdownMenuItem asChild>
                                 <Link to="/claimant-reports" className="w-full flex items-center gap-2 text-xs">
                                   <FileText className="h-3 w-3" />
                                   Claimant Reports
                                 </Link>
                               </DropdownMenuItem>
                             </PermissionGuard>
                             <PermissionGuard permission="admin_only">
                               <DropdownMenuItem asChild>
                                 <Link to="/audit-trail?area=claimant" className="w-full flex items-center gap-2 text-xs">
                                   <History className="h-3 w-3" />
                                   Audit Trail
                                 </Link>
                               </DropdownMenuItem>
                             </PermissionGuard>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                     </PermissionGuard>

                     {/* Attorney Management */}
                     <PermissionGuard permission="manage_attorneys">
                      <div className="space-y-3 group">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg group-hover:scale-110 transition-transform duration-300">
                            <Gavel className="h-4 w-4 text-white" />
                          </div>
                          <h3 className="text-sm font-medium text-foreground">Attorney Management</h3>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full h-10 text-xs bg-card/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-purple-500 hover:to-purple-600 hover:text-white transition-all duration-300 group-hover:scale-105">
                              Attorney Options
                              <ChevronDown className="ml-1 h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-48 bg-card backdrop-blur-sm border-border/50 z-50">
                            <DropdownMenuItem asChild>
                              <Link to="/referring-attorney" className="w-full flex items-center gap-2 text-xs">
                                <UserCheck className="h-3 w-3" />
                                Add Referring Attorney
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to="/referring-attorney-list" className="w-full flex items-center gap-2 text-xs">
                                <Users className="h-3 w-3" />
                                Attorney List
                              </Link>
                            </DropdownMenuItem>
                             <PermissionGuard permission={["manage_attorneys", "view_reports"]}>
                               <DropdownMenuItem asChild>
                                 <Link to="/referring-attorney-report" className="w-full flex items-center gap-2 text-xs">
                                   <FileText className="h-3 w-3" />
                                   Attorney Reports
                                 </Link>
                               </DropdownMenuItem>
                             </PermissionGuard>
                             <PermissionGuard permission="admin_only">
                               <DropdownMenuItem asChild>
                                 <Link to="/audit-trail?area=attorney" className="w-full flex items-center gap-2 text-xs">
                                   <History className="h-3 w-3" />
                                   Audit Trail
                                 </Link>
                               </DropdownMenuItem>
                             </PermissionGuard>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                     </PermissionGuard>

                      {/* Medical Expert Functions - Admin Only */}
                      <PermissionGuard permission="admin_only">
                       <div className="space-y-3 group">
                         <div className="flex items-center gap-2 mb-3">
                           <div className="p-1.5 bg-gradient-to-r from-teal-500 to-teal-600 rounded-lg group-hover:scale-110 transition-transform duration-300">
                             <Stethoscope className="h-4 w-4 text-white" />
                           </div>
                           <h3 className="text-sm font-medium text-foreground">Medical Experts (Admin Only)</h3>
                         </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full h-10 text-xs bg-card/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-teal-500 hover:to-teal-600 hover:text-white transition-all duration-300 group-hover:scale-105">
                              Expert Options
                              <ChevronDown className="ml-1 h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                           <DropdownMenuContent className="w-48 bg-card/95 backdrop-blur-sm border-border/50">
                             <DropdownMenuItem asChild>
                               <Link to="/medical-expert" className="w-full flex items-center gap-2 text-xs">
                                 <UserCheck className="h-3 w-3" />
                                 Add Medical Expert
                               </Link>
                             </DropdownMenuItem>
                             <DropdownMenuItem asChild>
                               <Link to="/medical-expert-directory" className="w-full flex items-center gap-2 text-xs">
                                 <Users className="h-3 w-3" />
                                 Expert Directory
                               </Link>
                             </DropdownMenuItem>
                              <PermissionGuard permission={["manage_experts", "view_reports"]}>
                                <DropdownMenuItem asChild>
                                  <Link to="/expert-reports" className="w-full flex items-center gap-2 text-xs">
                                    <BarChart3 className="h-3 w-3" />
                                    Expert Reports
                                  </Link>
                                </DropdownMenuItem>
                              </PermissionGuard>
                              <PermissionGuard permission="admin_only">
                                <DropdownMenuItem asChild>
                                  <Link to="/audit-trail?area=expert" className="w-full flex items-center gap-2 text-xs">
                                    <History className="h-3 w-3" />
                                    Audit Trail
                                  </Link>
                                </DropdownMenuItem>
                              </PermissionGuard>
                           </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                       </PermissionGuard>

                      {/* Assessment Schedule Functions */}
                      <PermissionGuard permission="manage_appointments">
                      <div className="space-y-3 group">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 bg-gradient-to-r from-green-500 to-green-600 rounded-lg group-hover:scale-110 transition-transform duration-300">
                            <Calendar className="h-4 w-4 text-white" />
                          </div>
                          <h3 className="text-sm font-medium text-foreground">Assessment Schedule</h3>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full h-10 text-xs bg-card/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-green-500 hover:to-green-600 hover:text-white transition-all duration-300 group-hover:scale-105">
                              Schedule Options
                              <ChevronDown className="ml-1 h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-48 bg-card/95 backdrop-blur-sm border-border/50">
                            <DropdownMenuItem asChild>
                              <Link to="/new-appointment" className="w-full flex items-center gap-2 text-xs">
                                <Calendar className="h-3 w-3" />
                                New Appointment
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to="/scheduled-assessment" className="w-full flex items-center gap-2 text-xs">
                                <Clock className="h-3 w-3" />
                                Scheduled Assessments
                              </Link>
                            </DropdownMenuItem>
                             <PermissionGuard permission={["view_reports", "view_analytics"]}>
                               <DropdownMenuItem asChild>
                                 <Link to="/assessment-reports-statistics" className="w-full flex items-center gap-2 text-xs">
                                   <BarChart3 className="h-3 w-3" />
                                   Reports & Statistics
                                 </Link>
                               </DropdownMenuItem>
                             </PermissionGuard>
                             <PermissionGuard permission="admin_only">
                               <DropdownMenuItem asChild>
                                 <Link to="/audit-trail?area=assessment" className="w-full flex items-center gap-2 text-xs">
                                   <History className="h-3 w-3" />
                                   Audit Trail
                                 </Link>
                               </DropdownMenuItem>
                             </PermissionGuard>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      </PermissionGuard>
                   </div>

                   {/* Additional Functions */}
                   <div className="mt-8 pt-8 border-t border-border/50">
                     <div className="flex items-center gap-3 mb-6">
                       <div className="p-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg">
                         <Building className="h-5 w-5 text-white" />
                       </div>
                       <h3 className="text-sm font-medium text-foreground">Additional Functions</h3>
                     </div>
                      <div className="flex flex-wrap gap-4">
                        <PermissionGuard permission="manage_documents">
                          <Button asChild variant="outline" className="bg-card/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-orange-500 hover:to-orange-600 hover:text-white transition-all duration-300 hover:scale-105">
                            <Link to="/document-uploading" className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Document Management
                            </Link>
                          </Button>
                        </PermissionGuard>
                        <PermissionGuard permission="manage_leads">
                          <Button asChild variant="outline" className="bg-card/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-indigo-500 hover:to-indigo-600 hover:text-white transition-all duration-300 hover:scale-105">
                            <Link to="/lead-generator" className="flex items-center gap-2">
                              <Target className="h-4 w-4" />
                              Lead Generator
                            </Link>
                          </Button>
                        </PermissionGuard>
                         <Button asChild variant="outline" className="bg-card/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-purple-500 hover:to-purple-600 hover:text-white transition-all duration-300 hover:scale-105">
                           <Link to="/sample-reports" className="flex items-center gap-2">
                             <FileText className="h-4 w-4" />
                             Sample Reports
                           </Link>
                         </Button>
                         <PermissionGuard permission="admin_only">
                           <Button asChild variant="outline" className="bg-card/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-kutlwano-blue hover:to-kutlwano-teal hover:text-white transition-all duration-300 hover:scale-105">
                             <Link to="/user-management" className="flex items-center gap-2">
                               <Users className="h-4 w-4" />
                               User Management
                             </Link>
                           </Button>
                         </PermissionGuard>
                      </div>
                   </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              
              {/* Recent Activity */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4 text-kutlwano-teal" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                        <div className={`w-2 h-2 rounded-full ${
                          activity.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
                        }`} />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-foreground">{activity.action}</p>
                          <p className="text-xs text-muted-foreground">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-kutlwano-blue" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <PermissionGuard permission="manage_claimants">
                      <Button asChild variant="ghost" className="w-full justify-start text-xs">
                        <Link to="/claimant" className="flex items-center gap-2">
                          <User className="h-3 w-3" />
                          Add New Claimant
                        </Link>
                      </Button>
                    </PermissionGuard>
                    <PermissionGuard permission="manage_appointments">
                      <Button asChild variant="ghost" className="w-full justify-start text-xs">
                        <Link to="/new-appointment" className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          Schedule Appointment
                        </Link>
                      </Button>
                    </PermissionGuard>
                    <PermissionGuard permission="view_reports">
                      <Button asChild variant="ghost" className="w-full justify-start text-xs">
                        <Link to="/expert-reports" className="flex items-center gap-2">
                          <BarChart3 className="h-3 w-3" />
                          View Reports
                        </Link>
                      </Button>
                    </PermissionGuard>
                  </div>
                </CardContent>
              </Card>

              {/* No Access Notice */}
              {!hasPermission('manage_claimants') && 
               !hasPermission('manage_attorneys') && 
               !hasPermission('manage_experts') && 
               !hasPermission('manage_appointments') && 
               !hasPermission('manage_documents') && 
               !hasPermission('manage_leads') && 
               !isAdmin() && (
                <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg border-amber-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      Limited Access
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      You have limited permissions. Contact your administrator to request access to additional features.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Index;