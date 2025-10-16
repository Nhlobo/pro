import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Download, Search, Calendar, Clock, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSecureAssessments } from "@/hooks/useSecureAssessments";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import CompanyFooter from "@/components/CompanyFooter";
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from "@/utils/pdfBranding";
import { BulkAppointmentUpload } from "@/components/BulkAppointmentUpload";

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
  const [comments, setComments] = useState<{ [key: string]: string }>({});
  const [reportPeriod, setReportPeriod] = useState("monthly");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(new Date().getMonth() / 3 + 1).toString());
  const { assessments, loading, error, updateAssessmentStatus, updateReportStatus } = useSecureAssessments();

  // Remove fetchAppointments useEffect as it's handled by the hook

  // Convert secure assessments to the format expected by the component
  const formatAssessments = (secureAssessments: any[]): ScheduledAppointment[] => {
    return secureAssessments.map((assessment) => ({
      id: assessment.appointment_id,
      auto_id: assessment.claimant_auto_id || 'N/A',
      claimant_name: assessment.claimant_name || 'N/A',
      expert_name: assessment.expert_name || 'N/A',
      expert_type: assessment.expert_type || 'N/A',
      appointment_date: assessment.appointment_date ? format(new Date(assessment.appointment_date), 'dd/MM/yyyy') : 'N/A',
      appointment_time: assessment.appointment_date ? format(new Date(assessment.appointment_date), 'HH:mm') : 'N/A',
      referring_attorney: assessment.referring_attorney || 'N/A',
      deposit: assessment.deposit_amount > 0 ? 'Yes' : 'No',
      status: assessment.case_status ? assessment.case_status.charAt(0).toUpperCase() + assessment.case_status.slice(1) : 'Scheduled',
      report_status: formatReportStatus(assessment.report_status),
      comments: '',
      report_date: assessment.report_submitted_date ? format(new Date(assessment.report_submitted_date), 'dd/MM/yyyy') : undefined
    }));
  };

  // Helper function to properly format report status for display
  const formatReportStatus = (status: string | null | undefined): string => {
    if (!status || status === 'not_received') return 'Not Received';
    
    // Convert underscores back to spaces and handle special cases
    const formatted = status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace(/- On Aod/g, '- On AOD')
      .replace(/Aod/g, 'AOD');
    
    return formatted;
  };

  const appointments = formatAssessments(assessments);

  // Filter appointments by selected month/year and search term
  const filteredAppointments = appointments.filter(appointment => {
    // Parse appointment date for month/year comparison
    const appointmentDate = new Date(appointment.appointment_date.split('/').reverse().join('-'));
    const appointmentMonth = appointmentDate.getMonth() + 1;
    const appointmentYear = appointmentDate.getFullYear();
    
    // Filter by selected period
    let dateMatch = false;
    if (reportPeriod === 'monthly') {
      dateMatch = appointmentMonth === parseInt(selectedMonth) && appointmentYear === parseInt(selectedYear);
    } else if (reportPeriod === 'quarterly') {
      const appointmentQuarter = Math.floor(appointmentDate.getMonth() / 3) + 1;
      dateMatch = appointmentQuarter === parseInt(selectedQuarter) && appointmentYear === parseInt(selectedYear);
    } else if (reportPeriod === 'yearly') {
      dateMatch = appointmentYear === parseInt(selectedYear);
    }
    
    // Filter by search term
    const searchMatch = appointment.claimant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.expert_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.auto_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    return dateMatch && searchMatch;
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "initial stage": return "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300";
      case "scheduled": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "assessed": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "cancelled": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "rescheduled": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const getReportStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "initial stage": return "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300";
      case "preparing report": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "report on final stage": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "report submitted without full payment": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case "report submitted on aod": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      // Legacy status support
      case "completed report- on aod": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "preparing report- on aod": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "pending report- on aod": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "pending report-awaiting payment": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case "completed report - awaiting payment": return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300";
      case "preparing report - with deposit paid": return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300";
      case "pending - awaiting full payment": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "report submitted": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300";
      case "received": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "not received": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
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
    // Validate if changing status to "assessed"
    if (newStatus.toLowerCase() === 'assessed') {
      const appointment = appointments.find(app => app.id === appointmentId);
      if (appointment) {
        // Parse appointment date (dd/MM/yyyy format)
        const [day, month, year] = appointment.appointment_date.split('/');
        const appointmentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const today = new Date();
        
        // Set time to start of day for accurate comparison
        appointmentDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        if (today < appointmentDate) {
          toast({
            title: "Invalid Status Change",
            description: `Cannot mark as "Assessed" before the appointment date (${appointment.appointment_date}).`,
            variant: "destructive",
          });
          return;
        }
      }
    }
    
    // Get appointment details for notification
    const appointment = appointments.find(app => app.id === appointmentId);
    const oldStatus = appointment?.status || 'Unknown';
    
    // Update status first
    const success = await updateAssessmentStatus(appointmentId, newStatus);
    
    if (success && appointment) {
      // Send notification to referring attorney
      try {
        // Get attorney email from law_firms table
        const { data: attorneyData } = await supabase
          .from('law_firms')
          .select('email')
          .ilike('contact_person', `%${appointment.referring_attorney}%`)
          .single();

        if (attorneyData?.email) {
          await supabase.functions.invoke('notify-attorney-assessment-change', {
            body: {
              appointmentId,
              claimantName: appointment.claimant_name,
              expertName: appointment.expert_name,
              oldStatus,
              newStatus,
              appointmentDate: appointment.appointment_date,
              attorneyName: appointment.referring_attorney,
              attorneyEmail: attorneyData.email
            }
          });
        }
      } catch (error) {
        console.error('Failed to send assessment change notification:', error);
      }
    }
  };

  const updateReportStatusLocal = (appointmentId: string, newReportStatus: string) => {
    updateReportStatus(appointmentId, newReportStatus);
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
            <div className="flex items-center gap-2">
              <BulkAppointmentUpload onUploadComplete={() => window.location.reload()} />
              <Button onClick={handleDownloadReport} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download {reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)} Report
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Statistics Integration Information */}
        <Card className="mb-6 border-blue-200 bg-blue-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">Data Feeds Assessment Reports & Statistics</h3>
                <p className="text-sm text-muted-foreground">
                  All appointments created and managed here automatically appear in the{' '}
                  <Link to="/assessment-reports-statistics" className="text-primary hover:underline font-medium">
                    Assessment Reports & Statistics
                  </Link>{' '}
                  page for comprehensive analysis and reporting.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
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
                          <Select value={appointment.report_status} onValueChange={(value) => updateReportStatusLocal(appointment.id, value)}>
                            <SelectTrigger className="w-56">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-64 overflow-y-auto bg-background border shadow-lg z-50">
                              <SelectItem value="Initial Stage">Initial Stage</SelectItem>
                              <SelectItem value="Preparing report">Preparing report</SelectItem>
                              <SelectItem value="Report on Final Stage">Report on Final Stage</SelectItem>
                              <SelectItem value="Report Submitted without full payment">Report Submitted without full payment</SelectItem>
                              <SelectItem value="Report Submitted on AOD">Report Submitted on AOD</SelectItem>
                            </SelectContent>
                          </Select>
                          {/* Hidden date tracking - shows when status was last changed */}
                          <div className="text-xs text-muted-foreground mt-1">
                            Last updated: {appointment.report_date || format(new Date(), 'dd/MM/yyyy')}
                          </div>
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