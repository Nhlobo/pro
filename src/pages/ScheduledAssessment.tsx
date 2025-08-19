import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Download, Search, Calendar, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import CompanyFooter from "@/components/CompanyFooter";
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from "@/utils/pdfBranding";

type ScheduledAppointment = {
  id: string;
  auto_id: string;
  claimant_name: string;
  expert_name: string;
  expert_type: string;
  appointment_date: string;
  appointment_time: string;
  referring_attorney: string;
  deposit: string;
  status: string;
  report_status: string;
  comments: string;
  deposit_date?: string;
  report_date?: string;
};

const ScheduledAssessment = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [appointments, setAppointments] = useState<ScheduledAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<{ [key: string]: string }>({});
  const [reportPeriod, setReportPeriod] = useState("monthly");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(new Date().getMonth() / 3 + 1).toString());

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      
      // Fetch appointments first
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          claimant_id,
          expert_id,
          appointment_date,
          deposit_amount,
          payment_date,
          case_status,
          referring_attorney
        `)
        .order('appointment_date', { ascending: false });

      if (appointmentsError) throw appointmentsError;

      if (!appointmentsData || appointmentsData.length === 0) {
        setAppointments([]);
        return;
      }

      // Get unique claimant and expert IDs
      const claimantIds = [...new Set(appointmentsData.map(apt => apt.claimant_id))];
      const expertIds = [...new Set(appointmentsData.map(apt => apt.expert_id))];

      // Fetch claimants
      const { data: claimantsData, error: claimantsError } = await supabase
        .from('claimants')
        .select('id, auto_id, first_name, last_name')
        .in('id', claimantIds);

      if (claimantsError) throw claimantsError;

      // Fetch medical experts
      const { data: expertsData, error: expertsError } = await supabase
        .from('medical_experts')
        .select('id, first_name, last_name, expert_type')
        .in('id', expertIds);

      if (expertsError) throw expertsError;

      // Fetch expert reports
      const { data: reportsData, error: reportsError } = await supabase
        .from('expert_reports')
        .select('appointment_id, report_status, report_submitted_date')
        .in('appointment_id', appointmentsData.map(apt => apt.id));

      if (reportsError) throw reportsError;

      // Create lookup maps
      const claimantsMap = new Map(claimantsData?.map(c => [c.id, c]) || []);
      const expertsMap = new Map(expertsData?.map(e => [e.id, e]) || []);
      const reportsMap = new Map(reportsData?.map(r => [r.appointment_id, r]) || []);

      // Format appointments with joined data
      const formattedAppointments: ScheduledAppointment[] = appointmentsData.map((appointment: any) => {
        const claimant = claimantsMap.get(appointment.claimant_id);
        const expert = expertsMap.get(appointment.expert_id);
        const report = reportsMap.get(appointment.id);

        return {
          id: appointment.id,
          auto_id: claimant?.auto_id || 'N/A',
          claimant_name: claimant ? `${claimant.first_name} ${claimant.last_name}`.trim() : 'N/A',
          expert_name: expert ? `${expert.first_name} ${expert.last_name}`.trim() : 'N/A',
          expert_type: expert?.expert_type || 'N/A',
          appointment_date: appointment.appointment_date ? format(new Date(appointment.appointment_date), 'dd/MM/yyyy') : 'N/A',
          appointment_time: appointment.appointment_date ? format(new Date(appointment.appointment_date), 'HH:mm') : 'N/A',
          referring_attorney: appointment.referring_attorney || 'N/A',
          deposit: appointment.deposit_amount > 0 ? 'Yes' : 'No',
          status: appointment.case_status ? appointment.case_status.charAt(0).toUpperCase() + appointment.case_status.slice(1) : 'Scheduled',
          report_status: report?.report_status || 'Not Received',
          comments: '',
          report_date: report?.report_submitted_date ? format(new Date(report.report_submitted_date), 'dd/MM/yyyy') : undefined
        };
      });

      setAppointments(formattedAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast({
        title: "Error",
        description: "Failed to fetch appointments. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredAppointments = appointments.filter(appointment =>
    appointment.claimant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appointment.expert_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appointment.auto_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "scheduled": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "assessed": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "cancelled": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "rescheduled": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const getReportStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "received": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "not received": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "preparing report": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "completed": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const updateComments = (appointmentId: string, newComments: string) => {
    setComments(prev => ({
      ...prev,
      [appointmentId]: newComments
    }));
  };

  const updateStatus = async (appointmentId: string, newStatus: string) => {
    try {
      // Convert to lowercase to match database constraint
      const dbStatus = newStatus.toLowerCase();
      
      const { error } = await supabase
        .from('appointments')
        .update({ case_status: dbStatus })
        .eq('id', appointmentId);

      if (error) throw error;

      setAppointments(prev => prev.map(apt => 
        apt.id === appointmentId ? { ...apt, status: newStatus } : apt
      ));

      toast({
        title: "Success",
        description: "Appointment status updated successfully.",
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update appointment status.",
        variant: "destructive",
      });
    }
  };

  const updateReportStatus = async (appointmentId: string, newReportStatus: string) => {
    try {
      // Convert to lowercase and replace spaces with underscores for database
      const dbReportStatus = newReportStatus.toLowerCase().replace(/ /g, '_');
      
      const reportData = {
        report_status: dbReportStatus,
        report_submitted_date: newReportStatus === 'Received' || newReportStatus === 'Completed' ? new Date().toISOString() : null
      };

      // Check if expert report exists
      const { data: existingReport } = await supabase
        .from('expert_reports')
        .select('id')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      let error;
      if (existingReport) {
        ({ error } = await supabase
          .from('expert_reports')
          .update(reportData)
          .eq('appointment_id', appointmentId));
      } else {
        ({ error } = await supabase
          .from('expert_reports')
          .insert([{
            appointment_id: appointmentId,
            expert_id: appointments.find(apt => apt.id === appointmentId)?.expert_name?.split(' ')[1] || '', // This would need proper expert_id
            claimant_id: '', // This would need proper claimant_id from appointment
            ...reportData
          }]));
      }

      if (error) throw error;

      setAppointments(prev => prev.map(apt => 
        apt.id === appointmentId ? { 
          ...apt, 
          report_status: newReportStatus,
          report_date: (newReportStatus === 'Received' || newReportStatus === 'Completed') ? format(new Date(), 'dd/MM/yyyy') : undefined
        } : apt
      ));

      toast({
        title: "Success",
        description: "Report status updated successfully.",
      });
    } catch (error) {
      console.error('Error updating report status:', error);
      toast({
        title: "Error",
        description: "Failed to update report status.",
        variant: "destructive",
      });
    }
  };

  const getHistoricalData = async (period: string, year: string, month?: string, quarter?: string) => {
    try {
      let startDate, endDate;
      
      if (period === 'monthly' && month) {
        startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        endDate = new Date(parseInt(year), parseInt(month), 0);
      } else if (period === 'quarterly' && quarter) {
        const quarterStart = (parseInt(quarter) - 1) * 3;
        startDate = new Date(parseInt(year), quarterStart, 1);
        endDate = new Date(parseInt(year), quarterStart + 3, 0);
      } else if (period === 'yearly') {
        startDate = new Date(parseInt(year), 0, 1);
        endDate = new Date(parseInt(year), 11, 31);
      }

      const { data: archivedData, error } = await supabase
        .from('appointment_archives')
        .select('data')
        .eq('period_type', period)
        .gte('period_start', startDate?.toISOString())
        .lte('period_end', endDate?.toISOString())
        .order('period_start', { ascending: false });

      if (error) throw error;

      return archivedData?.length > 0 ? (archivedData[0].data as ScheduledAppointment[]) : [];
    } catch (error) {
      console.error('Error fetching historical data:', error);
      return [];
    }
  };

  const handleDownloadReport = async () => {
    try {
      setLoading(true);
      
      let reportData = appointments;
      
      // If not current period, fetch historical data
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
      
      const isCurrentPeriod = (
        (reportPeriod === 'yearly' && parseInt(selectedYear) === currentYear) ||
        (reportPeriod === 'monthly' && parseInt(selectedYear) === currentYear && parseInt(selectedMonth) === currentMonth) ||
        (reportPeriod === 'quarterly' && parseInt(selectedYear) === currentYear && parseInt(selectedQuarter) === currentQuarter)
      );

      if (!isCurrentPeriod) {
        reportData = await getHistoricalData(reportPeriod, selectedYear, selectedMonth, selectedQuarter);
        if (reportData.length === 0) {
          toast({
            title: "No Data",
            description: "No archived data found for the selected period.",
            variant: "destructive",
          });
          return;
        }
      }
      
      // Invoke edge function to archive current period data (ignore returned content)
      const { error: archiveError } = await supabase.functions.invoke('generate-appointment-report', {
        body: { 
          period: reportPeriod,
          year: selectedYear,
          month: selectedMonth,
          quarter: selectedQuarter,
          appointments: reportData
        }
      });

      if (archiveError) {
        console.warn('Report archiving failed:', archiveError);
      }

      // Build period text for title/filename
      let periodText = '';
      if (reportPeriod === 'monthly') {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        periodText = `${monthNames[parseInt(selectedMonth) - 1]}-${selectedYear}`;
      } else if (reportPeriod === 'quarterly') {
        periodText = `Q${selectedQuarter}-${selectedYear}`;
      } else {
        periodText = selectedYear;
      }

      // Generate PDF on the client for reliability
      const doc = new jsPDF();
      
      // Add branding
      const startY = addBrandingToPDF(doc, 'Scheduled Assessments Report', `Period: ${periodText}`);

      const rows = reportData.map(a => [
        a.auto_id,
        a.claimant_name,
        a.expert_name,
        a.expert_type,
        a.appointment_date,
        a.status,
        a.report_status,
        a.report_date || 'N/A',
        comments[a.id] || a.comments || 'No comments'
      ]);

      autoTable(doc, {
        startY,
        head: [[
          'Auto ID',
          'Claimant',
          'Expert',
          'Type',
          'Date',
          'Status',
          'Report Status',
          'Report Date',
          'Comments'
        ]],
        body: rows,
        ...getStyledTableOptions(),
        columnStyles: {
          8: { cellWidth: 40 } // Comments column width
        },
      });

      // Add branded footer
      addBrandingFooter(doc);

      doc.save(`scheduled-assessments-${periodText}.pdf`);

      toast({
        title: "Success",
        description: "Report downloaded successfully.",
      });
    } catch (error) {
      console.error('Error downloading report:', error);
      toast({
        title: "Error",
        description: "Failed to download report.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/scheduled-assessment';

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Scheduled Assessments - Medico-Legal Assessment System</title>
        <meta name="description" content="View and manage all scheduled medical assessment appointments with download reporting capabilities." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" asChild>
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
              <h1 className="text-2xl font-bold">Scheduled Assessments</h1>
            </div>
            <Button onClick={handleDownloadReport} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download {reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)} Report
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Scheduled Assessment Appointments
            </CardTitle>
            <div className="flex items-center gap-2 max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by claimant or expert name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                <Select value={reportPeriod} onValueChange={setReportPeriod}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {reportPeriod === 'monthly' && (
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                        <SelectItem key={month} value={month.toString()}>
                          {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                {reportPeriod === 'quarterly' && (
                  <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Quarter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Q1</SelectItem>
                      <SelectItem value="2">Q2</SelectItem>
                      <SelectItem value="3">Q3</SelectItem>
                      <SelectItem value="4">Q4</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Button onClick={handleDownloadReport} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download {reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)} Report
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Auto ID (Claimant)</TableHead>
                    <TableHead>Claimant Name</TableHead>
                    <TableHead>Medical Expert</TableHead>
                    <TableHead>Type of Expert</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Referring Attorney</TableHead>
                    <TableHead>Deposit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Report Status</TableHead>
                    <TableHead>Comments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8">
                        Loading appointments...
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAppointments.map((appointment) => (
                      <TableRow key={appointment.id}>
                        <TableCell className="font-medium">{appointment.auto_id}</TableCell>
                        <TableCell className="font-medium">{appointment.claimant_name}</TableCell>
                        <TableCell>{appointment.expert_name}</TableCell>
                        <TableCell>{appointment.expert_type}</TableCell>
                        <TableCell>{appointment.appointment_date}</TableCell>
                        <TableCell className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {appointment.appointment_time}
                        </TableCell>
                        <TableCell>{appointment.referring_attorney}</TableCell>
                        <TableCell>
                          <Badge variant={appointment.deposit === 'Yes' ? 'default' : 'secondary'}>
                            {appointment.deposit}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select value={appointment.status} onValueChange={(value) => updateStatus(appointment.id, value)}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Scheduled">Scheduled</SelectItem>
                              <SelectItem value="Assessed">Assessed</SelectItem>
                              <SelectItem value="Cancelled">Cancelled</SelectItem>
                              <SelectItem value="Rescheduled">Rescheduled</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={appointment.report_status} onValueChange={(value) => updateReportStatus(appointment.id, value)}>
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Not Received">Not Received</SelectItem>
                              <SelectItem value="Pending">Pending</SelectItem>
                              <SelectItem value="Preparing Report">Preparing Report</SelectItem>
                              <SelectItem value="Received">Received</SelectItem>
                              <SelectItem value="Completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Textarea
                            placeholder="Add comments..."
                            value={comments[appointment.id] || appointment.comments}
                            onChange={(e) => updateComments(appointment.id, e.target.value)}
                            className="min-h-[60px] w-40"
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {filteredAppointments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No scheduled assessments found.
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <CompanyFooter />
    </div>
  );
};

export default ScheduledAssessment;