import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, CheckCircle, AlertTriangle, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import CompanyFooter from "@/components/CompanyFooter";
import { usePermissions } from "@/hooks/usePermissions";

interface ExpertReport {
  id: string;
  expert_id: string;
  claimant_id: string;
  appointment_id: string | null;
  payment_status: string;
  payment_date: string | null;
  report_status: string;
  report_due_date: string | null;
  report_submitted_date: string | null;
  days_to_complete: number | null;
  expert_performance: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  expert?: {
    first_name: string;
    last_name: string;
    expert_type: string;
  } | null;
  claimant?: {
    first_name: string;
    last_name: string;
    auto_id: string;
  } | null;
}

interface ExpertSummary {
  expert_type: string;
  total_reports: number;
  good_performance: number;
  average_performance: number;
  bad_performance: number;
  avg_days_to_complete: number;
  payment_statuses: {
    pending: number;
    deposit: number;
    full_payment: number;
    arranged: number;
  };
}

const ReportTracking = () => {
  const [reports, setReports] = useState<ExpertReport[]>([]);
  const [expertSummaries, setExpertSummaries] = useState<ExpertSummary[]>([]);
  const [selectedExpertType, setSelectedExpertType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { userRole, isAdmin } = usePermissions();

  // Check if user is employee (internal staff)
  const isEmployee = userRole === 'employee' || isAdmin();

  useEffect(() => {
    initializeReports();
  }, []);

  const initializeReports = async () => {
    try {
      // First check if we need to create reports from existing appointments
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('id, expert_id, claimant_id, payment_status, payment_date, appointment_date')
        .not('expert_id', 'is', null);

      if (appointmentsError) throw appointmentsError;

      // Check which appointments don't have reports yet
      const { data: existingReports, error: reportsError } = await supabase
        .from('expert_reports')
        .select('appointment_id');

      if (reportsError) throw reportsError;

      const existingReportAppointmentIds = new Set(
        existingReports?.map(r => r.appointment_id).filter(Boolean) || []
      );

      // Create reports for appointments that don't have them
      const appointmentsNeedingReports = appointments?.filter(
        apt => !existingReportAppointmentIds.has(apt.id)
      ) || [];

      if (appointmentsNeedingReports.length > 0) {
        const newReports = appointmentsNeedingReports.map(appointment => {
          const appointmentDate = new Date(appointment.appointment_date);
          const dueDate = new Date(appointmentDate);
          dueDate.setDate(dueDate.getDate() + 30); // 30 days to complete

          return {
            appointment_id: appointment.id,
            expert_id: appointment.expert_id,
            claimant_id: appointment.claimant_id,
            payment_status: appointment.payment_status,
            payment_date: appointment.payment_date,
            report_status: 'pending',
            report_due_date: dueDate.toISOString(),
          };
        });

        const { error: insertError } = await supabase
          .from('expert_reports')
          .insert(newReports);

        if (insertError) throw insertError;

        toast({
          title: "Reports Initialized",
          description: `Created ${newReports.length} expert reports from existing appointments`,
        });
      }

      // Now fetch all reports
      await fetchReports();
    } catch (error) {
      console.error('Error initializing reports:', error);
      toast({
        title: "Error",
        description: "Failed to initialize expert reports",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    generateSummaries();
  }, [reports]);

  const fetchReports = async () => {
    try {
      console.log("Fetching reports...");
      
      // First check current user and law firm
      const { data: { user } } = await supabase.auth.getUser();
      console.log("Current user:", user?.id);
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('referring_attorney_id, role')
        .eq('id', user?.id || '')
        .single();
      
      console.log("User profile:", profileData);

      const { data, error } = await supabase
        .from('expert_reports')
        .select(`
          *,
          expert:medical_experts!expert_id (
            first_name,
            last_name,
            expert_type
          ),
          claimant:claimants!claimant_id (
            first_name,
            last_name,
            auto_id
          )
        `)
        .order('created_at', { ascending: false });

      console.log("Reports query result:", { data, error });

      if (error) {
        console.error("Reports fetch error:", error);
        throw error;
      }
      
      setReports((data || []) as any);
    } catch (error) {
      console.error("Fetch reports error:", error);
      toast({
        title: "Error",
        description: "Failed to load expert reports",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateSummaries = () => {
    const summaryMap = new Map<string, ExpertSummary>();

    reports.forEach((report) => {
      const expertType = report.expert?.expert_type || 'Unknown';
      
      if (!summaryMap.has(expertType)) {
        summaryMap.set(expertType, {
          expert_type: expertType,
          total_reports: 0,
          good_performance: 0,
          average_performance: 0,
          bad_performance: 0,
          avg_days_to_complete: 0,
          payment_statuses: {
            pending: 0,
            deposit: 0,
            full_payment: 0,
            arranged: 0
          }
        });
      }

      const summary = summaryMap.get(expertType)!;
      summary.total_reports++;

      // Count performance
      if (report.expert_performance === 'good') summary.good_performance++;
      else if (report.expert_performance === 'average') summary.average_performance++;
      else if (report.expert_performance === 'bad') summary.bad_performance++;

      // Count payment statuses
      switch (report.payment_status) {
        case 'pending':
          summary.payment_statuses.pending++;
          break;
        case 'deposit':
          summary.payment_statuses.deposit++;
          break;
        case 'full_payment':
          summary.payment_statuses.full_payment++;
          break;
        case 'arranged':
          summary.payment_statuses.arranged++;
          break;
      }
    });

    // Calculate average days
    summaryMap.forEach((summary) => {
      const completedReports = reports.filter(r => 
        r.expert?.expert_type === summary.expert_type && 
        r.days_to_complete !== null
      );
      
      if (completedReports.length > 0) {
        summary.avg_days_to_complete = Math.round(
          completedReports.reduce((sum, r) => sum + (r.days_to_complete || 0), 0) / completedReports.length
        );
      }
    });

    setExpertSummaries(Array.from(summaryMap.values()));
  };

  const filteredReports = reports.filter((report) => {
    const typeMatch = selectedExpertType === "all" || report.expert?.expert_type === selectedExpertType;
    const statusMatch = selectedStatus === "all" || report.report_status === selectedStatus;
    return typeMatch && statusMatch;
  });

  const getPerformanceBadge = (performance: string | null) => {
    switch (performance) {
      case 'good':
        return <Badge className="bg-green-500 hover:bg-green-600">Good</Badge>;
      case 'average':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Average</Badge>;
      case 'bad':
        return <Badge className="bg-red-500 hover:bg-red-600">Bad</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500 hover:bg-blue-600"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>;
      case 'overdue':
        return <Badge className="bg-red-500 hover:bg-red-600"><AlertTriangle className="w-3 h-3 mr-1" />Overdue</Badge>;
      default:
        return <Badge variant="secondary"><FileText className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'full_payment':
        return <Badge className="bg-green-500 hover:bg-green-600">R Full Payment</Badge>;
      case 'deposit':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">R Deposit</Badge>;
      case 'arranged':
        return <Badge className="bg-blue-500 hover:bg-blue-600">R Arranged</Badge>;
      default:
        return <Badge variant="secondary">R Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading report tracking...</p>
        </div>
      </div>
    );
  }

  const uniqueExpertTypes = [...new Set(reports.map(r => r.expert?.expert_type).filter(Boolean))];

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Expert Report Tracking - Performance & Payment Status</title>
        <meta 
          name="description" 
          content="Track medical expert report delivery performance, payment status, and compliance with 7-30 day reporting requirements." 
        />
      </Helmet>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link 
            to="/medical-expert" 
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Medical Experts
          </Link>
          
          <h1 className="text-3xl font-bold text-foreground mb-2">Expert Report Tracking</h1>
          <p className="text-muted-foreground">
            Monitor expert performance, payment status, and report delivery compliance (7-30 day requirement)
          </p>
        </div>

        {/* Expert Type Summary Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {expertSummaries.map((summary) => (
            <Card key={summary.expert_type}>
              <CardHeader>
                <CardTitle className="text-lg">{summary.expert_type}</CardTitle>
                <CardDescription>{summary.total_reports} total reports</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">Performance</h4>
                  <div className="flex gap-2 flex-wrap">
                    <Badge className="bg-green-500 hover:bg-green-600">Good: {summary.good_performance}</Badge>
                    <Badge className="bg-yellow-500 hover:bg-yellow-600">Average: {summary.average_performance}</Badge>
                    <Badge className="bg-red-500 hover:bg-red-600">Bad: {summary.bad_performance}</Badge>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-sm mb-2">Payment Status</h4>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span>Full: {summary.payment_statuses.full_payment}</span>
                    <span>Deposit: {summary.payment_statuses.deposit}</span>
                    <span>Arranged: {summary.payment_statuses.arranged}</span>
                    <span>Pending: {summary.payment_statuses.pending}</span>
                  </div>
                </div>

                {summary.avg_days_to_complete > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm">Avg. Completion</h4>
                    <p className="text-lg font-bold">{summary.avg_days_to_complete} days</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter Reports</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Select value={selectedExpertType} onValueChange={setSelectedExpertType}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="All expert types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Expert Types</SelectItem>
                {uniqueExpertTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Reports Table */}
        <Card>
          <CardHeader>
            <CardTitle>Expert Reports ({filteredReports.length})</CardTitle>
            <CardDescription>
              Track individual report progress and expert performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredReports.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No reports found matching your criteria.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Claimant Auto ID</TableHead>
                    <TableHead>Claimant Name</TableHead>
                    <TableHead>Expert Type</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead>Report Status</TableHead>
                    <TableHead>Days to Complete</TableHead>
                    {isEmployee && <TableHead>Performance</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">
                        {report.claimant?.auto_id}
                      </TableCell>
                      <TableCell>
                        {report.claimant ? `${report.claimant.first_name} ${report.claimant.last_name}` : 'N/A'}
                      </TableCell>
                      <TableCell>{report.expert?.expert_type}</TableCell>
                      <TableCell>{getPaymentBadge(report.payment_status)}</TableCell>
                      <TableCell>{getStatusBadge(report.report_status)}</TableCell>
                      <TableCell>
                        {report.days_to_complete !== null ? `${report.days_to_complete} days` : 'N/A'}
                      </TableCell>
                      {isEmployee && <TableCell>{getPerformanceBadge(report.expert_performance)}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
      <CompanyFooter />
    </div>
  );
};

export default ReportTracking;