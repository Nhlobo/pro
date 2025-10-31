import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, FileText, Calendar, Filter, Archive, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import CompanyFooter from "@/components/CompanyFooter";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from "@/utils/pdfBranding";
import { usePermissions } from "@/hooks/usePermissions";

type ClaimantReportData = {
  auto_id: string;
  claimant_name: string;
  assessment_date: string;
  status: string;
  report_status: string;
  days_countdown: number | null;
  expert_types: string[];
  multiple_assessments: boolean;
  comment_status: string;
  claimant_id: string;
  appointment_id: string;
  total_debt: number;
  service_fee: number | null;
  deposit_amount: number | null;
  payment_status: string;
};

const statusOptions = [
  "Report await final payment",
  "Report fully paid Await expert to complete the report",
  "Report completed",
  "Assessment pending"
];

const ReferringAttorneyReport = () => {
  const { toast } = useToast();
  const { isReferringAttorney } = usePermissions();
  const [reportData, setReportData] = useState<ClaimantReportData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportType, setReportType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [archiving, setArchiving] = useState(false);
  const [selectedAttorney, setSelectedAttorney] = useState<string>('all');
  const [attorneys, setAttorneys] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [updateData, setUpdateData] = useState<any[]>([]);
  const [currentUserAttorney, setCurrentUserAttorney] = useState<string | null>(null);

  // Manual refresh function
  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchReportData();
      await fetchScheduledAssessments();
      toast({
        title: "Data Refreshed",
        description: "The report data has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh the data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      // Check if user is referring attorney and get their name
      if (isReferringAttorney()) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', (await supabase.auth.getUser()).data.user?.id)
            .single();
          
          if (profile) {
            const attorneyName = `${profile.first_name} ${profile.last_name}`;
            setCurrentUserAttorney(attorneyName);
            setSelectedAttorney(attorneyName);
          }
        } catch (error) {
          console.error('Error fetching attorney profile:', error);
        }
      }
      
      // Only initialize data on component mount, not on filter changes
      fetchReportData();
      fetchScheduledAssessments();
    };

    initializeData();
  }, []); // Removed dependencies to prevent auto-refresh on filter changes

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      // Get current user's profile and law firm
      const { data: profile } = await supabase
        .from('profiles')
        .select('referring_attorney_id, role, first_name, last_name')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.referring_attorney_id) {
        toast({
          title: "Error",
          description: "No law firm associated with your account.",
          variant: "destructive",
        });
        return;
      }

      // If user is referring attorney, ensure they can only see their own data
      let effectiveSelectedAttorney = selectedAttorney;
      if (profile.role === 'referring_attorney') {
        const attorneyName = `${profile.first_name} ${profile.last_name}`;
        effectiveSelectedAttorney = attorneyName;
        setCurrentUserAttorney(attorneyName);
        if (selectedAttorney !== attorneyName) {
          setSelectedAttorney(attorneyName);
        }
      }

      // Calculate date range based on report type and selected period
      let startDate: Date;
      let endDate: Date;

      if (reportType === 'monthly') {
        startDate = startOfMonth(new Date(selectedYear, selectedMonth - 1, 1));
        endDate = endOfMonth(new Date(selectedYear, selectedMonth - 1, 1));
      } else if (reportType === 'quarterly') {
        const quarter = Math.ceil(selectedMonth / 3);
        startDate = startOfQuarter(new Date(selectedYear, (quarter - 1) * 3, 1));
        endDate = endOfQuarter(new Date(selectedYear, (quarter - 1) * 3, 1));
      } else {
        startDate = startOfYear(new Date(selectedYear, 0, 1));
        endDate = endOfYear(new Date(selectedYear, 0, 1));
      }

      // Fetch attorneys from referring_attorneys table
      const { data: lawFirms, error: firmsError } = await supabase
        .from('referring_attorneys')
        .select('name')
        .order('name');

      if (firmsError) throw firmsError;

      const uniqueAttorneys = lawFirms?.map(firm => firm.name) || [];
      setAttorneys(uniqueAttorneys);

      // Fetch appointments with related data, filtering by attorney if selected
      let appointmentQuery = supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          case_status,
          service_fee,
          deposit_amount,
          payment_status,
          payment_date,
          referring_attorney,
          expert_id,
          claimant_id
        `)
        .eq('referring_attorney_id', profile.referring_attorney_id);

      if (effectiveSelectedAttorney !== 'all') {
        appointmentQuery = appointmentQuery.eq('referring_attorney', effectiveSelectedAttorney);
      }

      const { data: appointments, error } = await appointmentQuery;

      if (error) throw error;

      // Fetch claimants separately
      const claimantIds = [...new Set(appointments?.map(apt => apt.claimant_id) || [])];
      const { data: claimants, error: claimantsError } = await supabase
        .from('claimants')
        .select('id, auto_id, first_name, last_name')
        .in('id', claimantIds);

      if (claimantsError) throw claimantsError;

      // Fetch medical experts separately
      const expertIds = [...new Set(appointments?.map(apt => apt.expert_id) || [])];
      const { data: experts, error: expertsError } = await supabase
        .rpc('get_medical_experts_basic');
      
      // Filter experts by IDs after fetching
      const filteredExperts = experts?.filter(expert => expertIds.includes(expert.id)) || [];

      if (expertsError) throw expertsError;

      // Fetch expert reports separately
      const appointmentIds = appointments?.map(apt => apt.id) || [];
      const { data: expertReports, error: reportsError } = await supabase
        .from('expert_reports')
        .select('appointment_id, report_status, report_submitted_date, payment_date, days_to_complete')
        .in('appointment_id', appointmentIds);

      if (reportsError) throw reportsError;

      // Filter appointments by date range
      const filteredAppointments = appointments?.filter(apt => {
        const aptDate = new Date(apt.appointment_date);
        return aptDate >= startDate && aptDate <= endDate;
      }) || [];

      // Process the data
      const processedData: ClaimantReportData[] = [];
      
      // Group appointments by claimant and date
      const appointmentsByClaimantAndDate = filteredAppointments.reduce((acc, apt) => {
        const claimant = claimants?.find(c => c.id === apt.claimant_id);
        if (!claimant) return acc;
        
        const claimantId = claimant.id;
        const date = format(new Date(apt.appointment_date), 'yyyy-MM-dd');
        const key = `${claimantId}-${date}`;
        
        if (!acc[key]) {
          acc[key] = {
            claimant,
            date,
            appointments: []
          };
        }
        acc[key].appointments.push(apt);
        return acc;
      }, {} as Record<string, { claimant: any; date: string; appointments: any[] }>);

      Object.values(appointmentsByClaimantAndDate).forEach(({ claimant, date, appointments }) => {
        // Get expert types for these appointments
        const expertTypes = appointments
          .map(apt => experts?.find(e => e.id === apt.expert_id)?.expert_type)
          .filter(Boolean) as string[];
        
        const hasMultipleAssessments = appointments.length > 1;
          
        // Get the most recent report status and countdown
        let reportStatus = 'Not Assessed';
        let daysCountdown: number | null = null;
        let appointmentStatus = 'Not Assessed';
        
        appointments.forEach(apt => {
          if (apt.case_status === 'completed') {
            appointmentStatus = 'Assessed';
          } else if (apt.case_status === 'scheduled') {
            appointmentStatus = 'Scheduled';
          } else if (apt.case_status === 'cancelled') {
            appointmentStatus = 'Cancelled';
          }

          const reports = expertReports?.filter(r => r.appointment_id === apt.id) || [];
          if (reports.length > 0) {
            const report = reports[0];
            reportStatus = report.report_status;
            
            // Calculate countdown days
            if (report.payment_date && !report.report_submitted_date) {
              const paymentDate = new Date(report.payment_date);
              const today = new Date();
              const diffTime = today.getTime() - paymentDate.getTime();
              daysCountdown = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            } else if (report.days_to_complete) {
              daysCountdown = report.days_to_complete;
            }
          }
        });

        // Calculate debt information
        const serviceFee = appointments[0]?.service_fee || 0;
        const depositAmount = appointments[0]?.deposit_amount || 0;
        const totalDebt = serviceFee - depositAmount;
        const paymentStatus = appointments[0]?.payment_status || 'pending';

        processedData.push({
          auto_id: claimant.auto_id,
          claimant_name: `${claimant.first_name} ${claimant.last_name}`,
          assessment_date: format(new Date(date), 'dd/MM/yyyy'),
          status: appointmentStatus,
          report_status: reportStatus,
          days_countdown: daysCountdown,
          expert_types: expertTypes,
          multiple_assessments: hasMultipleAssessments,
          comment_status: 'Assessment pending',
          claimant_id: claimant.id,
          appointment_id: appointments[0]?.id || '',
          total_debt: totalDebt,
          service_fee: serviceFee,
          deposit_amount: depositAmount,
          payment_status: paymentStatus
        });
      });

      setReportData(processedData);
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch report data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduledAssessments = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('referring_attorney_id, role, first_name, last_name')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.referring_attorney_id) {
        return;
      }

      // If user is referring attorney, ensure they can only see their own data
      let effectiveSelectedAttorney = selectedAttorney;
      if (profile.role === 'referring_attorney') {
        const attorneyName = `${profile.first_name} ${profile.last_name}`;
        effectiveSelectedAttorney = attorneyName;
      }

      // Build query for scheduled appointments
      let appointmentQuery = supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          referring_attorney,
          claimant_id,
          expert_id
        `)
        .eq('referring_attorney_id', profile.referring_attorney_id)
        .eq('case_status', 'scheduled')
        .order('appointment_date', { ascending: true });

      if (effectiveSelectedAttorney !== 'all') {
        appointmentQuery = appointmentQuery.eq('referring_attorney', effectiveSelectedAttorney);
      }

      const { data: appointments, error } = await appointmentQuery;
      if (error) throw error;

      if (!appointments || appointments.length === 0) {
        setUpdateData([]);
        return;
      }

      // Fetch claimants separately
      const claimantIds = [...new Set(appointments.map(apt => apt.claimant_id))];
      const { data: claimants, error: claimantsError } = await supabase
        .from('claimants')
        .select('id, auto_id, first_name, last_name')
        .in('id', claimantIds);

      if (claimantsError) throw claimantsError;

      // Fetch medical experts separately
      const expertIds = [...new Set(appointments.map(apt => apt.expert_id))];
      const { data: allExperts, error: expertsError } = await supabase
        .rpc('get_medical_experts_secure');
      
      // Filter experts by IDs after fetching
      const experts = allExperts?.filter(expert => expertIds.includes(expert.id)) || [];

      if (expertsError) throw expertsError;

      const processedData = appointments.map(appointment => {
        const appointmentDate = new Date(appointment.appointment_date);
        const claimant = claimants?.find(c => c.id === appointment.claimant_id);
        const expert = experts?.find(e => e.id === appointment.expert_id);
        const expertAddress = expert?.address_masked || 'Address not available';
        
        return {
          auto_id: claimant?.auto_id || 'N/A',
          claimant_name: claimant ? `${claimant.first_name} ${claimant.last_name}` : 'Unknown',
          expert_type: expert?.expert_type || 'Not specified',
          assessment_date: format(appointmentDate, 'dd/MM/yyyy'),
          assessment_time: format(appointmentDate, 'HH:mm'),
          location: expertAddress,
          appointment_id: appointment.id,
          claimant_id: claimant?.id || '',
          referring_attorney: appointment.referring_attorney || 'Unknown'
        };
      });

      setUpdateData(processedData);
    } catch (error) {
      console.error('Error fetching scheduled assessments:', error);
    }
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Assessed": return <Badge variant="default">Assessed</Badge>;
      case "Scheduled": return <Badge variant="secondary">Scheduled</Badge>;
      case "Not Assessed": return <Badge variant="outline">Not Assessed</Badge>;
      case "Cancelled": return <Badge variant="destructive">Cancelled</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getReportStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge variant="default">Completed</Badge>;
      case "pending": return <Badge variant="secondary">Pending</Badge>;
      case "in_progress": return <Badge variant="outline">In Progress</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleArchiveData = async () => {
    try {
      setArchiving(true);
      
      let startDate: Date;
      let endDate: Date;

      if (reportType === 'monthly') {
        startDate = startOfMonth(new Date(selectedYear, selectedMonth - 1, 1));
        endDate = endOfMonth(new Date(selectedYear, selectedMonth - 1, 1));
      } else if (reportType === 'quarterly') {
        const quarter = Math.ceil(selectedMonth / 3);
        startDate = startOfQuarter(new Date(selectedYear, (quarter - 1) * 3, 1));
        endDate = endOfQuarter(new Date(selectedYear, (quarter - 1) * 3, 1));
      } else {
        startDate = startOfYear(new Date(selectedYear, 0, 1));
        endDate = endOfYear(new Date(selectedYear, 0, 1));
      }

      const { data, error } = await supabase.functions.invoke('archive-assessment-data', {
        body: {
          period_type: reportType,
          period_start: startDate.toISOString(),
          period_end: endDate.toISOString()
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Data archived successfully for ${reportType} report.`,
      });

    } catch (error) {
      console.error('Error archiving data:', error);
      toast({
        title: "Error",
        description: "Failed to archive data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setArchiving(false);
    }
  };

  const handleDownloadClaimantReport = () => {
    try {
      const doc = new jsPDF();
      
      // Add branding
      const periodText = reportType === 'monthly' 
        ? format(new Date(selectedYear, selectedMonth - 1), 'MMMM yyyy')
        : reportType === 'quarterly' 
          ? `Q${Math.ceil(selectedMonth / 3)} ${selectedYear}`
          : selectedYear.toString();
      
      const subtitle = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report - ${periodText}`;
      const startY = addBrandingToPDF(doc, 'Claimant Assessment Report', subtitle);
      
      // Add summary info
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const totalDebt = reportData.reduce((sum, row) => sum + row.total_debt, 0);
      doc.text(`Total Outstanding Debt: R ${totalDebt.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 20, startY + 5);
      
      // Prepare table data
      const tableHeaders = ['Auto ID', 'Claimant', 'Date', 'Status', 'Report', 'Days', 'Expert Types', 'Debt', 'Payment'];
      const tableData = reportData.map(row => [
        row.auto_id,
        row.claimant_name,
        row.assessment_date,
        row.status,
        row.report_status,
        row.days_countdown ? `${row.days_countdown} days` : 'N/A',
        row.expert_types.join(', '),
        `R ${row.total_debt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
        row.payment_status
      ]);

      // Add table
      autoTable(doc, {
        head: [tableHeaders],
        body: tableData,
        startY: startY + 15,
        ...getStyledTableOptions(),
        margin: { top: startY + 15, left: 14, right: 14 },
      });

      // Add branded footer
      addBrandingFooter(doc);

      // Save the PDF
      doc.save(`claimant-report-${reportType}-${new Date().toISOString().split('T')[0]}.pdf`);

      toast({
        title: "Export successful",
        description: "Claimant report PDF downloaded successfully.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Export failed",
        description: "Failed to generate PDF report.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadAttorneyUpdate = () => {
    try {
      const doc = new jsPDF();
      
      // Add branding
      const subtitle = selectedAttorney !== 'all' ? `Attorney: ${selectedAttorney}` : 'All Attorneys';
      const startY = addBrandingToPDF(doc, 'Referring Attorney Update - Scheduled Assessments', subtitle);
      
      // Prepare table data
      const tableHeaders = ['Auto ID', 'Claimant Name', 'Expert Type', 'Assessment Date', 'Time', 'Location'];
      const tableData = updateData.length === 0 
        ? [['No scheduled assessments found', '', '', '', '', '']]
        : updateData.map(row => [
            row.auto_id,
            row.claimant_name,
            row.expert_type,
            row.assessment_date,
            row.assessment_time,
            row.location
          ]);

      // Add table
      autoTable(doc, {
        head: [tableHeaders],
        body: tableData,
        startY,
        ...getStyledTableOptions(),
        margin: { top: startY, left: 14, right: 14 },
      });

      // Add branded footer
      addBrandingFooter(doc);

      // Save the PDF
      doc.save(`attorney-update-${new Date().toISOString().split('T')[0]}.pdf`);

      toast({
        title: "Export successful",
        description: "Attorney update PDF downloaded successfully.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Export failed",
        description: "Failed to generate PDF report.",
        variant: "destructive",
      });
    }
  };

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/referring-attorney-report';

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Referring Attorney Report - Medico-Legal Assessment System</title>
        <meta name="description" content="Comprehensive report showing claimant assessments, report status, and expert information for referring attorneys." />
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
              <h1 className="text-2xl font-bold">Referring Attorney Report</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleManualRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh Data'}
              </Button>
              <Button variant="outline" onClick={handleArchiveData} disabled={archiving}>
                <Archive className="h-4 w-4 mr-2" />
                {archiving ? 'Archiving...' : 'Archive Data'}
              </Button>
              <Button onClick={handleDownloadClaimantReport}>
                <Download className="h-4 w-4 mr-2" />
                Claimant Report PDF
              </Button>
              <Button onClick={handleDownloadAttorneyUpdate} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Attorney Update PDF
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filter Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Referring Attorney</label>
                <Select 
                  value={selectedAttorney} 
                  onValueChange={setSelectedAttorney}
                  disabled={isReferringAttorney()}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select attorney" />
                  </SelectTrigger>
                  <SelectContent>
                    {!isReferringAttorney() && <SelectItem value="all">All Attorneys</SelectItem>}
                    {attorneys.map(attorney => (
                      <SelectItem key={attorney} value={attorney}>
                        {attorney}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isReferringAttorney() && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Showing data for your referrals only
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Report Type</label>
                <Select value={reportType} onValueChange={(value: 'monthly' | 'quarterly' | 'yearly') => setReportType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {reportType !== 'yearly' && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {reportType === 'monthly' ? 'Month' : 'Quarter'}
                  </label>
                  <Select 
                    value={selectedMonth.toString()} 
                    onValueChange={(value) => setSelectedMonth(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {reportType === 'monthly' ? (
                        Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            {format(new Date(2024, i, 1), 'MMMM')}
                          </SelectItem>
                        ))
                      ) : (
                        Array.from({ length: 4 }, (_, i) => (
                          <SelectItem key={i + 1} value={((i + 1) * 3).toString()}>
                            Q{i + 1}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium mb-2">Year</label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() - i;
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-end">
                <div className="bg-muted p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Outstanding Debt</div>
                  <div className="text-2xl font-bold text-primary">
                    R {reportData.reduce((sum, row) => sum + row.total_debt, 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Claimant Assessment Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Auto ID</TableHead>
                    <TableHead>Claimant Name</TableHead>
                    <TableHead>Assessment Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Report Status</TableHead>
                    <TableHead>Days Countdown</TableHead>
                    <TableHead>Expert Type(s)</TableHead>
                    <TableHead>Multiple Assessments</TableHead>
                    <TableHead>Outstanding Debt</TableHead>
                    <TableHead>Payment Status</TableHead>
                    
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        Loading report data...
                      </TableCell>
                    </TableRow>
                  ) : (
                    reportData.map((row, index) => (
                      <TableRow key={`${row.claimant_id}-${index}`}>
                        <TableCell className="font-medium">{row.auto_id}</TableCell>
                        <TableCell>{row.claimant_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {row.assessment_date}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(row.status)}
                        </TableCell>
                        <TableCell>
                          {getReportStatusBadge(row.report_status)}
                        </TableCell>
                        <TableCell>
                          {row.days_countdown ? (
                            <span className={`font-medium ${row.days_countdown >= 31 ? 'text-red-600' : 'text-foreground'}`}>
                              {row.days_countdown} days
                            </span>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {row.expert_types.map((type, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {type}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.multiple_assessments ? (
                            <Badge variant="secondary">Multiple</Badge>
                          ) : (
                            <Badge variant="outline">Single</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`font-medium ${row.total_debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            R {row.total_debt.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.payment_status === 'paid' ? 'default' : 'secondary'}>
                            {row.payment_status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {reportData.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                No assessment data found for your law firm.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Second Report - Referring Attorney Update */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Referring Attorney Update - Scheduled Assessments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScheduledAssessmentsTable selectedAttorney={selectedAttorney} />
          </CardContent>
        </Card>
      </main>

      <CompanyFooter />
    </div>
  );
};

// Scheduled Assessments Component
const ScheduledAssessmentsTable = ({ selectedAttorney }: { selectedAttorney: string }) => {
  const { toast } = useToast();
  const [updateData, setUpdateData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchUpdateData();
  }, [selectedAttorney]);

  const fetchUpdateData = async () => {
    try {
      setLoading(true);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('referring_attorney_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.referring_attorney_id) {
        return;
      }

      // Build query for scheduled appointments
      let appointmentQuery = supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          referring_attorney,
          claimant_id,
          expert_id
        `)
        .eq('referring_attorney_id', profile.referring_attorney_id)
        .eq('case_status', 'scheduled')
        .order('appointment_date', { ascending: true });

      if (selectedAttorney !== 'all') {
        appointmentQuery = appointmentQuery.eq('referring_attorney', selectedAttorney);
      }

      const { data: appointments, error } = await appointmentQuery;
      if (error) throw error;

      if (!appointments || appointments.length === 0) {
        setUpdateData([]);
        return;
      }

      // Fetch claimants separately
      const claimantIds = [...new Set(appointments.map(apt => apt.claimant_id))];
      const { data: claimants, error: claimantsError } = await supabase
        .from('claimants')
        .select('id, auto_id, first_name, last_name')
        .in('id', claimantIds);

      if (claimantsError) throw claimantsError;

      // Fetch medical experts separately
      const expertIds = [...new Set(appointments.map(apt => apt.expert_id))];
      const { data: allExperts, error: expertsError } = await supabase
        .rpc('get_medical_experts_secure');
        
      // Filter experts by IDs after fetching  
      const experts = allExperts?.filter(expert => expertIds.includes(expert.id)) || [];

      if (expertsError) throw expertsError;

      const processedData = appointments.map(appointment => {
        const appointmentDate = new Date(appointment.appointment_date);
        const claimant = claimants?.find(c => c.id === appointment.claimant_id);
        const expert = experts?.find(e => e.id === appointment.expert_id);
        
        return {
          auto_id: claimant?.auto_id || 'N/A',
          claimant_name: claimant ? `${claimant.first_name} ${claimant.last_name}` : 'Unknown',
          expert_type: expert?.expert_type || 'Not specified',
          assessment_date: format(appointmentDate, 'dd/MM/yyyy'),
          assessment_time: format(appointmentDate, 'HH:mm'),
          location: expert?.address_masked || 'Location TBD',
          appointment_id: appointment.id,
          claimant_id: claimant?.id || '',
          referring_attorney: appointment.referring_attorney || 'Unknown'
        };
      });

      setUpdateData(processedData);
    } catch (error) {
      console.error('Error fetching update data:', error);
      toast({ 
        title: "Error", 
        description: "Failed to fetch scheduled assessments data.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Auto ID</TableHead>
            <TableHead>Claimant Name</TableHead>
            <TableHead>Expert Type</TableHead>
            <TableHead>Assessment Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Location</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8">
                Loading scheduled assessments...
              </TableCell>
            </TableRow>
          ) : updateData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No scheduled assessments found.
              </TableCell>
            </TableRow>
          ) : (
            updateData.map((row, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{row.auto_id}</TableCell>
                <TableCell>{row.claimant_name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{row.expert_type}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {row.assessment_date}
                  </div>
                </TableCell>
                <TableCell className="font-mono">{row.assessment_time}</TableCell>
                <TableCell className="max-w-xs truncate" title={row.location}>
                  {row.location}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default ReferringAttorneyReport;