import React, { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ArrowLeft, FileText, Upload, Search, RefreshCw, Eye, Send, CheckCircle2,
  Clock, AlertCircle, History, Star, Filter, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import CompanyFooter from "@/components/CompanyFooter";
import ProtectedRoute from "@/components/ProtectedRoute";

type ReportEntry = {
  id: string;
  claimant_name: string;
  expert_name: string;
  expert_type: string;
  referring_attorney: string;
  referring_attorney_id: string;
  report_status: string;
  report_submitted_date: string | null;
  report_due_date: string | null;
  appointment_id: string | null;
  created_at: string;
  updated_at: string;
  versions_count: number;
  latest_version: any | null;
  deliveries: any[];
  reviews: any[];
};

const ReportManagement: React.FC = () => {
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all-reports");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportEntry | null>(null);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [uploadNotes, setUploadNotes] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewStatus, setReviewStatus] = useState("approved");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data: expertReports, error } = await supabase
        .from("expert_reports")
        .select(`
          id, report_status, report_submitted_date, report_due_date, appointment_id, created_at, updated_at,
          claimants!inner(first_name, last_name),
          medical_experts!inner(first_name, last_name, expert_type),
          appointments!left(referring_attorney, referring_attorney_id, referring_attorneys!inner(name))
        `)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      // Fetch versions, deliveries, reviews in parallel
      const reportIds = (expertReports || []).map((r: any) => r.id);

      let versionsMap: Record<string, any[]> = {};
      let deliveriesMap: Record<string, any[]> = {};
      let reviewsMap: Record<string, any[]> = {};

      if (reportIds.length > 0) {
        const [versionsRes, deliveriesRes, reviewsRes] = await Promise.all([
          supabase.from("report_versions").select("*").in("expert_report_id", reportIds).order("version_number", { ascending: false }),
          supabase.from("report_deliveries").select("*").in("expert_report_id", reportIds).order("delivered_at", { ascending: false }),
          supabase.from("report_reviews").select("*").in("expert_report_id", reportIds).order("created_at", { ascending: false }),
        ]);

        (versionsRes.data || []).forEach((v: any) => {
          if (!versionsMap[v.expert_report_id]) versionsMap[v.expert_report_id] = [];
          versionsMap[v.expert_report_id].push(v);
        });
        (deliveriesRes.data || []).forEach((d: any) => {
          if (!deliveriesMap[d.expert_report_id]) deliveriesMap[d.expert_report_id] = [];
          deliveriesMap[d.expert_report_id].push(d);
        });
        (reviewsRes.data || []).forEach((r: any) => {
          if (!reviewsMap[r.expert_report_id]) reviewsMap[r.expert_report_id] = [];
          reviewsMap[r.expert_report_id].push(r);
        });
      }

      const mapped: ReportEntry[] = (expertReports || []).map((r: any) => {
        const versions = versionsMap[r.id] || [];
        const deliveries = deliveriesMap[r.id] || [];
        const reviews = reviewsMap[r.id] || [];
        return {
          id: r.id,
          claimant_name: `${r.claimants?.first_name || ""} ${r.claimants?.last_name || ""}`.trim(),
          expert_name: `${r.medical_experts?.first_name || ""} ${r.medical_experts?.last_name || ""}`.trim(),
          expert_type: r.medical_experts?.expert_type || "N/A",
          referring_attorney: r.appointments?.referring_attorneys?.name || r.appointments?.referring_attorney || "N/A",
          referring_attorney_id: r.appointments?.referring_attorney_id || "",
          report_status: r.report_status,
          report_submitted_date: r.report_submitted_date,
          report_due_date: r.report_due_date,
          appointment_id: r.appointment_id,
          created_at: r.created_at,
          updated_at: r.updated_at,
          versions_count: versions.length,
          latest_version: versions[0] || null,
          deliveries,
          reviews,
        };
      });

      setReports(mapped);
    } catch (err: any) {
      console.error("Error fetching reports:", err);
      toast({ title: "Error", description: "Failed to load reports.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      !searchTerm ||
      r.claimant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.expert_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.referring_attorney.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.report_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: reports.length,
    pending: reports.filter((r) => r.report_status === "pending" || r.report_status === "not_received").length,
    inProgress: reports.filter((r) => r.report_status === "in_progress").length,
    completed: reports.filter((r) => r.report_status === "completed" || r.report_status === "taken_out").length,
    delivered: reports.filter((r) => r.deliveries.length > 0).length,
    reviewed: reports.filter((r) => r.reviews.some((rv: any) => rv.review_status === "approved")).length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
      case "taken_out":
        return <Badge className="bg-success/10 text-success border-success/20">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-primary/10 text-primary border-primary/20">In Progress</Badge>;
      case "under_review":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Under Review</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Pending</Badge>;
    }
  };

  const formatExpertType = (type: string) => {
    if (!type || type === "N/A") return "N/A";
    return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const handleUploadVersion = async (file: File) => {
    if (!selectedReport || !user) return;
    setSaving(true);
    try {
      const filePath = `report-versions/${selectedReport.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file);
      if (uploadError) throw uploadError;

      const existingVersions = selectedReport.versions_count;
      const { error: insertError } = await supabase.from("report_versions").insert({
        expert_report_id: selectedReport.id,
        version_number: existingVersions + 1,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: user.id,
        upload_notes: uploadNotes || null,
      });
      if (insertError) throw insertError;

      toast({ title: "Version Uploaded", description: `Version ${existingVersions + 1} uploaded successfully.` });
      setUploadDialogOpen(false);
      setUploadNotes("");
      await fetchReports();
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({ title: "Error", description: "Failed to upload report version.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRecordDelivery = async () => {
    if (!selectedReport || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("report_deliveries").insert({
        expert_report_id: selectedReport.id,
        delivered_to_attorney_id: selectedReport.referring_attorney_id || null,
        delivery_method: "email",
        delivered_by: user.id,
        notes: deliveryNotes || null,
      });
      if (error) throw error;

      toast({ title: "Delivery Recorded", description: "Report delivery has been tracked." });
      setDeliveryDialogOpen(false);
      setDeliveryNotes("");
      await fetchReports();
    } catch (err: any) {
      console.error("Delivery error:", err);
      toast({ title: "Error", description: "Failed to record delivery.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedReport || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("report_reviews").insert({
        expert_report_id: selectedReport.id,
        reviewer_id: user.id,
        review_status: reviewStatus,
        review_notes: reviewNotes || null,
        reviewed_at: new Date().toISOString(),
      });
      if (error) throw error;

      toast({ title: "Review Submitted", description: `Report marked as ${reviewStatus}.` });
      setReviewDialogOpen(false);
      setReviewNotes("");
      await fetchReports();
    } catch (err: any) {
      console.error("Review error:", err);
      toast({ title: "Error", description: "Failed to submit review.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <Helmet>
        <title>Report Management - Medico-Legal Assessment System</title>
        <meta name="description" content="Manage medico-legal expert reports with version control, delivery tracking, and review workflows." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <header className="relative overflow-hidden border-b">
          <div className="pointer-events-none absolute inset-0 opacity-70 blur-3xl bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.25),transparent_60%)]" />
          <div className="container mx-auto px-4 py-8">
            <div className="relative">
              <Link to="/dashboard" className="inline-block mb-4">
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Button>
              </Link>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold flex items-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    Report Management System
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    Upload, track versions, manage deliveries, and review medico-legal reports
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchReports} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Total Reports", value: stats.total, icon: FileText, color: "text-primary" },
              { label: "Pending", value: stats.pending, icon: Clock, color: "text-muted-foreground" },
              { label: "In Progress", value: stats.inProgress, icon: AlertCircle, color: "text-warning" },
              { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-success" },
              { label: "Delivered", value: stats.delivered, icon: Send, color: "text-primary" },
              { label: "Reviewed", value: stats.reviewed, icon: Star, color: "text-accent-foreground" },
            ].map((stat) => (
              <Card key={stat.label} className="bg-gradient-card border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <stat.icon className={`h-6 w-6 ${stat.color} opacity-50`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by claimant, expert, or attorney..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="not_received">Not Received</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="taken_out">Taken Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full max-w-xl">
              <TabsTrigger value="all-reports">All Reports</TabsTrigger>
              <TabsTrigger value="versions">Versions</TabsTrigger>
              <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>

            {/* All Reports Tab */}
            <TabsContent value="all-reports">
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle>Expert Reports Repository</CardTitle>
                  <CardDescription>All medico-legal reports with version tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredReports.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No reports found</p>
                    </div>
                  ) : (
                    <ScrollArea className="w-full">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Claimant</TableHead>
                            <TableHead>Expert</TableHead>
                            <TableHead>Attorney</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">Versions</TableHead>
                            <TableHead className="text-center">Delivered</TableHead>
                            <TableHead className="text-center">Reviewed</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredReports.map((report) => (
                            <TableRow key={report.id}>
                              <TableCell className="font-medium">{report.claimant_name}</TableCell>
                              <TableCell>
                                <div>
                                  <p className="text-sm">{report.expert_name}</p>
                                  <p className="text-xs text-muted-foreground">{formatExpertType(report.expert_type)}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{report.referring_attorney}</TableCell>
                              <TableCell>{getStatusBadge(report.report_status)}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="text-xs">
                                  {report.versions_count} {report.versions_count === 1 ? "ver" : "vers"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                {report.deliveries.length > 0 ? (
                                  <CheckCircle2 className="h-5 w-5 text-success mx-auto" />
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {report.reviews.some((rv: any) => rv.review_status === "approved") ? (
                                  <Star className="h-5 w-5 text-warning mx-auto fill-warning" />
                                ) : report.reviews.length > 0 ? (
                                  <Eye className="h-5 w-5 text-muted-foreground mx-auto" />
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => { setSelectedReport(report); setUploadDialogOpen(true); }}
                                    title="Upload new version"
                                  >
                                    <Upload className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => { setSelectedReport(report); setVersionDialogOpen(true); }}
                                    title="View version history"
                                  >
                                    <History className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => { setSelectedReport(report); setDeliveryDialogOpen(true); }}
                                    title="Record delivery"
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => { setSelectedReport(report); setReviewDialogOpen(true); }}
                                    title="Submit review"
                                  >
                                    <Star className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Versions Tab */}
            <TabsContent value="versions">
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Version History
                  </CardTitle>
                  <CardDescription>Track all re-uploaded report versions</CardDescription>
                </CardHeader>
                <CardContent>
                  {reports.filter((r) => r.versions_count > 0).length === 0 ? (
                    <div className="text-center py-12">
                      <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No version history yet</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Claimant</TableHead>
                          <TableHead>Expert</TableHead>
                          <TableHead className="text-center">Versions</TableHead>
                          <TableHead>Latest File</TableHead>
                          <TableHead>Uploaded</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports
                          .filter((r) => r.versions_count > 0)
                          .map((report) => (
                            <TableRow key={report.id}>
                              <TableCell className="font-medium">{report.claimant_name}</TableCell>
                              <TableCell>{report.expert_name}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary">{report.versions_count}</Badge>
                              </TableCell>
                              <TableCell className="text-sm">{report.latest_version?.file_name || "—"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {report.latest_version?.created_at ? format(parseISO(report.latest_version.created_at), "dd MMM yyyy HH:mm") : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Deliveries Tab */}
            <TabsContent value="deliveries">
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5 text-primary" />
                    Attorney Delivery Tracking
                  </CardTitle>
                  <CardDescription>Track when reports were sent to attorneys</CardDescription>
                </CardHeader>
                <CardContent>
                  {reports.filter((r) => r.deliveries.length > 0).length === 0 ? (
                    <div className="text-center py-12">
                      <Send className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No deliveries recorded yet</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Claimant</TableHead>
                          <TableHead>Attorney</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Delivered</TableHead>
                          <TableHead className="text-center">Receipt</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports
                          .filter((r) => r.deliveries.length > 0)
                          .flatMap((report) =>
                            report.deliveries.map((d: any) => (
                              <TableRow key={d.id}>
                                <TableCell className="font-medium">{report.claimant_name}</TableCell>
                                <TableCell>{report.referring_attorney}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="capitalize text-xs">{d.delivery_method}</Badge>
                                </TableCell>
                                <TableCell className="text-sm">
                                  {format(parseISO(d.delivered_at), "dd MMM yyyy HH:mm")}
                                </TableCell>
                                <TableCell className="text-center">
                                  {d.confirmed_receipt ? (
                                    <CheckCircle2 className="h-5 w-5 text-success mx-auto" />
                                  ) : (
                                    <Clock className="h-5 w-5 text-muted-foreground mx-auto" />
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                  {d.notes || "—"}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Reviews Tab */}
            <TabsContent value="reviews">
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-primary" />
                    Report Reviews
                  </CardTitle>
                  <CardDescription>Review and approval status of reports</CardDescription>
                </CardHeader>
                <CardContent>
                  {reports.filter((r) => r.reviews.length > 0).length === 0 ? (
                    <div className="text-center py-12">
                      <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No reviews submitted yet</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Claimant</TableHead>
                          <TableHead>Expert</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Reviewed</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports
                          .filter((r) => r.reviews.length > 0)
                          .flatMap((report) =>
                            report.reviews.map((rv: any) => (
                              <TableRow key={rv.id}>
                                <TableCell className="font-medium">{report.claimant_name}</TableCell>
                                <TableCell>{report.expert_name}</TableCell>
                                <TableCell>
                                  <Badge className={
                                    rv.review_status === "approved" ? "bg-success/10 text-success border-success/20" :
                                    rv.review_status === "rejected" ? "bg-destructive/10 text-destructive border-destructive/20" :
                                    "bg-warning/10 text-warning border-warning/20"
                                  }>
                                    {rv.review_status.charAt(0).toUpperCase() + rv.review_status.slice(1)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">
                                  {rv.reviewed_at ? format(parseISO(rv.reviewed_at), "dd MMM yyyy HH:mm") : "Pending"}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                  {rv.review_notes || "—"}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>

        {/* Upload Version Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload New Report Version</DialogTitle>
              <DialogDescription>
                Upload a new version for {selectedReport?.claimant_name} — {selectedReport?.expert_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Report File</label>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadVersion(file);
                  }}
                  disabled={saving}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Upload Notes (optional)</label>
                <Textarea
                  placeholder="Describe changes in this version..."
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Version History Dialog */}
        <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Version History</DialogTitle>
              <DialogDescription>
                {selectedReport?.claimant_name} — {selectedReport?.expert_name}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[400px]">
              {selectedReport?.versions_count === 0 ? (
                <p className="text-center text-muted-foreground py-8">No versions uploaded yet</p>
              ) : (
                <div className="space-y-3">
                  {/* We need to re-fetch versions for the selected report */}
                  {selectedReport?.latest_version && (
                    <div className="border border-border/50 rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">v{selectedReport.latest_version.version_number}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(selectedReport.latest_version.created_at), "dd MMM yyyy HH:mm")}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{selectedReport.latest_version.file_name}</p>
                      {selectedReport.latest_version.upload_notes && (
                        <p className="text-xs text-muted-foreground">{selectedReport.latest_version.upload_notes}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Delivery Dialog */}
        <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Report Delivery</DialogTitle>
              <DialogDescription>
                Track delivery of {selectedReport?.claimant_name}'s report to {selectedReport?.referring_attorney}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Delivery Notes (optional)</label>
                <Textarea
                  placeholder="e.g. Sent via email with cover letter..."
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeliveryDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleRecordDelivery} disabled={saving}>
                <Send className="h-4 w-4 mr-2" />
                Record Delivery
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Review Dialog */}
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Report Review</DialogTitle>
              <DialogDescription>
                Review {selectedReport?.claimant_name}'s report by {selectedReport?.expert_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Review Decision</label>
                <Select value={reviewStatus} onValueChange={setReviewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="revision_needed">Revision Needed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Review Notes</label>
                <Textarea
                  placeholder="Add review comments..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmitReview} disabled={saving}>
                <Star className="h-4 w-4 mr-2" />
                Submit Review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <CompanyFooter />
      </div>
    </ProtectedRoute>
  );
};

export default ReportManagement;
