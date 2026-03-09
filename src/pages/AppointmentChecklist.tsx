import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Calendar, ClipboardCheck, Download, Search, UserCheck, ShieldCheck, RefreshCw } from "lucide-react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { todayInSAST, nowInSAST, formatDateTimeShort } from "@/utils/dateTime";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import CompanyFooter from "@/components/CompanyFooter";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from "@/utils/pdfBranding";

type ChecklistEntry = {
  appointment_id: string;
  claimant_name: string;
  referring_attorney: string;
  expert_name: string;
  expert_type: string;
  appointment_date: string;
  attendance_status: string;
  coordinator_signoff_name: string | null;
  coordinator_signoff_at: string | null;
  manager_signoff_name: string | null;
  manager_signoff_at: string | null;
  checklist_id: string | null;
  transport_required: boolean;
  all_documents_received: boolean;
};

// Each expert for a claimant now tracks its own attendance
type ExpertEntry = {
  name: string;
  type: string;
  appointment_id: string;
  checklist_id: string | null;
  attendance_status: string;
};

type GroupedClaimant = {
  claimant_name: string;
  referring_attorney: string;
  experts: ExpertEntry[];
  // Sign-off is per-day-group (stored on primary appointment)
  coordinator_signoff_name: string | null;
  coordinator_signoff_at: string | null;
  manager_signoff_name: string | null;
  manager_signoff_at: string | null;
  primary_appointment_id: string;
  checklist_id: string | null;
};

type DayGroup = {
  date: string;
  claimants: GroupedClaimant[];
};

