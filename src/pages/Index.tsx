import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, User, ChevronDown } from "lucide-react";
import CompanyFooter from "@/components/CompanyFooter";

type Appointment = { id: number; claimant: string; date: string; status: string };

const Index = () => {
  const { user, signOut } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [kpiData, setKpiData] = useState({ totalAppointments: 0, completedReports: 0 });

  useEffect(() => {
    const fetchAppointments = async () => {
      const mockData: Appointment[] = [
        { id: 1, claimant: "John Doe", date: "2025-06-10", status: "Completed" },
        { id: 2, claimant: "Jane Smith", date: "2025-06-12", status: "Pending" },
      ];
      setAppointments(mockData);
      setKpiData({
        totalAppointments: mockData.length,
        completedReports: mockData.filter((a) => a.status === "Completed").length,
      });
    };
    fetchAppointments();
  }, []);

  const chartData = useMemo(() => (
    [
      { name: "Jan", leads: 30 },
      { name: "Feb", leads: 45 },
      { name: "Mar", leads: 60 },
      { name: "Apr", leads: 50 },
    ]
  ), []);

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/';

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Medico-Legal Assessment System Dashboard</title>
        <meta name="description" content="Manage claimants, experts, appointments, reporting, and sales KPIs in a unified medico-legal dashboard." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <header className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 opacity-70 blur-3xl bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.25),transparent_60%)]" />
        <div className="container mx-auto px-4 py-10">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-6">
              <img 
                src="/lovable-uploads/d45f27ec-34bf-470c-bc47-015dff5748e0.png" 
                alt="Kutlwano & Associate Logo" 
                className="h-16 object-contain"
              />
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal bg-clip-text text-transparent">
                  Medico-Legal Assessment System
                </h1>
                <p className="text-muted-foreground mt-2 max-w-2xl">Core management of claimants, experts, and appointments with reporting and sales insights.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{user?.email}</span>
              </div>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="core" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="core">Core Management</TabsTrigger>
            <TabsTrigger value="reporting">Reporting</TabsTrigger>
            <TabsTrigger value="sales">Leads & Sales</TabsTrigger>
          </TabsList>

          <TabsContent value="core" asChild>
            <section aria-labelledby="core-title">
              <Card>
                <CardContent className="space-y-4 p-6">
                  <h2 id="core-title" className="text-xl font-semibold mb-6">Core Management</h2>
                  
                  {/* Horizontal Layout for Core Management Functions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Claimant Functions */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-medium text-foreground border-b border-border pb-2">
                        Claimant
                      </h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="soft" className="w-full">
                            Claimant Functions
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                          <DropdownMenuItem asChild>
                            <Link to="/claimant" className="w-full">Add Claimant</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/claimant-list" className="w-full">Claimant List</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/claimant-reports" className="w-full">Claimant Report</Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Attorneys Functions */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-medium text-foreground border-b border-border pb-2">
                        Attorneys
                      </h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="soft" className="w-full">
                            Attorneys Functions
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                          <DropdownMenuItem asChild>
                            <Link to="/referring-attorney" className="w-full">Add Referring Attorney</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/referring-attorney-list" className="w-full">Referring Attorney List</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/referring-attorney-report" className="w-full">Referring Attorney Report</Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Medical Expert Functions */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-medium text-foreground border-b border-border pb-2">
                        Medical Expert
                      </h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="soft" className="w-full">
                            Medical Expert Functions
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                          <DropdownMenuItem asChild>
                            <Link to="/medical-expert" className="w-full">Add Medical Expert</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/medical-expert-directory" className="w-full">Medical Expert List</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/report-tracking" className="w-full">Report Tracking</Link>
                          </DropdownMenuItem>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <DropdownMenuItem className="flex items-center justify-between cursor-pointer">
                                <span>Report</span>
                                <ChevronDown className="ml-2 h-4 w-4" />
                              </DropdownMenuItem>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" side="right">
                              <DropdownMenuItem asChild>
                                <Link to="/reports/monthly" className="w-full">Monthly</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link to="/reports/quarterly" className="w-full">Quarterly</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link to="/reports/yearly" className="w-full">Yearly</Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Assessment Schedule Functions */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-medium text-foreground border-b border-border pb-2">
                        Assessment Schedule
                      </h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="soft" className="w-full">
                            Assessment Schedule Functions
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                          <DropdownMenuItem asChild>
                            <Link to="/new-appointment" className="w-full">New Appointment</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/scheduled-assessment" className="w-full">Scheduled Assessment</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/assessment-reports-statistics" className="w-full">Report & Statistic</Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Other Functions */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-medium text-foreground border-b border-border pb-2">
                      Other Functions
                    </h3>
                    <div className="flex flex-wrap gap-3 pl-4">
                      <Button asChild variant="soft">
                        <Link to="/document-uploading">Document Uploading</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="reporting" asChild>
            <section aria-labelledby="reporting-title">
              <Card>
                <CardContent className="space-y-6 p-6">
                  <h2 id="reporting-title" className="text-xl font-semibold">Reporting Dashboard</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-lg border bg-secondary p-4">
                      <h3 className="font-medium text-sm text-muted-foreground">Total Appointments</h3>
                      <p className="text-3xl font-semibold mt-1">{kpiData.totalAppointments}</p>
                    </div>
                    <div className="rounded-lg border bg-secondary p-4">
                      <h3 className="font-medium text-sm text-muted-foreground">Completed Reports</h3>
                      <p className="text-3xl font-semibold mt-1">{kpiData.completedReports}</p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[80px]">ID</TableHead>
                          <TableHead>Claimant</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {appointments.map((appt) => (
                          <TableRow key={appt.id}>
                            <TableCell>{appt.id}</TableCell>
                            <TableCell>{appt.claimant}</TableCell>
                            <TableCell>{appt.date}</TableCell>
                            <TableCell>{appt.status}</TableCell>
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
              <Card>
                <CardContent className="space-y-6 p-6">
                  <h2 id="sales-title" className="text-xl font-semibold">Leads and Sales</h2>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild variant="soft">
                      <Link to="/lead-generator">Lead Generator (API Search)</Link>
                    </Button>
                    <Button asChild variant="soft">
                      <Link to="/lead-history">Lead History</Link>
                    </Button>
                    <Button variant="soft">Targets (Monthly/Quarterly/Yearly)</Button>
                    <Button variant="soft">Financial Analysis</Button>
                    <Button variant="soft">Expert Debts Payment</Button>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="leads" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
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
