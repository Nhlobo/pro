import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { 
  AlertTriangle, Calendar, Clock, DollarSign, Users, 
  Bell, Target, ArrowLeft, CheckCircle2, XCircle,
  Timer, TrendingUp, Zap, FileText, Stethoscope
} from "lucide-react";
import { format, differenceInDays, differenceInHours, addDays, isPast, isFuture, isToday, parseISO } from "date-fns";

const WorkflowAutomation = () => {
  const DATA_START_DATE = "2025-01-01T00:00:00";

  // Fetch appointments from 01 Jan 2025 to date
  const { data: allAppointments = [], isLoading: loadingAppointments } = useQuery({
    queryKey: ["workflow-all-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id, appointment_date, case_status, payment_status, service_fee, deposit_amount, matter_type,
          referring_attorney, referring_attorney_id,
          claimants (id, first_name, last_name, auto_id),
          medical_experts (id, first_name, last_name, expert_type)
        `)
        .is("deleted_at", null)
        .gte("appointment_date", DATA_START_DATE)
        .order("appointment_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Upcoming appointments (next 14 days) for deadline tracker
  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    const twoWeeksOut = addDays(now, 14);
    return allAppointments.filter((apt: any) => {
      const d = parseISO(apt.appointment_date);
      return d >= now && d <= twoWeeksOut;
    });
  }, [allAppointments]);

  // Fetch overdue reports
  const { data: overdueReports = [], isLoading: loadingReports } = useQuery({
    queryKey: ["workflow-overdue-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expert_reports")
        .select(`
          id, report_status, report_due_date, report_submitted_date, created_at,
          claimants (first_name, last_name),
          medical_experts (first_name, last_name, expert_type),
          appointments (id, appointment_date, referring_attorney, referring_attorney_id)
        `)
        .in("report_status", ["not_received", "in_progress", "under_review"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch unpaid invoices from 01 Jan 2025
  const { data: unpaidInvoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["workflow-unpaid-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id, appointment_date, payment_status, service_fee, deposit_amount, referring_attorney, referring_attorney_id,
          claimants (first_name, last_name, auto_id),
          medical_experts (expert_type)
        `)
        .is("deleted_at", null)
        .gte("appointment_date", DATA_START_DATE)
        .in("payment_status", ["pending", "partial"])
        .not("service_fee", "is", null)
        .order("appointment_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Group all appointments by claimant (multi-expert tracking)
  const claimantGroups = useMemo(() => {
    const groups = new Map<string, { claimant: any; appointments: any[] }>();
    allAppointments.forEach((apt: any) => {
      const key = apt.claimants?.id;
      if (!key) return;
      if (!groups.has(key)) {
        groups.set(key, { claimant: apt.claimants, appointments: [] });
      }
      groups.get(key)!.appointments.push(apt);
    });
    return Array.from(groups.values()).filter(g => g.appointments.length > 1);
  }, [allAppointments]);

  // Group all appointments by referring attorney
  const attorneyGroups = useMemo(() => {
    const groups = new Map<string, { name: string; appointments: any[] }>();
    allAppointments.forEach((apt: any) => {
      const key = apt.referring_attorney_id;
      if (!key) return;
      if (!groups.has(key)) {
        groups.set(key, { name: apt.referring_attorney, appointments: [] });
      }
      groups.get(key)!.appointments.push(apt);
    });
    return Array.from(groups.values()).filter(g => g.appointments.length > 0).sort((a, b) => b.appointments.length - a.appointments.length);
  }, [allAppointments]);

  // Deadline urgency calculator
  const getUrgency = (date: string) => {
    const days = differenceInDays(parseISO(date), new Date());
    if (days < 0) return { label: "Overdue", color: "bg-destructive text-destructive-foreground", priority: 0 };
    if (days === 0) return { label: "Today", color: "bg-destructive text-destructive-foreground", priority: 1 };
    if (days === 1) return { label: "Tomorrow", color: "bg-warning text-warning-foreground", priority: 2 };
    if (days <= 2) return { label: "48hrs", color: "bg-warning text-warning-foreground", priority: 3 };
    if (days <= 7) return { label: `${days}d`, color: "bg-kutlwano-blue/10 text-kutlwano-blue", priority: 4 };
    return { label: `${days}d`, color: "bg-muted text-muted-foreground", priority: 5 };
  };

  // Report overdue calculation
  const getReportUrgency = (report: any) => {
    const aptDate = report.appointments?.appointment_date;
    if (!aptDate) return { days: 0, label: "Unknown", color: "bg-muted" };
    const days = differenceInDays(new Date(), parseISO(aptDate));
    if (days > 45) return { days, label: `${days}d overdue`, color: "bg-destructive text-destructive-foreground" };
    if (days > 30) return { days, label: `${days}d pending`, color: "bg-warning text-warning-foreground" };
    if (days > 14) return { days, label: `${days}d pending`, color: "bg-kutlwano-blue/10 text-kutlwano-blue" };
    return { days, label: `${days}d`, color: "bg-muted text-muted-foreground" };
  };

  // Stats
  const stats = useMemo(() => {
    const today = upcomingAppointments.filter((a: any) => isToday(parseISO(a.appointment_date))).length;
    const next48 = upcomingAppointments.filter((a: any) => {
      const h = differenceInHours(parseISO(a.appointment_date), new Date());
      return h >= 0 && h <= 48;
    }).length;
    const criticalReports = overdueReports.filter((r: any) => {
      const aptDate = r.appointments?.appointment_date;
      return aptDate && differenceInDays(new Date(), parseISO(aptDate)) > 30;
    }).length;
    const totalUnpaid = unpaidInvoices.reduce((sum: number, inv: any) => {
      const balance = (inv.service_fee || 0) - (inv.deposit_amount || 0);
      return sum + Math.max(0, balance);
    }, 0);
    return { today, next48, criticalReports, totalUnpaid, multiExpert: claimantGroups.length };
  }, [upcomingAppointments, overdueReports, unpaidInvoices, claimantGroups]);

  const formatExpertType = (type: string) => {
    if (!type || type === "N/A") return "N/A";
    return type.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Workflow Automation - Medico-Legal System</title>
      </Helmet>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <Zap className="h-7 w-7 text-kutlwano-blue" />
                Workflow Automation Hub
              </h1>
              <p className="text-muted-foreground">Deadline tracking, reminders, and multi-expert coordination</p>
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-card border-border/50 shadow-soft">
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-3xl font-bold text-kutlwano-blue">{stats.today}</div>
              <p className="text-xs text-muted-foreground mt-1">Today's Assessments</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50 shadow-soft">
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-3xl font-bold text-warning">{stats.next48}</div>
              <p className="text-xs text-muted-foreground mt-1">Within 48 Hours</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50 shadow-soft">
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-3xl font-bold text-destructive">{stats.criticalReports}</div>
              <p className="text-xs text-muted-foreground mt-1">Overdue Reports (30d+)</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50 shadow-soft">
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-3xl font-bold text-kutlwano-teal">{stats.multiExpert}</div>
              <p className="text-xs text-muted-foreground mt-1">Multi-Expert Claimants</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50 shadow-soft">
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-2xl font-bold text-foreground">R{stats.totalUnpaid.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Unpaid Balances</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="deadlines" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="deadlines" className="gap-1.5"><Target className="h-4 w-4" /> Deadline Tracker</TabsTrigger>
            <TabsTrigger value="multi-expert" className="gap-1.5"><Users className="h-4 w-4" /> Multi-Expert View</TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5"><FileText className="h-4 w-4" /> Report Deadlines</TabsTrigger>
            <TabsTrigger value="invoices" className="gap-1.5"><DollarSign className="h-4 w-4" /> Invoice Tracking</TabsTrigger>
          </TabsList>

          {/* Deadline Tracker */}
          <TabsContent value="deadlines">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-kutlwano-blue" />
                  Upcoming Appointment Deadlines
                </CardTitle>
                <CardDescription>All assessments in the next 14 days, sorted by urgency</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAppointments ? (
                  <p className="text-muted-foreground text-center py-8">Loading...</p>
                ) : upcomingAppointments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No upcoming appointments in the next 14 days</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Urgency</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Claimant</TableHead>
                        <TableHead>Expert</TableHead>
                        <TableHead>Referring Attorney</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...upcomingAppointments]
                        .sort((a: any, b: any) => getUrgency(a.appointment_date).priority - getUrgency(b.appointment_date).priority)
                        .map((apt: any) => {
                          const urgency = getUrgency(apt.appointment_date);
                          return (
                            <TableRow key={apt.id}>
                              <TableCell>
                                <Badge className={urgency.color}>{urgency.label}</Badge>
                              </TableCell>
                              <TableCell className="font-medium">
                                {format(parseISO(apt.appointment_date), "dd MMM yyyy, HH:mm")}
                              </TableCell>
                              <TableCell>
                                {apt.claimants?.first_name} {apt.claimants?.last_name}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                                  {formatExpertType(apt.medical_experts?.expert_type || "N/A")}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{apt.referring_attorney}</TableCell>
                              <TableCell>
                                <Badge variant={apt.payment_status === "paid" ? "default" : "outline"} className={apt.payment_status === "paid" ? "bg-success/10 text-success" : apt.payment_status === "partial" ? "bg-warning/10 text-warning" : ""}>
                                  {apt.payment_status || "pending"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{apt.case_status}</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Multi-Expert View */}
          <TabsContent value="multi-expert">
            <div className="space-y-6">
              {/* Grouped by Claimant */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-kutlwano-teal" />
                    Claimants with Multiple Experts
                  </CardTitle>
                  <CardDescription>Claimants scheduled for assessments with 2+ experts since January 2025</CardDescription>
                </CardHeader>
                <CardContent>
                  {claimantGroups.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No multi-expert claimants in the upcoming period</p>
                  ) : (
                    <div className="space-y-4">
                      {claimantGroups.map((group) => (
                        <div key={group.claimant.id} className="border border-border/50 rounded-lg p-4 bg-muted/20">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-kutlwano-teal/10 rounded-full flex items-center justify-center">
                                <Users className="h-4 w-4 text-kutlwano-teal" />
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{group.claimant.first_name} {group.claimant.last_name}</p>
                                <p className="text-xs text-muted-foreground">ID: {group.claimant.auto_id}</p>
                              </div>
                            </div>
                            <Badge className="bg-kutlwano-teal/10 text-kutlwano-teal">{group.appointments.length} experts</Badge>
                          </div>
                          <div className="grid gap-2">
                            {group.appointments.map((apt: any) => {
                              const urgency = getUrgency(apt.appointment_date);
                              return (
                                <div key={apt.id} className="flex items-center justify-between bg-background rounded-md px-3 py-2 border border-border/30">
                                  <div className="flex items-center gap-3">
                                    <Badge className={`${urgency.color} text-xs`}>{urgency.label}</Badge>
                                    <span className="text-sm font-medium">{formatExpertType(apt.medical_experts?.expert_type)}</span>
                                  </div>
                                  <span className="text-sm text-muted-foreground">{format(parseISO(apt.appointment_date), "dd MMM, HH:mm")}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Grouped by Attorney */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-kutlwano-blue" />
                    Appointments by Referring Attorney
                  </CardTitle>
                  <CardDescription>Attorney appointment volume since January 2025</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {attorneyGroups.slice(0, 10).map((group) => (
                      <div key={group.name} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/30">
                        <div>
                          <p className="font-medium text-foreground">{group.name}</p>
                          <p className="text-xs text-muted-foreground">{group.appointments.length} assessment{group.appointments.length > 1 ? "s" : ""} scheduled</p>
                        </div>
                        <div className="flex gap-1">
                          {group.appointments.slice(0, 5).map((apt: any) => {
                            const urgency = getUrgency(apt.appointment_date);
                            return (
                              <Tooltip key={apt.id}>
                                <TooltipTrigger>
                                  <div className={`w-3 h-3 rounded-full ${urgency.priority <= 2 ? "bg-destructive" : urgency.priority <= 3 ? "bg-warning" : "bg-kutlwano-blue"}`} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{apt.claimants?.first_name} {apt.claimants?.last_name} - {format(parseISO(apt.appointment_date), "dd MMM HH:mm")}</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                          {group.appointments.length > 5 && <span className="text-xs text-muted-foreground ml-1">+{group.appointments.length - 5}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Report Deadlines */}
          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-warning" />
                  Outstanding Report Deadlines
                </CardTitle>
                <CardDescription>Reports pending from experts, sorted by days since assessment</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingReports ? (
                  <p className="text-muted-foreground text-center py-8">Loading...</p>
                ) : overdueReports.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No outstanding reports</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Days Pending</TableHead>
                        <TableHead>Claimant</TableHead>
                        <TableHead>Expert Type</TableHead>
                        <TableHead>Assessment Date</TableHead>
                        <TableHead>Referring Attorney</TableHead>
                        <TableHead>Report Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...overdueReports]
                        .sort((a: any, b: any) => {
                          const daysA = a.appointments?.appointment_date ? differenceInDays(new Date(), parseISO(a.appointments.appointment_date)) : 0;
                          const daysB = b.appointments?.appointment_date ? differenceInDays(new Date(), parseISO(b.appointments.appointment_date)) : 0;
                          return daysB - daysA;
                        })
                        .map((report: any) => {
                          const urgency = getReportUrgency(report);
                          return (
                            <TableRow key={report.id}>
                              <TableCell>
                                <Badge className={urgency.color}>{urgency.label}</Badge>
                              </TableCell>
                              <TableCell>{report.claimants?.first_name} {report.claimants?.last_name}</TableCell>
                              <TableCell>{formatExpertType(report.medical_experts?.expert_type || "N/A")}</TableCell>
                              <TableCell>
                                {report.appointments?.appointment_date
                                  ? format(parseISO(report.appointments.appointment_date), "dd MMM yyyy")
                                  : "N/A"}
                              </TableCell>
                              <TableCell>{report.appointments?.referring_attorney || "N/A"}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{report.report_status?.replace(/_/g, " ")}</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoice Tracking */}
          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-destructive" />
                  Unpaid Invoice Tracker
                </CardTitle>
                <CardDescription>Appointments with outstanding balances from referring attorneys</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingInvoices ? (
                  <p className="text-muted-foreground text-center py-8">Loading...</p>
                ) : unpaidInvoices.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">All invoices are paid</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Days Outstanding</TableHead>
                        <TableHead>Claimant</TableHead>
                        <TableHead>Expert Type</TableHead>
                        <TableHead>Referring Attorney</TableHead>
                        <TableHead>Fee</TableHead>
                        <TableHead>Deposit</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...unpaidInvoices]
                        .sort((a: any, b: any) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime())
                        .map((inv: any) => {
                          const daysOut = differenceInDays(new Date(), parseISO(inv.appointment_date));
                          const balance = Math.max(0, (inv.service_fee || 0) - (inv.deposit_amount || 0));
                          return (
                            <TableRow key={inv.id}>
                              <TableCell>
                                <Badge className={daysOut > 60 ? "bg-destructive text-destructive-foreground" : daysOut > 30 ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground"}>
                                  {daysOut}d
                                </Badge>
                              </TableCell>
                              <TableCell>{inv.claimants?.first_name} {inv.claimants?.last_name}</TableCell>
                              <TableCell>{formatExpertType(inv.medical_experts?.expert_type || "N/A")}</TableCell>
                              <TableCell>{inv.referring_attorney}</TableCell>
                              <TableCell>R{(inv.service_fee || 0).toLocaleString()}</TableCell>
                              <TableCell>R{(inv.deposit_amount || 0).toLocaleString()}</TableCell>
                              <TableCell className="font-semibold text-destructive">R{balance.toLocaleString()}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={inv.payment_status === "partial" ? "bg-warning/10 text-warning" : ""}>{inv.payment_status}</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default WorkflowAutomation;