const AppointmentChecklist: React.FC = () => {
  const [entries, setEntries] = useState<ChecklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(todayInSAST());
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchChecklist = useCallback(async () => {
    setLoading(true);
    try {
      const { data: appointments, error } = await supabase
        .from("appointments")
        .select(`
          id,
          appointment_date,
          claimants!inner(first_name, last_name),
          medical_experts!inner(first_name, last_name, expert_type),
          referring_attorneys!inner(name)
        `)
        .is("deleted_at", null)
        .order("appointment_date", { ascending: true });

      if (error) throw error;

      const appointmentIds = (appointments || []).map((a: any) => a.id);
      let checklistMap: Record<string, any> = {};

      if (appointmentIds.length > 0) {
        for (let i = 0; i < appointmentIds.length; i += 100) {
          const chunk = appointmentIds.slice(i, i + 100);
          const { data: checklistData } = await supabase
            .from("appointment_checklist")
            .select("*")
            .in("appointment_id", chunk);

          (checklistData || []).forEach((c: any) => {
            checklistMap[c.appointment_id] = c;
          });
        }
      }

      const mapped: ChecklistEntry[] = (appointments || []).map((a: any) => {
        const cl = checklistMap[a.id];
        return {
          appointment_id: a.id,
          claimant_name: `${a.claimants?.first_name || ""} ${a.claimants?.last_name || ""}`.trim(),
          referring_attorney: a.referring_attorneys?.name || "N/A",
          expert_name: `${a.medical_experts?.first_name || ""} ${a.medical_experts?.last_name || ""}`.trim(),
          expert_type: a.medical_experts?.expert_type || "N/A",
          appointment_date: a.appointment_date,
          attendance_status: cl?.attendance_status || "pending",
          coordinator_signoff_name: cl?.coordinator_signoff_name || null,
          coordinator_signoff_at: cl?.coordinator_signoff_at || null,
          manager_signoff_name: cl?.manager_signoff_name || null,
          manager_signoff_at: cl?.manager_signoff_at || null,
          checklist_id: cl?.id || null,
        };
      });

      setEntries(mapped);
    } catch (err: any) {
      console.error("Error fetching checklist:", err);
      toast({ title: "Error", description: "Failed to load checklist data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  // Group by date → claimant, preserving per-expert attendance
  const dayGroups = useMemo<DayGroup[]>(() => {
    const filtered = entries.filter((e) => {
      const entryDate = format(parseISO(e.appointment_date), "yyyy-MM-dd");
      const matchesDate = entryDate === selectedDate;
      const matchesSearch =
        !searchTerm ||
        e.claimant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.referring_attorney.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesDate && matchesSearch;
    });

    const byDate: Record<string, ChecklistEntry[]> = {};
    filtered.forEach((e) => {
      const dk = format(parseISO(e.appointment_date), "yyyy-MM-dd");
      if (!byDate[dk]) byDate[dk] = [];
      byDate[dk].push(e);
    });

    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayEntries]) => {
        // Group by claimant name within each day
        const claimantMap: Record<string, GroupedClaimant> = {};
        dayEntries.forEach((e) => {
          const key = e.claimant_name;
          if (!claimantMap[key]) {
            claimantMap[key] = {
              claimant_name: e.claimant_name,
              referring_attorney: e.referring_attorney,
              experts: [],
              coordinator_signoff_name: e.coordinator_signoff_name,
              coordinator_signoff_at: e.coordinator_signoff_at,
              manager_signoff_name: e.manager_signoff_name,
              manager_signoff_at: e.manager_signoff_at,
              primary_appointment_id: e.appointment_id,
              checklist_id: e.checklist_id,
            };
          }
          claimantMap[key].experts.push({
            name: e.expert_name,
            type: e.expert_type,
            appointment_id: e.appointment_id,
            checklist_id: e.checklist_id,
            attendance_status: e.attendance_status,
          });
        });

        return { date, claimants: Object.values(claimantMap) };
      });
  }, [entries, selectedDate, searchTerm]);

  // Summary counts based on individual expert appointments
  const attendanceCounts = useMemo(() => {
    const allExperts = dayGroups.flatMap((dg) => dg.claimants.flatMap((c) => c.experts));
    return {
      total: allExperts.length,
      assessed: allExperts.filter((e) => e.attendance_status === "attended").length,
      missed: allExperts.filter((e) => e.attendance_status === "missed").length,
      cancelled: allExperts.filter((e) => e.attendance_status === "cancelled").length,
      pending: allExperts.filter((e) => e.attendance_status === "pending").length,
    };
  }, [dayGroups]);

  const formatExpertType = (type: string) => {
    if (!type || type === "N/A") return "N/A";
    return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const upsertChecklist = async (
    appointmentId: string,
    checklistId: string | null,
    updates: Record<string, any>
  ) => {
    setSaving(appointmentId);
    try {
      if (checklistId) {
        const { error } = await supabase
          .from("appointment_checklist")
          .update(updates)
          .eq("id", checklistId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("appointment_checklist")
          .insert({ appointment_id: appointmentId, ...updates });
        if (error) throw error;
      }

      toast({ title: "Saved", description: "Checklist updated successfully." });
      await fetchChecklist();
    } catch (err: any) {
      console.error("Error saving checklist:", err);
      toast({ title: "Error", description: "Failed to save checklist update.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  // Per-expert attendance change (uses that expert's own appointment_id/checklist_id)
  const handleExpertAttendanceChange = (expert: ExpertEntry, status: string) => {
    upsertChecklist(expert.appointment_id, expert.checklist_id, {
      attendance_status: status,
    });
  };

  const handleCoordinatorSignoff = (claimant: GroupedClaimant) => {
    const name = prompt("Enter Coordinator Name for sign-off:");
    if (!name) return;
    upsertChecklist(claimant.primary_appointment_id, claimant.checklist_id, {
      coordinator_signoff_name: name,
      coordinator_signoff_at: nowInSAST().toISOString(),
    });
  };

  const handleManagerSignoff = (claimant: GroupedClaimant) => {
    const name = prompt("Enter Manager Name for sign-off:");
    if (!name) return;
    upsertChecklist(claimant.primary_appointment_id, claimant.checklist_id, {
      manager_signoff_name: name,
      manager_signoff_at: nowInSAST().toISOString(),
    });
  };

  const getAttendanceBadge = (status: string) => {
    switch (status) {
      case "attended":
        return <Badge className="bg-success/10 text-success border-success/20">Assessed</Badge>;
      case "missed":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Missed</Badge>;
      case "cancelled":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Cancelled</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Pending</Badge>;
    }
  };

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return `Today — ${format(date, "dd MMMM yyyy")}`;
    if (isTomorrow(date)) return `Tomorrow — ${format(date, "dd MMMM yyyy")}`;
    return format(date, "EEEE, dd MMMM yyyy");
  };

  const downloadPDF = () => {
    if (dayGroups.length === 0) return;

    const generatedAt = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "long", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
    const doc = new jsPDF("landscape");
    const startY = addBrandingToPDF(doc, "APPOINTMENT CHECKLIST", `Date: ${getDateLabel(selectedDate)}`);

    // Each expert row is its own row for per-expert attendance
    const rows = dayGroups.flatMap((dg) =>
      dg.claimants.flatMap((c, ci) =>
        c.experts.map((exp, ei) => [
          ei === 0 ? format(parseISO(dg.date), "dd/MM/yyyy") : "",
          ei === 0 ? c.claimant_name : "",
          ei === 0 ? c.referring_attorney : "",
          formatExpertType(exp.type),
          exp.attendance_status === "attended"
            ? "Assessed"
            : exp.attendance_status.charAt(0).toUpperCase() + exp.attendance_status.slice(1),
        ])
      )
    );

    autoTable(doc, {
      ...getStyledTableOptions(),
      startY: startY + 5,
      head: [["Date", "Claimant Name", "Referring Attorney", "Expert Type", "Attendance"]],
      body: rows,
      columnStyles: {
        3: { cellWidth: 55 },
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    const summaryY = finalY + 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Summary:", 14, summaryY);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Total Appointments: ${attendanceCounts.total}    |    Assessed: ${attendanceCounts.assessed}    |    Missed: ${attendanceCounts.missed}    |    Cancelled: ${attendanceCounts.cancelled}    |    Pending: ${attendanceCounts.pending}`,
      14,
      summaryY + 6
    );

    const signOffY = summaryY + 18;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Coordinator Sign-off:", 14, signOffY);
    doc.setFont("helvetica", "normal");

    const firstClaimant = dayGroups[0]?.claimants[0];
    if (firstClaimant?.coordinator_signoff_name) {
      doc.text(
        `${firstClaimant.coordinator_signoff_name}  —  ${format(parseISO(firstClaimant.coordinator_signoff_at!), "dd MMM yyyy 'at' HH:mm")}`,
        14,
        signOffY + 6
      );
    } else {
      doc.text("________________________", 14, signOffY + 6);
    }

    doc.setFont("helvetica", "bold");
    doc.text("Case Manager Sign-off:", 160, signOffY);
    doc.setFont("helvetica", "normal");

    if (firstClaimant?.manager_signoff_name) {
      doc.text(
        `${firstClaimant.manager_signoff_name}  —  ${format(parseISO(firstClaimant.manager_signoff_at!), "dd MMM yyyy 'at' HH:mm")}`,
        160,
        signOffY + 6
      );
    } else {
      doc.text("________________________", 160, signOffY + 6);
    }

    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(`Generated: ${generatedAt}`, doc.internal.pageSize.getWidth() - 14, signOffY + 16, { align: "right" });
    doc.setTextColor(0, 0, 0);

    addBrandingFooter(doc);
    doc.save(`Appointment_Checklist_${selectedDate}.pdf`);
  };

  return (
    <>
      <Helmet>
        <title>Appointment Checklist | KA Medico-Legal</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <ClipboardCheck className="h-7 w-7 text-primary" />
                  Appointment Checklist
                </h1>
                <p className="text-sm text-muted-foreground">
                  Daily grouped checklist for claimant assessments
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchChecklist} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={downloadPDF} disabled={dayGroups.length === 0}>
                <Download className="h-4 w-4 mr-1" />
                Download PDF
              </Button>
            </div>
          </div>

          {/* Filters */}
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="max-w-[200px]"
                  />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search claimant or attorney..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-[300px]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Counts (per expert appointment) */}
          {!loading && dayGroups.length > 0 && (
            <div className="flex flex-wrap gap-3">
              <Badge variant="secondary" className="text-sm px-3 py-1">Total Appointments: {attendanceCounts.total}</Badge>
              <Badge className="bg-success/10 text-success border-success/20 text-sm px-3 py-1">Assessed: {attendanceCounts.assessed}</Badge>
              <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-sm px-3 py-1">Missed: {attendanceCounts.missed}</Badge>
              <Badge className="bg-warning/10 text-warning border-warning/20 text-sm px-3 py-1">Cancelled: {attendanceCounts.cancelled}</Badge>
              <Badge variant="outline" className="text-sm px-3 py-1 text-muted-foreground">Pending: {attendanceCounts.pending}</Badge>
            </div>
          )}

          {/* Checklist Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
            </div>
          ) : dayGroups.length === 0 ? (
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="py-12 text-center">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No appointments found for {getDateLabel(selectedDate)}</p>
              </CardContent>
            </Card>
          ) : (
            dayGroups.map((dg) => (
              <Card key={dg.date} className="bg-gradient-card border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="h-5 w-5 text-primary" />
                    {getDateLabel(dg.date)}
                    <Badge variant="secondary" className="ml-2">{dg.claimants.length} claimant(s)</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Claimant Name</TableHead>
                          <TableHead>Referring Attorney</TableHead>
                          <TableHead>Expert Type</TableHead>
                          <TableHead>Attendance Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dg.claimants.map((claimant) =>
                          claimant.experts.map((exp, expIdx) => (
                            <TableRow
                              key={exp.appointment_id}
                              className={expIdx > 0 ? "border-t-0" : ""}
                            >
                              {/* Only show claimant name & attorney on the first expert row */}
                              {expIdx === 0 ? (
                                <>
                                  <TableCell
                                    className="font-medium align-top"
                                    rowSpan={claimant.experts.length > 1 ? claimant.experts.length : undefined}
                                  >
                                    <div className="font-semibold">{claimant.claimant_name}</div>
                                    {claimant.experts.length > 1 && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {claimant.experts.length} experts scheduled
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell
                                    className="align-top"
                                    rowSpan={claimant.experts.length > 1 ? claimant.experts.length : undefined}
                                  >
                                    {claimant.referring_attorney}
                                  </TableCell>
                                </>
                              ) : null}
                              <TableCell>
                                <Badge variant="outline" className="text-xs whitespace-nowrap">
                                  {formatExpertType(exp.type)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <Select
                                    value={exp.attendance_status}
                                    onValueChange={(val) => handleExpertAttendanceChange(exp, val)}
                                    disabled={saving === exp.appointment_id}
                                  >
                                    <SelectTrigger className="w-[130px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">Pending</SelectItem>
                                      <SelectItem value="attended">Assessed</SelectItem>
                                      <SelectItem value="missed">Missed</SelectItem>
                                      <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {getAttendanceBadge(exp.attendance_status)}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <Separator className="my-4" />

                  {/* Sign-off Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border border-border/50 rounded-lg p-4 space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        Coordinator Sign-off
                      </h4>
                      {(() => {
                        const firstClaimant = dg.claimants[0];
                        if (firstClaimant?.coordinator_signoff_name) {
                          return (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-success">
                                <ShieldCheck className="h-5 w-5" />
                                <span className="font-medium">{firstClaimant.coordinator_signoff_name}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Signed: {format(parseISO(firstClaimant.coordinator_signoff_at!), "dd MMM yyyy 'at' HH:mm")}
                              </p>
                            </div>
                          );
                        }
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => firstClaimant && handleCoordinatorSignoff(firstClaimant)}
                            disabled={!firstClaimant || saving === firstClaimant?.primary_appointment_id}
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            Sign Off
                          </Button>
                        );
                      })()}
                    </div>

                    <div className="border border-border/50 rounded-lg p-4 space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        Case Manager Sign-off
                      </h4>
                      {(() => {
                        const firstClaimant = dg.claimants[0];
                        if (firstClaimant?.manager_signoff_name) {
                          return (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-primary">
                                <ShieldCheck className="h-5 w-5" />
                                <span className="font-medium">{firstClaimant.manager_signoff_name}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Signed: {format(parseISO(firstClaimant.manager_signoff_at!), "dd MMM yyyy 'at' HH:mm")}
                              </p>
                            </div>
                          );
                        }
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => firstClaimant && handleManagerSignoff(firstClaimant)}
                            disabled={!firstClaimant || saving === firstClaimant?.primary_appointment_id}
                          >
                            <ShieldCheck className="h-4 w-4 mr-1" />
                            Sign Off
                          </Button>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Generated Stamp */}
                  <div className="mt-4 pt-3 border-t border-border/30 flex justify-end">
                    <p className="text-xs text-muted-foreground italic">
                      Generated: {format(new Date(), "dd MMMM yyyy 'at' HH:mm:ss")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        <CompanyFooter />
      </div>
    </>
  );
};

export default AppointmentChecklist;
