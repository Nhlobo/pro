import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { ArrowLeft, Download, TrendingUp, Calendar, FileText, Users, Archive, History, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import CompanyFooter from "@/components/CompanyFooter";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from "@/utils/pdfBranding";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";

const AssessmentReportsStatistics = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("monthly");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor((new Date().getMonth() + 3) / 3));
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [isHistoricalView, setIsHistoricalView] = useState(false);
  const [currentArchive, setCurrentArchive] = useState<any>(null);
  const [isClearingData, setIsClearingData] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [matterTypeData, setMatterTypeData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [expertPerformanceData, setExpertPerformanceData] = useState<any[]>([]);
  const [attorneyReportsData, setAttorneyReportsData] = useState<any[]>([]);
  const [kpiData, setKpiData] = useState({
    totalAssessments: 0,
    completedReports: 0,
    pendingReports: 0,
    reportsTakenOut: 0,
    completionRate: "0%"
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const { lastUpdate } = useAppointmentSync();

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/assessment-reports-statistics';

  // Load real data from database - now also triggered by sync updates (AOD payments, etc.)
  useEffect(() => {
    loadRealData();
    loadHistoricalData();
  }, [selectedPeriod, selectedMonth, selectedYear, selectedQuarter, user, lastUpdate]);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
          return;
        }

        setIsAdmin(data?.role === 'admin');
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  const loadRealData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Get user's referring attorney
      const { data: profile } = await supabase
        .from('profiles')
        .select('referring_attorney_id, role')
        .eq('id', user.id)
        .single();

      const lawFirmId = profile?.referring_attorney_id;
      const isAdminUser = profile?.role === 'admin';

      // Calculate date range based on selected period
      let startDate: Date, endDate: Date;
      
      switch (selectedPeriod) {
        case 'monthly':
          startDate = new Date(selectedYear, selectedMonth, 1);
          endDate = new Date(selectedYear, selectedMonth + 1, 0);
          break;
        case 'quarterly':
          const quarterStartMonth = (selectedQuarter - 1) * 3;
          startDate = new Date(selectedYear, quarterStartMonth, 1);
          endDate = new Date(selectedYear, quarterStartMonth + 3, 0);
          break;
        case 'yearly':
          startDate = new Date(selectedYear, 0, 1);
          endDate = new Date(selectedYear, 11, 31);
          break;
        default:
          startDate = new Date(selectedYear, selectedMonth, 1);
          endDate = new Date(selectedYear, selectedMonth + 1, 0);
      }

      // Fetch appointments
      let appointmentsQuery = supabase
        .from('appointments')
        .select('*')
        .gte('appointment_date', startDate.toISOString())
        .lte('appointment_date', endDate.toISOString());

      if (!isAdminUser && lawFirmId) {
        appointmentsQuery = appointmentsQuery.eq('referring_attorney_id', lawFirmId);
      }

      const { data: appointments, error: appointmentsError } = await appointmentsQuery;
      
      if (appointmentsError) throw appointmentsError;

      // Fetch expert reports
      const appointmentIds = appointments?.map(a => a.id) || [];
      
      const { data: reports, error: reportsError } = await supabase
        .from('expert_reports')
        .select('*')
        .in('appointment_id', appointmentIds.length > 0 ? appointmentIds : ['00000000-0000-0000-0000-000000000000']);
      
      if (reportsError) throw reportsError;

      // Fetch medical experts
      const expertIds = [
        ...(appointments?.map(a => a.expert_id).filter(Boolean) || []),
        ...(reports?.map(r => r.expert_id).filter(Boolean) || [])
      ];
      const uniqueExpertIds = [...new Set(expertIds)];

      const { data: experts, error: expertsError } = await supabase
        .from('medical_experts')
        .select('id, first_name, last_name')
        .in('id', uniqueExpertIds.length > 0 ? uniqueExpertIds : ['00000000-0000-0000-0000-000000000000']);
      
      if (expertsError) throw expertsError;

      // Fetch referring attorneys
      const lawFirmIds = [...new Set(appointments?.map(a => a.referring_attorney_id).filter(Boolean) || [])];
      
      const { data: lawFirms, error: lawFirmsError } = await supabase
        .from('referring_attorneys')
        .select('id, name')
        .in('id', lawFirmIds.length > 0 ? lawFirmIds : ['00000000-0000-0000-0000-000000000000']);
      
      if (lawFirmsError) throw lawFirmsError;

      // Create lookup maps for efficient joining
      const expertMap = new Map(experts?.map(e => [e.id, e]) || []);
      const lawFirmMap = new Map(lawFirms?.map(lf => [lf.id, lf]) || []);

      // Calculate matter type statistics
      const matterTypes = ['MVA', 'Medical Negligence', 'PRASA Matter', 'Other'];
      const colors = ["hsl(var(--primary))", "#82ca9d", "#ffc658", "#ff7c7c"];
      
      const matterStats = matterTypes.map((type, index) => {
        const typeAppointments = appointments?.filter(a => 
          type === 'Other' 
            ? !['MVA', 'Medical Negligence', 'PRASA Matter'].includes(a.matter_type || '')
            : a.matter_type === type
        ) || [];
        
        const typeReports = reports?.filter(r => {
          const apt = appointments?.find(a => a.id === r.appointment_id);
          return apt && (type === 'Other' 
            ? !['MVA', 'Medical Negligence', 'PRASA Matter'].includes(apt.matter_type || '')
            : apt.matter_type === type);
        }) || [];

        const completed = typeReports.filter(r => r.report_status === 'completed').length;
        const pending = typeReports.filter(r => r.report_status === 'pending').length;
        const takenOut = typeAppointments.filter(a => a.case_status === 'taken_out').length;

        return {
          name: type,
          total: typeAppointments.length,
          completed,
          pending,
          takenOut,
          color: colors[index]
        };
      });

      setMatterTypeData(matterStats);

      // Calculate KPIs
      const totalAssessments = appointments?.length || 0;
      const completedReports = reports?.filter(r => r.report_status === 'completed').length || 0;
      const pendingReports = reports?.filter(r => r.report_status === 'pending').length || 0;
      const reportsTakenOut = appointments?.filter(a => a.case_status === 'taken_out').length || 0;
      const completionRate = totalAssessments > 0 
        ? `${((completedReports / totalAssessments) * 100).toFixed(1)}%` 
        : '0%';

      setKpiData({
        totalAssessments,
        completedReports,
        pendingReports,
        reportsTakenOut,
        completionRate
      });

      // Calculate expert performance
      const expertPerformanceMap = new Map();
      reports?.forEach(report => {
        const expert = expertMap.get(report.expert_id);
        if (expert) {
          const expertName = `${expert.first_name} ${expert.last_name}`;
          if (!expertPerformanceMap.has(report.expert_id)) {
            expertPerformanceMap.set(report.expert_id, {
              name: expertName,
              assessments: 0,
              totalDays: 0,
              count: 0
            });
          }
          const perfData = expertPerformanceMap.get(report.expert_id);
          perfData.assessments++;
          if (report.days_to_complete) {
            perfData.totalDays += report.days_to_complete;
            perfData.count++;
          }
        }
      });

      const expertStats = Array.from(expertPerformanceMap.values())
        .map(e => ({
          name: e.name,
          assessments: e.assessments,
          satisfaction: e.count > 0 ? Math.min(5, 5 - (e.totalDays / e.count / 10)) : 4.5
        }))
        .sort((a, b) => b.assessments - a.assessments)
        .slice(0, 10);

      setExpertPerformanceData(expertStats);

      // Calculate monthly trends (for the selected period)
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyStats: any[] = [];
      
      if (selectedPeriod === 'yearly') {
        for (let m = 0; m < 12; m++) {
          const monthStart = new Date(selectedYear, m, 1);
          const monthEnd = new Date(selectedYear, m + 1, 0);
          
          const monthAppointments = appointments?.filter(a => {
            const date = new Date(a.appointment_date);
            return date >= monthStart && date <= monthEnd;
          }) || [];
          
          const monthReports = reports?.filter(r => {
            const apt = appointments?.find(a => a.id === r.appointment_id);
            if (!apt) return false;
            const date = new Date(apt.appointment_date);
            return date >= monthStart && date <= monthEnd;
          }) || [];

          monthlyStats.push({
            month: monthNames[m],
            completed: monthReports.filter(r => r.report_status === 'completed').length,
            pending: monthReports.filter(r => r.report_status === 'pending').length,
            takenOut: monthAppointments.filter(a => a.case_status === 'taken_out').length
          });
        }
      } else if (selectedPeriod === 'quarterly') {
        const quarterMonths = [(selectedQuarter - 1) * 3, (selectedQuarter - 1) * 3 + 1, (selectedQuarter - 1) * 3 + 2];
        quarterMonths.forEach(m => {
          const monthStart = new Date(selectedYear, m, 1);
          const monthEnd = new Date(selectedYear, m + 1, 0);
          
          const monthAppointments = appointments?.filter(a => {
            const date = new Date(a.appointment_date);
            return date >= monthStart && date <= monthEnd;
          }) || [];
          
          const monthReports = reports?.filter(r => {
            const apt = appointments?.find(a => a.id === r.appointment_id);
            if (!apt) return false;
            const date = new Date(apt.appointment_date);
            return date >= monthStart && date <= monthEnd;
          }) || [];

          monthlyStats.push({
            month: monthNames[m],
            completed: monthReports.filter(r => r.report_status === 'completed').length,
            pending: monthReports.filter(r => r.report_status === 'pending').length,
            takenOut: monthAppointments.filter(a => a.case_status === 'taken_out').length
          });
        });
      }
      
      setMonthlyData(monthlyStats);

      // Calculate attorney/referring attorney statistics
      const lawFirmStatsMap = new Map();
      appointments?.forEach(apt => {
        const lawFirm = lawFirmMap.get(apt.referring_attorney_id);
        
        if (lawFirm) {
          if (!lawFirmStatsMap.has(apt.referring_attorney_id)) {
            lawFirmStatsMap.set(apt.referring_attorney_id, {
              name: lawFirm.name,
              referrals: 0,
              completed: 0,
              pending: 0
            });
          }
          const firm = lawFirmStatsMap.get(apt.referring_attorney_id);
          if (firm) {
            firm.referrals++;
            
            const report = reports?.find(r => r.appointment_id === apt.id);
            if (report?.report_status === 'completed') {
              firm.completed++;
            } else if (report?.report_status === 'pending') {
              firm.pending++;
            }
          }
        }
      });

      const attorneyStats = Array.from(lawFirmStatsMap.values())
        .map(f => ({
          name: f.name,
          referrals: f.referrals,
          completed: f.completed,
          pending: f.pending,
          response_time: 2.5,
          success_rate: f.referrals > 0 ? (f.completed / f.referrals) * 100 : 0
        }))
        .sort((a, b) => b.referrals - a.referrals)
        .slice(0, 10);

      setAttorneyReportsData(attorneyStats);

    } catch (error) {
      console.error('Error loading real data:', error);
      toast({
        title: "Error",
        description: "Failed to load statistics data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistoricalData = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('archive-assessment-data', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        body: { period_type: selectedPeriod }
      });

      if (error) throw error;
      setHistoricalData(data.archives || []);
    } catch (error) {
      console.error('Error loading historical data:', error);
      toast({
        title: "Error",
        description: "Failed to load historical data",
        variant: "destructive",
      });
    }
  };

  const archiveCurrentData = async () => {
    try {
      const currentDate = new Date();
      let periodStart: Date, periodEnd: Date;

      switch (selectedPeriod) {
        case 'monthly':
          periodStart = new Date(selectedYear, selectedMonth, 1);
          periodEnd = new Date(selectedYear, selectedMonth + 1, 0);
          break;
        case 'quarterly':
          const quarterStartMonth = (selectedQuarter - 1) * 3;
          periodStart = new Date(selectedYear, quarterStartMonth, 1);
          periodEnd = new Date(selectedYear, quarterStartMonth + 3, 0);
          break;
        case 'yearly':
          periodStart = new Date(selectedYear, 0, 1);
          periodEnd = new Date(selectedYear, 11, 31);
          break;
        default:
          return;
      }

      const assessmentData = {
        total_assessments: kpiData.totalAssessments,
        completed_reports: kpiData.completedReports,
        pending_reports: kpiData.pendingReports,
        reports_taken_out: kpiData.reportsTakenOut,
        completion_rate: parseFloat(kpiData.completionRate.replace('%', '')),
        matter_type_data: matterTypeData,
        expert_performance_data: expertPerformanceData,
        monthly_trends_data: monthlyData,
        attorney_reports_data: attorneyReportsData,
        attorney_performance_data: [],
      };

      const { data, error } = await supabase.functions.invoke('archive-assessment-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          period_type: selectedPeriod,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          assessment_data: assessmentData,
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `${selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} data archived successfully`,
      });

      // Reload historical data
      loadHistoricalData();
    } catch (error) {
      console.error('Error archiving data:', error);
      toast({
        title: "Error",
        description: "Failed to archive current data",
        variant: "destructive",
      });
    }
  };

  const clearAssessmentData = async () => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only administrators can clear assessment data",
        variant: "destructive",
      });
      return;
    }

    setIsClearingData(true);
    try {
      const { data, error } = await supabase.rpc('clear_assessment_data');

      if (error) throw error;

      const result = data as { total_deleted: number; appointments_deleted: number; expert_reports_deleted: number; archives_deleted: number; };

      toast({
        title: "Success",
        description: `Assessment data cleared successfully. ${result?.total_deleted || 0} records removed.`,
      });

      // Reload historical data to reflect changes
      loadHistoricalData();
    } catch (error) {
      console.error('Error clearing assessment data:', error);
      toast({
        title: "Error",
        description: "Failed to clear assessment data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClearingData(false);
    }
  };

  const loadHistoricalReport = (archive: any) => {
    setCurrentArchive(archive);
    setIsHistoricalView(true);
  };

  const generateHistoricalPDF = (archive: any) => {
    const doc = new jsPDF();
    
    const periodStart = new Date(archive.period_start);
    const periodEnd = new Date(archive.period_end);
    
    let periodTitle = '';
    let filename = '';
    
    switch (archive.period_type) {
      case 'monthly':
        periodTitle = `${periodStart.toLocaleString('default', { month: 'long' })} ${periodStart.getFullYear()}`;
        filename = `historical-assessment-report-${periodStart.toLocaleString('default', { month: 'long' }).toLowerCase()}-${periodStart.getFullYear()}.pdf`;
        break;
      case 'quarterly':
        const quarter = Math.floor((periodStart.getMonth() + 3) / 3);
        periodTitle = `Q${quarter} ${periodStart.getFullYear()}`;
        filename = `historical-assessment-report-q${quarter}-${periodStart.getFullYear()}.pdf`;
        break;
      case 'yearly':
        periodTitle = `${periodStart.getFullYear()}`;
        filename = `historical-assessment-report-${periodStart.getFullYear()}.pdf`;
        break;
    }
    
    // Add branding
    let currentY = addBrandingToPDF(doc, 'Historical Assessment Reports & Statistics', `Report Period: ${periodTitle}`);
    
    // Add archived date
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Archived: ${new Date(archive.archived_date).toLocaleDateString()}`, 105, currentY, { align: 'center' });
    currentY += 20;
    
    // KPI Summary
    doc.setFontSize(16);
    doc.text('Key Performance Indicators', 20, currentY);
    currentY += 10;
    
    const kpiTableData = [
      ['Total Assessments', archive.total_assessments.toString()],
      ['Completed Reports', archive.completed_reports.toString()],
      ['Pending Reports', archive.pending_reports.toString()],
      ['Reports Taken Out', archive.reports_taken_out.toString()],
      ['Completion Rate', `${archive.completion_rate}%`]
    ];
    
    autoTable(doc, {
      startY: currentY,
      head: [['Metric', 'Value']],
      body: kpiTableData,
      theme: 'striped',
      ...getStyledTableOptions()
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 20;
    
    // Matter Type Analysis
    doc.setFontSize(16);
    doc.text('Assessment Analysis by Matter Type', 20, currentY);
    currentY += 10;
    
    const matterTableData = archive.matter_type_data.map((matter: any) => [
      matter.name,
      matter.total.toString(),
      matter.completed.toString(),
      matter.pending.toString(),
      matter.takenOut.toString(),
      `${((matter.completed / matter.total) * 100).toFixed(1)}%`
    ]);
    
    autoTable(doc, {
      startY: currentY,
      head: [['Matter Type', 'Total', 'Completed', 'Pending', 'Taken Out', 'Completion Rate']],
      body: matterTableData,
      theme: 'striped',
      ...getStyledTableOptions()
    });
    
    // Add branded footer
    addBrandingFooter(doc);
    
    doc.save(filename);
  };

  // Get the data to display (current or historical)
  const displayData = isHistoricalView && currentArchive ? {
    totalAssessments: currentArchive.total_assessments,
    completedReports: currentArchive.completed_reports,
    pendingReports: currentArchive.pending_reports,
    reportsTakenOut: currentArchive.reports_taken_out,
    completionRate: `${currentArchive.completion_rate}%`,
    matterTypeData: currentArchive.matter_type_data,
    expertPerformanceData: currentArchive.expert_performance_data,
    monthlyData: currentArchive.monthly_trends_data,
    attorneyReportsData: currentArchive.attorney_reports_data || attorneyReportsData,
  } : {
    totalAssessments: kpiData.totalAssessments,
    completedReports: kpiData.completedReports,
    pendingReports: kpiData.pendingReports,
    reportsTakenOut: kpiData.reportsTakenOut,
    completionRate: kpiData.completionRate,
    matterTypeData,
    expertPerformanceData,
    monthlyData,
    attorneyReportsData,
  };

  const reportStatusData = [
    { name: "Completed Reports", value: displayData.completedReports, color: "hsl(var(--primary))" },
    { name: "Reports Taken Out", value: displayData.reportsTakenOut, color: "#ff7c7c" },
    { name: "Pending Reports", value: displayData.pendingReports, color: "#ffc658" }
  ];

  const generatePDFReport = () => {
    const doc = new jsPDF();
    
    // Get current date and period info
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
    const currentYear = currentDate.getFullYear();
    const currentQuarter = Math.floor((currentDate.getMonth() + 3) / 3);
    
    let periodTitle = '';
    let filename = '';
    
    switch (selectedPeriod) {
      case 'monthly':
        periodTitle = `${currentMonth} ${currentYear}`;
        filename = `assessment-report-${currentMonth.toLowerCase()}-${currentYear}.pdf`;
        break;
      case 'quarterly':
        periodTitle = `Q${currentQuarter} ${currentYear}`;
        filename = `assessment-report-q${currentQuarter}-${currentYear}.pdf`;
        break;
      case 'yearly':
        periodTitle = `${currentYear}`;
        filename = `assessment-report-${currentYear}.pdf`;
        break;
    }
    
    // Add branding
    let currentY = addBrandingToPDF(doc, 'Assessment Reports & Statistics', `Report Period: ${periodTitle}`);
    
    // KPI Summary
    doc.setFontSize(16);
    doc.text('Key Performance Indicators', 20, currentY);
    currentY += 10;
    
    const kpiTableData = [
      ['Total Assessments', kpiData.totalAssessments.toString()],
      ['Completed Reports', kpiData.completedReports.toString()],
      ['Pending Reports', kpiData.pendingReports.toString()],
      ['Reports Taken Out', kpiData.reportsTakenOut.toString()],
      ['Completion Rate', kpiData.completionRate]
    ];
    
    autoTable(doc, {
      startY: currentY,
      head: [['Metric', 'Value']],
      body: kpiTableData,
      theme: 'striped',
      ...getStyledTableOptions()
    });
    
    // Get the final Y position after the table
    currentY = (doc as any).lastAutoTable.finalY + 20;
    
    // Matter Type Analysis
    doc.setFontSize(16);
    doc.text('Assessment Analysis by Matter Type', 20, currentY);
    currentY += 10;
    
    const matterTableData = matterTypeData.map(matter => [
      matter.name,
      matter.total.toString(),
      matter.completed.toString(),
      matter.pending.toString(),
      matter.takenOut.toString(),
      `${((matter.completed / matter.total) * 100).toFixed(1)}%`
    ]);
    
    autoTable(doc, {
      startY: currentY,
      head: [['Matter Type', 'Total', 'Completed', 'Pending', 'Taken Out', 'Completion Rate']],
      body: matterTableData,
      theme: 'striped',
      ...getStyledTableOptions()
    });
    
    // Expert Performance (if needed)
    if (expertPerformanceData.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Expert Performance Overview', 20, 20);
      
      const expertTableData = expertPerformanceData.map(expert => [
        expert.name,
        expert.assessments.toString(),
        expert.satisfaction.toString()
      ]);
      
      autoTable(doc, {
        startY: 30,
        head: [['Expert Name', 'Assessments', 'Satisfaction Rating']],
        body: expertTableData,
        theme: 'striped',
        ...getStyledTableOptions()
      });
    }
    
    // Add branded footer
    addBrandingFooter(doc);
    
    // Save the PDF
    doc.save(filename);
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Assessment Reports & Statistics - Medico-Legal Assessment System</title>
        <meta name="description" content="Comprehensive reports and statistics for medical assessment performance, completion rates, and expert analytics." />
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
              <h1 className="text-2xl font-bold">
                {isHistoricalView ? 'Historical Assessment Reports' : 'Assessment Reports & Statistics'}
              </h1>
              {isHistoricalView && (
                <Button variant="outline" size="sm" onClick={() => {
                  setIsHistoricalView(false);
                  setCurrentArchive(null);
                }}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Current
                </Button>
              )}
            </div>
            <div className="flex items-center gap-4">
              {!isHistoricalView && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      loadRealData();
                      toast({
                        title: "Refreshed",
                        description: "Statistics updated with latest appointment data",
                      });
                    }}
                    disabled={isLoading}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isLoading ? 'Loading...' : 'Refresh Data'}
                  </Button>
                  
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly View</SelectItem>
                      <SelectItem value="quarterly">Quarterly View</SelectItem>
                      <SelectItem value="yearly">Yearly View</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {selectedPeriod === "monthly" && (
                    <>
                      <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {new Date(0, i).toLocaleString('default', { month: 'long' })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue placeholder="Year" />
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
                    </>
                  )}
                  
                  <Button onClick={archiveCurrentData} variant="outline" className="flex items-center gap-2">
                    <Archive className="h-4 w-4" />
                    Archive Current
                  </Button>
                  
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="flex items-center gap-2" disabled={isClearingData}>
                          <Trash2 className="h-4 w-4" />
                          {isClearingData ? 'Clearing...' : 'Clear Data'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Clear Assessment Data</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action will permanently delete all assessment data including appointments, expert reports, and archives. 
                            This action cannot be undone. Are you sure you want to continue?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={clearAssessmentData}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Yes, Clear All Data
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  
                  <Button onClick={generatePDFReport} className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export Report
                  </Button>
                </>
              )}
              
              {isHistoricalView && currentArchive && (
                <Button onClick={() => generateHistoricalPDF(currentArchive)} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download Historical Report
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Data Source Information */}
        {!isHistoricalView && (
          <Card className="mb-6 border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-sm mb-1">Live Data from Scheduled Assessments</h3>
                  <p className="text-sm text-muted-foreground">
                    This page displays real-time statistics from appointments created in the{' '}
                    <Link to="/scheduled-assessment" className="text-primary hover:underline font-medium">
                      Schedule Assessment Appointment
                    </Link>{' '}
                    page. Data automatically refreshes every 30 seconds, or click "Refresh Data" for immediate updates.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Historical Data Navigation */}
        {!isHistoricalView && historicalData.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historical Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {historicalData.slice(0, 6).map((archive) => {
                  const periodStart = new Date(archive.period_start);
                  const periodTitle = archive.period_type === 'monthly' 
                    ? `${periodStart.toLocaleString('default', { month: 'long' })} ${periodStart.getFullYear()}`
                    : archive.period_type === 'quarterly'
                    ? `Q${Math.floor((periodStart.getMonth() + 3) / 3)} ${periodStart.getFullYear()}`
                    : `${periodStart.getFullYear()}`;
                  
                  return (
                    <Card key={archive.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => loadHistoricalReport(archive)}>
                      <CardContent className="p-4">
                        <h4 className="font-semibold text-sm mb-2">{periodTitle}</h4>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>Total: {archive.total_assessments}</p>
                          <p>Completed: {archive.completed_reports}</p>
                          <p>Rate: {archive.completion_rate}%</p>
                        </div>
                        <Button size="sm" variant="outline" className="w-full mt-3">
                          View Report
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Total Assessments</span>
              </div>
              <p className="text-2xl font-bold mt-2">{displayData.totalAssessments}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">Completed Reports</span>
              </div>
              <p className="text-2xl font-bold mt-2">{displayData.completedReports}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-muted-foreground">Pending Reports</span>
              </div>
              <p className="text-2xl font-bold mt-2">{displayData.pendingReports}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-red-600" />
                <span className="text-sm text-muted-foreground">Reports Taken Out</span>
              </div>
              <p className="text-2xl font-bold mt-2">{displayData.reportsTakenOut}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-muted-foreground">Completion Rate</span>
              </div>
              <p className="text-2xl font-bold mt-2">{displayData.completionRate}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="attorney-reports">Attorney Reports</TabsTrigger>
            <TabsTrigger value="performance">Expert Performance</TabsTrigger>
            <TabsTrigger value="trends">Trends Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Matter Type Contributions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle>Assessments by Matter Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={displayData.matterTypeData}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="total" fill="hsl(var(--primary))" name="Total Assessments" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Overall Report Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={reportStatusData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {reportStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Matter Type Comparison Table */}
            <Card>
              <CardHeader>
                <CardTitle>Matter Type Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Matter Type</th>
                        <th className="text-center p-2">Total Assessments</th>
                        <th className="text-center p-2">Completed Reports</th>
                        <th className="text-center p-2">Pending Reports</th>
                        <th className="text-center p-2">Reports Taken Out</th>
                        <th className="text-center p-2">Completion Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayData.matterTypeData.map((matter: any, index: number) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-medium">{matter.name}</td>
                          <td className="text-center p-2">{matter.total}</td>
                          <td className="text-center p-2 text-green-600">{matter.completed}</td>
                          <td className="text-center p-2 text-yellow-600">{matter.pending}</td>
                          <td className="text-center p-2 text-red-600">{matter.takenOut}</td>
                          <td className="text-center p-2">{((matter.completed / matter.total) * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Status Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Report Status Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={displayData.monthlyData}>
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="completed" fill="hsl(var(--primary))" name="Completed" />
                      <Bar dataKey="pending" fill="#ffc658" name="Pending" />
                      <Bar dataKey="takenOut" fill="#ff7c7c" name="Taken Out" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attorney-reports" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Law Firms</p>
                      <p className="text-2xl font-bold">{attorneyReportsData.length}</p>
                    </div>
                    <FileText className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Referrals</p>
                      <p className="text-2xl font-bold">{attorneyReportsData.reduce((sum, attorney) => sum + attorney.referrals, 0)}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                      <p className="text-2xl font-bold">{(attorneyReportsData.reduce((sum, attorney) => sum + attorney.response_time, 0) / attorneyReportsData.length).toFixed(1)}h</p>
                    </div>
                    <Calendar className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg Success Rate</p>
                      <p className="text-2xl font-bold">{(attorneyReportsData.reduce((sum, attorney) => sum + attorney.success_rate, 0) / attorneyReportsData.length).toFixed(1)}%</p>
                    </div>
                    <Users className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* Attorney Reports Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Law Firm Performance Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-4">Law Firm</th>
                          <th className="text-center py-2 px-4">Referrals</th>
                          <th className="text-center py-2 px-4">Completed</th>
                          <th className="text-center py-2 px-4">Pending</th>
                          <th className="text-center py-2 px-4">Success Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayData.attorneyReportsData.map((attorney, index) => (
                          <tr key={index} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4">{attorney.name}</td>
                            <td className="text-center py-3 px-4">{attorney.referrals}</td>
                            <td className="text-center py-3 px-4">{attorney.completed}</td>
                            <td className="text-center py-3 px-4">{attorney.pending}</td>
                            <td className="text-center py-3 px-4">{attorney.success_rate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Attorney Performance Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Attorney Performance Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">Law Firm</th>
                        <th className="text-left py-2 px-4">Referrals</th>
                        <th className="text-left py-2 px-4">Completed</th>
                        <th className="text-left py-2 px-4">Pending</th>
                        <th className="text-left py-2 px-4">Response Time (hrs)</th>
                        <th className="text-left py-2 px-4">Success Rate (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attorneyReportsData.map((attorney, index) => (
                        <tr key={index} className="border-b last:border-0">
                          <td className="py-2 px-4 font-medium">{attorney.name}</td>
                          <td className="py-2 px-4">{attorney.referrals}</td>
                          <td className="py-2 px-4">
                            <span className="text-green-600 font-medium">{attorney.completed}</span>
                          </td>
                          <td className="py-2 px-4">
                            <span className="text-orange-600 font-medium">{attorney.pending}</span>
                          </td>
                          <td className="py-2 px-4">
                            <span className={`font-medium ${
                              attorney.response_time <= 2 ? 'text-green-600' : 
                              attorney.response_time <= 3 ? 'text-orange-600' : 'text-red-600'
                            }`}>
                              {attorney.response_time}
                            </span>
                          </td>
                          <td className="py-2 px-4">
                            <span className={`font-medium ${
                              attorney.success_rate >= 92 ? 'text-green-600' : 
                              attorney.success_rate >= 88 ? 'text-orange-600' : 'text-red-600'
                            }`}>
                              {attorney.success_rate.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Expert Performance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={displayData.expertPerformanceData}>
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="assessments" fill="hsl(var(--primary))" name="Assessments Completed" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Assessment Completion Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={displayData.monthlyData}>
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="completed" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <CompanyFooter />
    </div>
  );
};

export default AssessmentReportsStatistics;