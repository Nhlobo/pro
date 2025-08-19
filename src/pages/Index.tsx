import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { 
  LogOut, User, ChevronDown, Settings, Users, Calendar, 
  FileText, TrendingUp, Activity, Clock, CheckCircle,
  AlertTriangle, Briefcase, UserCheck, BarChart3, PieChart as PieChartIcon,
  Stethoscope, Gavel, Building
} from "lucide-react";
import CompanyFooter from "@/components/CompanyFooter";

type Appointment = { id: number; claimant: string; date: string; status: string };

const Index = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = usePermissions();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [kpiData, setKpiData] = useState({ 
    totalAppointments: 0, 
    completedReports: 0, 
    pendingReports: 0,
    activeClaimants: 0,
    totalExperts: 0,
    monthlyGrowth: 0
  });

  useEffect(() => {
    const fetchAppointments = async () => {
      const mockData: Appointment[] = [
        { id: 1, claimant: "John Doe", date: "2025-06-10", status: "Completed" },
        { id: 2, claimant: "Jane Smith", date: "2025-06-12", status: "Pending" },
        { id: 3, claimant: "Mike Johnson", date: "2025-06-15", status: "In Progress" },
        { id: 4, claimant: "Sarah Wilson", date: "2025-06-18", status: "Completed" },
        { id: 5, claimant: "David Brown", date: "2025-06-20", status: "Scheduled" },
      ];
      setAppointments(mockData);
      setKpiData({
        totalAppointments: mockData.length,
        completedReports: mockData.filter((a) => a.status === "Completed").length,
        pendingReports: mockData.filter((a) => a.status === "Pending").length,
        activeClaimants: 24,
        totalExperts: 8,
        monthlyGrowth: 12.5
      });
    };
    fetchAppointments();
  }, []);

  const chartData = useMemo(() => (
    [
      { name: "Jan", leads: 30, reports: 25 },
      { name: "Feb", leads: 45, reports: 38 },
      { name: "Mar", leads: 60, reports: 52 },
      { name: "Apr", leads: 50, reports: 45 },
      { name: "May", leads: 75, reports: 68 },
      { name: "Jun", leads: 85, reports: 78 },
    ]
  ), []);

  const statusData = useMemo(() => (
    [
      { name: "Completed", value: kpiData.completedReports, color: "hsl(var(--success))" },
      { name: "Pending", value: kpiData.pendingReports, color: "hsl(var(--warning))" },
      { name: "In Progress", value: kpiData.totalAppointments - kpiData.completedReports - kpiData.pendingReports, color: "hsl(var(--info))" },
    ]
  ), [kpiData]);

  const quickStats = [
    { title: "Total Appointments", value: kpiData.totalAppointments, icon: Calendar, color: "bg-gradient-to-r from-blue-500 to-blue-600" },
    { title: "Completed Reports", value: kpiData.completedReports, icon: CheckCircle, color: "bg-gradient-to-r from-green-500 to-green-600" },
    { title: "Active Claimants", value: kpiData.activeClaimants, icon: Users, color: "bg-gradient-to-r from-purple-500 to-purple-600" },
    { title: "Medical Experts", value: kpiData.totalExperts, icon: Stethoscope, color: "bg-gradient-to-r from-teal-500 to-teal-600" },
  ];

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent-soft/30 to-background">
      <Helmet>
        <title>Medico-Legal Assessment System Dashboard</title>
        <meta name="description" content="Manage claimants, experts, appointments, reporting, and sales KPIs in a unified medico-legal dashboard." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      {/* Enhanced Header with animated background */}
      <header className="relative overflow-hidden border-b backdrop-blur-sm bg-background/80">
        <div className="absolute inset-0 bg-gradient-to-r from-kutlwano-blue/5 via-kutlwano-teal/5 to-kutlwano-blue/5" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-kutlwano-blue/10 rounded-full blur-3xl animate-float" />
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-kutlwano-teal/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
        </div>
        
        <div className="relative container mx-auto px-4 py-8">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-6">
              <div className="relative">
                <img 
                  src="/lovable-uploads/d45f27ec-34bf-470c-bc47-015dff5748e0.png" 
                  alt="Kutlwano & Associate Logo" 
                  className="h-16 object-contain filter drop-shadow-lg"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-kutlwano-blue/20 to-kutlwano-teal/20 rounded-lg blur-xl" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-kutlwano-blue via-kutlwano-teal to-kutlwano-blue bg-clip-text text-transparent animate-fade-in">
                  Medico-Legal Assessment System
                </h1>
                <p className="text-muted-foreground mt-2 max-w-2xl animate-fade-in" style={{ animationDelay: '0.2s' }}>
                  Comprehensive management of claimants, experts, and appointments with advanced reporting and analytics.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="secondary" className="bg-gradient-to-r from-kutlwano-blue/10 to-kutlwano-teal/10 text-kutlwano-blue border-kutlwano-blue/20">
                    <Activity className="h-3 w-3 mr-1" />
                    System Active
                  </Badge>
                  <Badge variant="outline" className="text-green-600 border-green-200">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +{kpiData.monthlyGrowth}% Growth
                  </Badge>
                </div>
              </div>
            </div>
            
            {/* Enhanced User Section */}
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-card/50 backdrop-blur-sm rounded-lg border border-border/50">
                <div className="p-2 bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal rounded-full">
                  <User className="h-4 w-4 text-white" />
                </div>
                <div className="text-sm">
                  <p className="font-medium text-foreground">{user?.email}</p>
                  <p className="text-muted-foreground text-xs">
                    {isAdmin() ? 'Administrator' : 'User'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {isAdmin() && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.location.href = '/user-management'}
                    className="bg-card/50 backdrop-blur-sm hover:bg-accent transition-all duration-300 hover:scale-105"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    User Management
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={signOut}
                  className="bg-card/50 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground transition-all duration-300"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Enhanced Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Quick Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {quickStats.map((stat, index) => (
            <Card key={stat.title} className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 animate-fade-in border-border/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm" style={{ animationDelay: `${index * 0.1}s` }}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-bold text-foreground mt-2 group-hover:scale-110 transition-transform duration-300">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.color} group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="core" className="w-full">
          <TabsList className="mb-6 bg-card/50 backdrop-blur-sm border border-border/50 p-1">
            <TabsTrigger value="core" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-kutlwano-blue data-[state=active]:to-kutlwano-teal data-[state=active]:text-white transition-all duration-300">
              <Briefcase className="h-4 w-4 mr-2" />
              Core Management
            </TabsTrigger>
            <TabsTrigger value="reporting" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-kutlwano-blue data-[state=active]:to-kutlwano-teal data-[state=active]:text-white transition-all duration-300">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics & Reporting
            </TabsTrigger>
            <TabsTrigger value="sales" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-kutlwano-blue data-[state=active]:to-kutlwano-teal data-[state=active]:text-white transition-all duration-300">
              <TrendingUp className="h-4 w-4 mr-2" />
              Leads & Sales
            </TabsTrigger>
          </TabsList>

          <TabsContent value="core" asChild>
            <section aria-labelledby="core-title">
              <Card className="bg-gradient-to-br from-card to-card/50 backdrop-blur-sm border-border/50 shadow-xl">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal rounded-lg">
                      <Briefcase className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle id="core-title" className="text-2xl font-bold">Core Management Functions</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-8">
                  {/* Enhanced Grid Layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                    {/* Claimant Functions */}
                    <div className="space-y-4 group">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg group-hover:scale-110 transition-transform duration-300">
                          <Users className="h-5 w-5 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">Claimant Management</h3>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full h-12 bg-card/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-blue-500 hover:to-blue-600 hover:text-white transition-all duration-300 group-hover:scale-105">
                            Claimant Options
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 bg-card/95 backdrop-blur-sm border-border/50">
                          <DropdownMenuItem asChild>
                            <Link to="/claimant" className="w-full flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Add Claimant
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/claimant-list" className="w-full flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Claimant List
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/claimant-reports" className="w-full flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Claimant Reports
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Attorneys Functions */}
                    <div className="space-y-4 group">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg group-hover:scale-110 transition-transform duration-300">
                          <Gavel className="h-5 w-5 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">Attorney Management</h3>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full h-12 bg-card/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-purple-500 hover:to-purple-600 hover:text-white transition-all duration-300 group-hover:scale-105">
                            Attorney Options
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 bg-card/95 backdrop-blur-sm border-border/50">
                          <DropdownMenuItem asChild>
                            <Link to="/referring-attorney" className="w-full flex items-center gap-2">
                              <UserCheck className="h-4 w-4" />
                              Add Referring Attorney
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/referring-attorney-list" className="w-full flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Attorney List
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/referring-attorney-report" className="w-full flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Attorney Reports
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Medical Expert Functions */}
                    <div className="space-y-4 group">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-gradient-to-r from-teal-500 to-teal-600 rounded-lg group-hover:scale-110 transition-transform duration-300">
                          <Stethoscope className="h-5 w-5 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">Medical Experts</h3>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full h-12 bg-card/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-teal-500 hover:to-teal-600 hover:text-white transition-all duration-300 group-hover:scale-105">
                            Expert Options
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 bg-card/95 backdrop-blur-sm border-border/50">
                          <DropdownMenuItem asChild>
                            <Link to="/medical-expert" className="w-full flex items-center gap-2">
                              <UserCheck className="h-4 w-4" />
                              Add Medical Expert
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/medical-expert-directory" className="w-full flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Expert Directory
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/report-tracking" className="w-full flex items-center gap-2">
                              <Activity className="h-4 w-4" />
                              Report Tracking
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Assessment Schedule Functions */}
                    <div className="space-y-4 group">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-gradient-to-r from-green-500 to-green-600 rounded-lg group-hover:scale-110 transition-transform duration-300">
                          <Calendar className="h-5 w-5 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">Assessment Schedule</h3>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full h-12 bg-card/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-green-500 hover:to-green-600 hover:text-white transition-all duration-300 group-hover:scale-105">
                            Schedule Options
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 bg-card/95 backdrop-blur-sm border-border/50">
                          <DropdownMenuItem asChild>
                            <Link to="/new-appointment" className="w-full flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              New Appointment
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/scheduled-assessment" className="w-full flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              Scheduled Assessments
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/assessment-reports-statistics" className="w-full flex items-center gap-2">
                              <BarChart3 className="h-4 w-4" />
                              Reports & Statistics
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Additional Functions */}
                  <div className="mt-8 pt-8 border-t border-border/50">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg">
                        <Building className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">Additional Functions</h3>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <Button asChild variant="outline" className="bg-card/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-orange-500 hover:to-orange-600 hover:text-white transition-all duration-300 hover:scale-105">
                        <Link to="/document-uploading" className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Document Management
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="reporting" asChild>
            <section aria-labelledby="reporting-title">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* KPI Cards */}
                <div className="lg:col-span-2 space-y-6">
                  <Card className="bg-gradient-to-br from-card to-card/50 backdrop-blur-sm border-border/50 shadow-xl">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal rounded-lg">
                          <BarChart3 className="h-5 w-5 text-white" />
                        </div>
                        <CardTitle id="reporting-title" className="text-2xl font-bold">Analytics Dashboard</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Enhanced KPI Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="group p-6 rounded-xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-800 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-medium text-green-600 dark:text-green-400">Completed Reports</h3>
                              <p className="text-3xl font-bold text-green-700 dark:text-green-300 mt-2 group-hover:scale-110 transition-transform duration-300">
                                {kpiData.completedReports}
                              </p>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-500" />
                          </div>
                        </div>
                        
                        <div className="group p-6 rounded-xl bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border border-yellow-200 dark:border-yellow-800 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Pending Reports</h3>
                              <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-300 mt-2 group-hover:scale-110 transition-transform duration-300">
                                {kpiData.pendingReports}
                              </p>
                            </div>
                            <Clock className="h-8 w-8 text-yellow-500" />
                          </div>
                        </div>
                        
                        <div className="group p-6 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Appointments</h3>
                              <p className="text-3xl font-bold text-blue-700 dark:text-blue-300 mt-2 group-hover:scale-110 transition-transform duration-300">
                                {kpiData.totalAppointments}
                              </p>
                            </div>
                            <Calendar className="h-8 w-8 text-blue-500" />
                          </div>
                        </div>
                      </div>

                      {/* Enhanced Performance Chart */}
                      <div className="mt-8">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-kutlwano-blue" />
                          Monthly Performance Trends
                        </h3>
                        <div className="h-80 bg-gradient-to-r from-background/50 to-accent-soft/30 rounded-lg p-4 border border-border/50">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                              <YAxis stroke="hsl(var(--muted-foreground))" />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: 'hsl(var(--card))', 
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px'
                                }} 
                              />
                              <Bar dataKey="leads" fill="hsl(var(--kutlwano-blue))" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="reports" fill="hsl(var(--kutlwano-teal))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Status Distribution */}
                <div className="space-y-6">
                  <Card className="bg-gradient-to-br from-card to-card/50 backdrop-blur-sm border-border/50 shadow-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PieChartIcon className="h-5 w-5 text-kutlwano-blue" />
                        Status Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={statusData}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={80}
                              dataKey="value"
                              stroke="none"
                            >
                              {statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-4 space-y-2">
                        {statusData.map((item, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                              <span>{item.name}</span>
                            </div>
                            <Badge variant="secondary">{item.value}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Recent Appointments Table */}
              <Card className="mt-8 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm border-border/50 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-kutlwano-blue" />
                    Recent Appointments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-lg border border-border/50">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[80px] font-semibold">ID</TableHead>
                          <TableHead className="font-semibold">Claimant</TableHead>
                          <TableHead className="font-semibold">Date</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {appointments.map((appt) => (
                          <TableRow key={appt.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-medium">{appt.id}</TableCell>
                            <TableCell>{appt.claimant}</TableCell>
                            <TableCell>{appt.date}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={appt.status === 'Completed' ? 'default' : appt.status === 'Pending' ? 'secondary' : 'outline'}
                                className={
                                  appt.status === 'Completed' ? 'bg-green-100 text-green-800 border-green-200' :
                                  appt.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                  'bg-blue-100 text-blue-800 border-blue-200'
                                }
                              >
                                {appt.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="sales" asChild>
            <section aria-labelledby="sales-title">
              <Card className="bg-gradient-to-br from-card to-card/50 backdrop-blur-sm border-border/50 shadow-xl">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal rounded-lg">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle id="sales-title" className="text-2xl font-bold">Leads & Sales Management</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-8">
                  {/* Enhanced Action Buttons */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Button asChild variant="outline" className="h-16 bg-card/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-blue-500 hover:to-blue-600 hover:text-white transition-all duration-300 hover:scale-105">
                      <Link to="/lead-generator" className="flex flex-col items-center gap-2">
                        <Activity className="h-5 w-5" />
                        <span>Lead Generator (API Search)</span>
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="h-16 bg-card/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-green-500 hover:to-green-600 hover:text-white transition-all duration-300 hover:scale-105">
                      <Link to="/lead-history" className="flex flex-col items-center gap-2">
                        <Clock className="h-5 w-5" />
                        <span>Lead History</span>
                      </Link>
                    </Button>
                    <Button variant="outline" className="h-16 bg-card/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-purple-500 hover:to-purple-600 hover:text-white transition-all duration-300 hover:scale-105">
                      <div className="flex flex-col items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        <span>Targets (Monthly/Quarterly/Yearly)</span>
                      </div>
                    </Button>
                    <Button variant="outline" className="h-16 bg-card/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-orange-500 hover:to-orange-600 hover:text-white transition-all duration-300 hover:scale-105">
                      <div className="flex flex-col items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        <span>Financial Analysis</span>
                      </div>
                    </Button>
                    <Button variant="outline" className="h-16 bg-card/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 hover:text-white transition-all duration-300 hover:scale-105">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-5 w-5" />
                        <span>Expert Debts Payment</span>
                      </div>
                    </Button>
                  </div>

                  {/* Enhanced Chart */}
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-kutlwano-blue" />
                      Lead Generation Performance
                    </h3>
                    <div className="h-80 bg-gradient-to-r from-background/50 to-accent-soft/30 rounded-lg p-4 border border-border/50">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                          <YAxis stroke="hsl(var(--muted-foreground))" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }} 
                          />
                          <Bar dataKey="leads" fill="hsl(var(--kutlwano-blue))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </TabsContent>
        </Tabs>
      </main>
      <CompanyFooter />
    </div>
  );
};

export default Index;
