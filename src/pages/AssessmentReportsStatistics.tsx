import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import {
  ArrowLeft, Download, TrendingUp, TrendingDown, Calendar, FileText, Users, Archive,
  History, Trash2, BarChart3, RefreshCw, Wifi, WifiOff, Clock, Target, Activity,
  PieChart as PieChartIcon, LineChart as LineChartIcon, ArrowUpRight, CheckCircle2,
} from "lucide-react";
import { Link } from "react-router-dom";
import CompanyFooter from "@/components/CompanyFooter";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from "@/utils/pdfBranding";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";
import {
  AdminPage,
  AdminHeader,
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminStatCard,
  AdminPill,
  AdminSectionLabel,
  AdminTabList,
  AdminTabTrigger,
  AdminEmptyState,
  BRAND_TEAL,
} from "@/components/admin/ui/AdminUI";

/**
 * Shared recharts tooltip — flat hairline card matching the Admin Portal
 * Analytics module, so every chart on this page (and that one) reads as the
 * same product instead of two different chart styles.
 */
const StatsTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-black/10 bg-white px-3 py-2 shadow-sm">
      {label && <p className="text-xs font-semibold text-black">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey || p.name} className="text-xs text-slate-500">
          <span className="mr-1.5 inline-block h-2 w-2 align-middle" style={{ backgroundColor: p.fill || p.stroke || p.payload?.color }} />
          {p.name}: <span className="font-medium text-black">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

const AssessmentReportsStatistics = ({ embedded = false }: { embedded?: boolean } = {}) => {
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
  const { lastUpdate, isConnected, syncStatus } = useAppointmentSync();

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
      const colors = [BRAND_TEAL, "#0B0B0B", "#F59E0B", "#94A3B8"];
      
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
      // GET requests can't carry a fetch body — browsers throw
      // "Request with GET/HEAD method cannot have body" before this even
      // reaches the network, which is exactly what was surfacing as
      // "Failed to load historical data" on every load. The function's
      // GET branch reads period_type from the URL query string anyway
      // (see supabase/functions/archive-assessment-data), so send it
      // there instead of in a body.
      const { data, error } = await supabase.functions.invoke(
        `archive-assessment-data?period_type=${encodeURIComponent(selectedPeriod)}`,
        { method: 'GET' }
      );

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
    { name: "Completed Reports", value: displayData.completedReports, color: BRAND_TEAL },
    { name: "Reports Taken Out", value: displayData.reportsTakenOut, color: "#F43F5E" },
    { name: "Pending Reports", value: displayData.pendingReports, color: "#F59E0B" }
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

  const periodLabel =
    selectedPeriod === "monthly"
      ? `${new Date(0, selectedMonth).toLocaleString("default", { month: "long" })} ${selectedYear}`
      : selectedPeriod === "quarterly"
      ? `Q${selectedQuarter} ${selectedYear}`
      : `${selectedYear}`;

  const maxExpertAssessments = Math.max(1, ...expertPerformanceData.map((e) => e.assessments));

  // Shared between the standalone page's own sticky header and the Admin
  // Portal header used when embedded, so the two never drift apart.
  const liveSyncPill = !isHistoricalView && (
    <span className="hidden items-center gap-1 text-[10px] font-medium text-slate-400 sm:inline-flex">
      <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-slate-300"}`} />
      {isConnected ? "Live sync" : "Reconnecting…"}
    </span>
  );

  const headerActions = (
    <>
      {isHistoricalView ? (
        <Button
          variant="outline"
          size="sm"
          className="rounded-none border-black/15"
          onClick={() => {
            setIsHistoricalView(false);
            setCurrentArchive(null);
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Current
        </Button>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            className="rounded-none border-black/15"
            onClick={() => {
              loadRealData();
              toast({
                title: "Refreshed",
                description: "Statistics updated with latest appointment data",
              });
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Loading…" : "Refresh"}
          </Button>

          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[130px] rounded-none border-black/15 sm:w-[160px]">
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
                <SelectTrigger className="w-[110px] rounded-none border-black/15 sm:w-[130px]">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {new Date(0, i).toLocaleString("default", { month: "long" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="w-[85px] rounded-none border-black/15 sm:w-[95px]">
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

          <Button
            onClick={archiveCurrentData}
            variant="outline"
            size="sm"
            className="rounded-none border-black/15"
          >
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </Button>

          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-none border-destructive/30 text-destructive hover:bg-destructive/5"
                  disabled={isClearingData}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isClearingData ? "Clearing…" : "Clear Data"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-none">
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Assessment Data</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will permanently delete all assessment data including appointments, expert reports, and archives.
                    This action cannot be undone. Are you sure you want to continue?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={clearAssessmentData}
                    className="rounded-none bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, Clear All Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Button
            onClick={generatePDFReport}
            size="sm"
            className="rounded-none bg-black text-white hover:bg-black/90"
          >
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </>
      )}

      {isHistoricalView && currentArchive && (
        <Button
          onClick={() => generateHistoricalPDF(currentArchive)}
          size="sm"
          className="rounded-none bg-black text-white hover:bg-black/90"
        >
          <Download className="mr-2 h-4 w-4" />
          Download Report
        </Button>
      )}
    </>
  );

  return (
    <div className={embedded ? '' : 'min-h-screen bg-background'}>
      {!embedded && (
        <Helmet>
          <title>Assessment Reports & Statistics - Medico-Legal Assessment System</title>
          <meta name="description" content="Comprehensive reports and statistics for medical assessment performance, completion rates, and expert analytics." />
          <link rel="canonical" href={canonicalUrl} />
        </Helmet>
      )}

      {/* SystemHeaderNav previously rendered here too, stacking a second,
          differently-styled header above the one below — removed so this
          page has exactly one header, like every other page. */}

      {/* ------------------------------------------------------------- */}
      {/* Header — same eyebrow/icon/title language as the Admin Portal  */}
      {/* Analytics module (AdminHeader), rebuilt inline here because     */}
      {/* this route renders outside the admin sidebar shell and keeps   */}
      {/* its own action bar (period pickers, archive, export, clear).   */}
      {/* When embedded inside the Admin Portal, the shared AdminHeader  */}
      {/* is used instead (below, inside AdminPage) so this doesn't ship */}
      {/* a second, differently-styled header alongside the real one.   */}
      {/* ------------------------------------------------------------- */}
      {!embedded && (
      <header className="sticky top-0 z-30 border-b border-black/10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="container mx-auto px-4 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/5">
                <BarChart3 className="h-5 w-5" style={{ color: BRAND_TEAL }} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: BRAND_TEAL }}>
                    {isHistoricalView ? "Archived Period" : "Reporting"}
                  </span>
                  {liveSyncPill}
                </div>
                <h1 className="truncate text-xl font-bold text-black sm:text-2xl">
                  {isHistoricalView ? "Historical Assessment Reports" : "Assessment Reports & Statistics"}
                </h1>
                <p className="truncate text-xs text-slate-500 md:text-sm">
                  {isHistoricalView
                    ? "Archived snapshot — read-only view of a past reporting period"
                    : "Live performance across assessments, experts, and referring attorneys"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-none border-black/15" asChild>
                <Link to="/dashboard">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              {headerActions}
            </div>
          </div>
        </div>
      </header>
      )}

      <main className={embedded ? '' : 'container mx-auto px-4 py-8'}>
        <AdminPage>
          {embedded && (
            <AdminHeader
              eyebrow={
                <span className="inline-flex items-center gap-2">
                  {isHistoricalView ? "Archived Period" : "Reporting"}
                  {liveSyncPill}
                </span>
              }
              title={isHistoricalView ? "Historical Assessment Reports" : "Assessment Reports & Statistics"}
              description={
                isHistoricalView
                  ? "Archived snapshot — read-only view of a past reporting period"
                  : "Live performance across assessments, experts, and referring attorneys"
              }
              icon={BarChart3}
              actions={<>{headerActions}</>}
            />
          )}
          {/* Data source / live-sync banner */}
          {!isHistoricalView && (
            <AdminCard className="animate-fade-in border-l-4" style={{ borderLeftColor: BRAND_TEAL }}>
              <AdminCardBody className="flex items-start gap-3 p-4">
                <Calendar className="mt-0.5 h-5 w-5 shrink-0" style={{ color: BRAND_TEAL }} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-black">Live data from scheduled assessments</h3>
                    <AdminPill tone={isConnected ? "teal" : "neutral"}>
                      {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                      {syncStatus === "syncing" ? "Syncing" : isConnected ? "Connected" : "Offline"}
                    </AdminPill>
                  </div>
                  <p className="text-sm text-slate-500">
                    This page reflects real-time statistics from appointments created in the{" "}
                    <Link
                      to={embedded ? "/admin/appointments" : "/scheduled-assessment"}
                      className="font-medium text-primary hover:underline"
                    >
                      Schedule Assessment Appointment
                    </Link>{" "}
                    workflow. It updates automatically as new appointments and reports come in — use{" "}
                    <span className="font-medium text-black">Refresh</span> any time for an immediate pull.
                  </p>
                </div>
              </AdminCardBody>
            </AdminCard>
          )}

          {/* Historical archive navigator */}
          {!isHistoricalView && historicalData.length > 0 && (
            <div className="animate-fade-in space-y-3">
              <AdminSectionLabel>Historical Reports</AdminSectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {historicalData.slice(0, 6).map((archive, i) => {
                  const periodStart = new Date(archive.period_start);
                  const periodTitle =
                    archive.period_type === "monthly"
                      ? `${periodStart.toLocaleString("default", { month: "long" })} ${periodStart.getFullYear()}`
                      : archive.period_type === "quarterly"
                      ? `Q${Math.floor((periodStart.getMonth() + 3) / 3)} ${periodStart.getFullYear()}`
                      : `${periodStart.getFullYear()}`;

                  return (
                    <AdminCard
                      key={archive.id}
                      className="group animate-fade-in cursor-pointer transition-colors hover:border-black/25"
                      style={{ animationDelay: `${i * 40}ms` }}
                      onClick={() => loadHistoricalReport(archive)}
                    >
                      <AdminCardBody className="p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-black">{periodTitle}</h4>
                          <History className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                        <div className="space-y-1 text-xs text-slate-500">
                          <p>Total: <span className="font-medium text-black">{archive.total_assessments}</span></p>
                          <p>Completed: <span className="font-medium text-black">{archive.completed_reports}</span></p>
                          <p>Rate: <span className="font-medium text-black">{archive.completion_rate}%</span></p>
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-2 text-xs font-medium" style={{ color: BRAND_TEAL }}>
                          View report
                          <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </div>
                      </AdminCardBody>
                    </AdminCard>
                  );
                })}
              </div>
            </div>
          )}

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-5">
            {[
              { label: isHistoricalView ? `Total — ${periodLabel}` : "Total Assessments", value: displayData.totalAssessments, icon: FileText },
              { label: "Completed Reports", value: displayData.completedReports, icon: CheckCircle2 },
              { label: "Pending Reports", value: displayData.pendingReports, icon: Clock },
              { label: "Reports Taken Out", value: displayData.reportsTakenOut, icon: Archive },
              { label: "Completion Rate", value: displayData.completionRate, icon: Target },
            ].map((kpi, i) => (
              <div key={kpi.label} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                <AdminStatCard label={kpi.label} value={kpi.value} icon={kpi.icon} loading={isLoading && !isHistoricalView} />
              </div>
            ))}
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <AdminTabList>
              <AdminTabTrigger value="overview" label="Overview" icon={BarChart3} />
              <AdminTabTrigger value="attorney-reports" label="Attorney Reports" icon={Users} />
              <AdminTabTrigger value="performance" label="Expert Performance" icon={Activity} />
              <AdminTabTrigger value="trends" label="Trends Analysis" icon={LineChartIcon} />
            </AdminTabList>

            {/* ----------------------------- Overview ----------------------------- */}
            <TabsContent value="overview" className="mt-4 space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 md:gap-6">
                <AdminCard className="animate-fade-in">
                  <AdminCardHeader icon={BarChart3} title="Assessments by Matter Type" description="Total volume per matter category" />
                  <AdminCardBody>
                    {displayData.matterTypeData?.length ? (
                      <div className="h-72 w-full sm:h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={displayData.matterTypeData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.08)" />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "rgba(0,0,0,0.1)" }} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip content={<StatsTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                            <Bar dataKey="total" name="Total Assessments" fill={BRAND_TEAL} radius={[2, 2, 0, 0]} maxBarSize={48} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <AdminEmptyState icon={BarChart3} title="No assessment data yet" description="Data will appear once assessments are scheduled for this period." />
                    )}
                  </AdminCardBody>
                </AdminCard>

                <AdminCard className="animate-fade-in" style={{ animationDelay: "60ms" }}>
                  <AdminCardHeader icon={PieChartIcon} title="Report Status Distribution" description="Share of completed, pending, and taken-out reports" />
                  <AdminCardBody>
                    {reportStatusData.some((d) => d.value > 0) ? (
                      <>
                        <div className="h-64 w-full sm:h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={reportStatusData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                outerRadius={90}
                                dataKey="value"
                              >
                                {reportStatusData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip content={<StatsTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-4 border-t border-black/10 pt-3">
                          {reportStatusData.map((d) => (
                            <div key={d.name} className="flex items-center gap-1.5">
                              <div className="h-2.5 w-2.5" style={{ backgroundColor: d.color }} />
                              <span className="text-xs text-slate-500">{d.name}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <AdminEmptyState icon={PieChartIcon} title="No report status data yet" description="Data will appear once expert reports are logged for this period." />
                    )}
                  </AdminCardBody>
                </AdminCard>
              </div>

              <AdminCard className="animate-fade-in" style={{ animationDelay: "100ms" }}>
                <AdminCardHeader icon={FileText} title="Matter Type Comparison" description="Completion breakdown per matter category" />
                <AdminCardBody className="p-0">
                  {displayData.matterTypeData?.length ? (
                    <>
                      <div className="hidden overflow-x-auto md:block">
                        <Table className="text-xs [&_td]:px-4 [&_td]:py-2.5 [&_th]:h-9 [&_th]:px-4 [&_th]:text-[11px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Matter Type</TableHead>
                              <TableHead className="text-center">Total</TableHead>
                              <TableHead className="text-center">Completed</TableHead>
                              <TableHead className="text-center">Pending</TableHead>
                              <TableHead className="text-center">Taken Out</TableHead>
                              <TableHead className="text-right">Completion Rate</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {displayData.matterTypeData.map((matter: any, index: number) => (
                              <TableRow key={index} className="hover:bg-black/[0.02]">
                                <TableCell className="font-medium text-black">{matter.name}</TableCell>
                                <TableCell className="text-center">{matter.total}</TableCell>
                                <TableCell className="text-center text-emerald-600">{matter.completed}</TableCell>
                                <TableCell className="text-center text-amber-600">{matter.pending}</TableCell>
                                <TableCell className="text-center text-rose-600">{matter.takenOut}</TableCell>
                                <TableCell className="text-right font-medium text-black">
                                  {matter.total > 0 ? ((matter.completed / matter.total) * 100).toFixed(1) : "0.0"}%
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="divide-y divide-black/10 md:hidden">
                        {displayData.matterTypeData.map((matter: any, index: number) => (
                          <div key={index} className="p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-sm font-semibold text-black">{matter.name}</p>
                              <span className="text-xs font-medium text-black">
                                {matter.total > 0 ? ((matter.completed / matter.total) * 100).toFixed(1) : "0.0"}%
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                              <span>Total: <span className="font-medium text-black">{matter.total}</span></span>
                              <span className="text-emerald-600">Completed: {matter.completed}</span>
                              <span className="text-amber-600">Pending: {matter.pending}</span>
                              <span className="text-rose-600">Taken Out: {matter.takenOut}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <AdminEmptyState icon={FileText} title="Nothing to compare yet" description="Matter type stats will appear once assessments exist for this period." />
                  )}
                </AdminCardBody>
              </AdminCard>

              <AdminCard className="animate-fade-in" style={{ animationDelay: "140ms" }}>
                <AdminCardHeader icon={TrendingUp} title="Monthly Report Status Trends" description="Completed vs. pending vs. taken-out, by month" />
                <AdminCardBody>
                  {displayData.monthlyData?.length ? (
                    <>
                      <div className="h-72 w-full sm:h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={displayData.monthlyData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.08)" />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "rgba(0,0,0,0.1)" }} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip content={<StatsTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                            <Bar dataKey="completed" name="Completed" fill={BRAND_TEAL} radius={[2, 2, 0, 0]} maxBarSize={28} />
                            <Bar dataKey="pending" name="Pending" fill="#F59E0B" radius={[2, 2, 0, 0]} maxBarSize={28} />
                            <Bar dataKey="takenOut" name="Taken Out" fill="#F43F5E" radius={[2, 2, 0, 0]} maxBarSize={28} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-center gap-4 border-t border-black/10 pt-3">
                        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5" style={{ backgroundColor: BRAND_TEAL }} /><span className="text-xs text-slate-500">Completed</span></div>
                        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 bg-amber-500" /><span className="text-xs text-slate-500">Pending</span></div>
                        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 bg-rose-500" /><span className="text-xs text-slate-500">Taken Out</span></div>
                      </div>
                    </>
                  ) : (
                    <AdminEmptyState icon={TrendingUp} title="No monthly trend data" description="Trends populate automatically once this period has assessment activity." />
                  )}
                </AdminCardBody>
              </AdminCard>
            </TabsContent>

            {/* ------------------------- Attorney Reports ------------------------- */}
            <TabsContent value="attorney-reports" className="mt-4 space-y-4 md:space-y-6">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <div className="animate-fade-in">
                  <AdminStatCard label="Total Referring Attorneys" value={displayData.attorneyReportsData.length} icon={Users} />
                </div>
                <div className="animate-fade-in" style={{ animationDelay: "50ms" }}>
                  <AdminStatCard
                    label="Total Referrals"
                    value={displayData.attorneyReportsData.reduce((sum: number, a: any) => sum + a.referrals, 0)}
                    icon={TrendingUp}
                  />
                </div>
                <div className="animate-fade-in" style={{ animationDelay: "100ms" }}>
                  <AdminStatCard
                    label="Avg Response Time"
                    value={
                      displayData.attorneyReportsData.length
                        ? `${(displayData.attorneyReportsData.reduce((sum: number, a: any) => sum + (a.response_time || 0), 0) / displayData.attorneyReportsData.length).toFixed(1)}h`
                        : "0h"
                    }
                    icon={Clock}
                  />
                </div>
                <div className="animate-fade-in" style={{ animationDelay: "150ms" }}>
                  <AdminStatCard
                    label="Avg Success Rate"
                    value={
                      displayData.attorneyReportsData.length
                        ? `${(displayData.attorneyReportsData.reduce((sum: number, a: any) => sum + (a.success_rate || 0), 0) / displayData.attorneyReportsData.length).toFixed(1)}%`
                        : "0%"
                    }
                    icon={Target}
                  />
                </div>
              </div>

              <AdminCard className="animate-fade-in" style={{ animationDelay: "180ms" }}>
                <AdminCardHeader
                  icon={Users}
                  title="Referring Attorney Performance"
                  description="Referrals, completion, and turnaround per attorney"
                  actions={<AdminPill tone="teal">{displayData.attorneyReportsData.length} attorneys</AdminPill>}
                />
                <AdminCardBody className="p-0">
                  {displayData.attorneyReportsData.length ? (
                    <>
                      <div className="hidden overflow-x-auto md:block">
                        <Table className="text-xs [&_td]:px-4 [&_td]:py-2.5 [&_th]:h-9 [&_th]:px-4 [&_th]:text-[11px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Referring Attorney</TableHead>
                              <TableHead className="text-center">Referrals</TableHead>
                              <TableHead className="text-center">Completed</TableHead>
                              <TableHead className="text-center">Pending</TableHead>
                              <TableHead className="text-center">Response Time</TableHead>
                              <TableHead className="text-right">Success Rate</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {displayData.attorneyReportsData.map((attorney: any, index: number) => (
                              <TableRow key={index} className="hover:bg-black/[0.02]">
                                <TableCell className="font-medium text-black">{attorney.name}</TableCell>
                                <TableCell className="text-center">{attorney.referrals}</TableCell>
                                <TableCell className="text-center text-emerald-600 font-medium">{attorney.completed}</TableCell>
                                <TableCell className="text-center text-amber-600 font-medium">{attorney.pending}</TableCell>
                                <TableCell className="text-center">
                                  <span
                                    className={`font-medium ${
                                      attorney.response_time <= 2 ? "text-emerald-600" : attorney.response_time <= 3 ? "text-amber-600" : "text-rose-600"
                                    }`}
                                  >
                                    {typeof attorney.response_time === "number" ? `${attorney.response_time}h` : "—"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <span
                                    className={`font-semibold ${
                                      attorney.success_rate >= 92 ? "text-emerald-600" : attorney.success_rate >= 88 ? "text-amber-600" : "text-rose-600"
                                    }`}
                                  >
                                    {Number(attorney.success_rate || 0).toFixed(1)}%
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="divide-y divide-black/10 md:hidden">
                        {displayData.attorneyReportsData.map((attorney: any, index: number) => (
                          <div key={index} className="p-4">
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-black">{attorney.name}</p>
                              <span
                                className={`shrink-0 text-xs font-semibold ${
                                  attorney.success_rate >= 92 ? "text-emerald-600" : attorney.success_rate >= 88 ? "text-amber-600" : "text-rose-600"
                                }`}
                              >
                                {Number(attorney.success_rate || 0).toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                              <span>Referrals: <span className="font-medium text-black">{attorney.referrals}</span></span>
                              <span className="text-emerald-600">Completed: {attorney.completed}</span>
                              <span className="text-amber-600">Pending: {attorney.pending}</span>
                              {typeof attorney.response_time === "number" && <span>Response: {attorney.response_time}h</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <AdminEmptyState icon={Users} title="No attorney referrals yet" description="This table populates once referred appointments exist for the selected period." />
                  )}
                </AdminCardBody>
              </AdminCard>
            </TabsContent>

            {/* -------------------------- Expert Performance ------------------------ */}
            <TabsContent value="performance" className="mt-4 space-y-4 md:space-y-6">
              <AdminCard className="animate-fade-in">
                <AdminCardHeader icon={Activity} title="Expert Performance Overview" description="Assessments completed per medical expert" />
                <AdminCardBody>
                  {displayData.expertPerformanceData?.length ? (
                    <div className="h-72 w-full sm:h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={displayData.expertPerformanceData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.08)" />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "rgba(0,0,0,0.1)" }} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip content={<StatsTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                          <Bar dataKey="assessments" name="Assessments Completed" fill={BRAND_TEAL} radius={[2, 2, 0, 0]} maxBarSize={48} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <AdminEmptyState icon={Activity} title="No expert activity yet" description="Performance data appears once experts complete reports for this period." />
                  )}
                </AdminCardBody>
              </AdminCard>

              {displayData.expertPerformanceData?.length > 0 && (
                <AdminCard className="animate-fade-in" style={{ animationDelay: "60ms" }}>
                  <AdminCardHeader icon={TrendingUp} title="Top Performing Experts" description="Ranked by assessments completed this period" />
                  <AdminCardBody className="space-y-3">
                    {displayData.expertPerformanceData.slice(0, 10).map((expert: any, i: number) => (
                      <div key={expert.name} className="flex items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/5 text-[11px] font-bold text-black">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-black">{expert.name}</p>
                          <div className="mt-1 h-1.5 w-full bg-black/5">
                            <div
                              className="h-1.5 transition-all duration-700"
                              style={{ width: `${(expert.assessments / maxExpertAssessments) * 100}%`, backgroundColor: BRAND_TEAL }}
                            />
                          </div>
                        </div>
                        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-black">
                          {expert.assessments}
                          <ArrowUpRight className="h-3 w-3 text-slate-400" />
                        </span>
                      </div>
                    ))}
                  </AdminCardBody>
                </AdminCard>
              )}
            </TabsContent>

            {/* ---------------------------- Trends Analysis -------------------------- */}
            <TabsContent value="trends" className="mt-4 space-y-4 md:space-y-6">
              <AdminCard className="animate-fade-in">
                <AdminCardHeader icon={LineChartIcon} title="Assessment Completion Trends" description="Completed, pending, and taken-out reports over time" />
                <AdminCardBody>
                  {displayData.monthlyData?.length ? (
                    <>
                      <div className="h-72 w-full sm:h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={displayData.monthlyData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.08)" />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "rgba(0,0,0,0.1)" }} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip content={<StatsTooltip />} cursor={{ stroke: "rgba(0,0,0,0.1)" }} />
                            <Line type="monotone" dataKey="completed" name="Completed" stroke={BRAND_TEAL} strokeWidth={2} dot={{ r: 3, fill: BRAND_TEAL }} activeDot={{ r: 4 }} />
                            <Line type="monotone" dataKey="pending" name="Pending" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3, fill: "#F59E0B" }} activeDot={{ r: 4 }} />
                            <Line type="monotone" dataKey="takenOut" name="Taken Out" stroke="#F43F5E" strokeWidth={2} dot={{ r: 3, fill: "#F43F5E" }} activeDot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-center gap-4 border-t border-black/10 pt-3">
                        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5" style={{ backgroundColor: BRAND_TEAL }} /><span className="text-xs text-slate-500">Completed</span></div>
                        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 bg-amber-500" /><span className="text-xs text-slate-500">Pending</span></div>
                        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 bg-rose-500" /><span className="text-xs text-slate-500">Taken Out</span></div>
                      </div>
                    </>
                  ) : (
                    <AdminEmptyState icon={LineChartIcon} title="No trend data for this period" description="Select a period with assessment activity to see trends." />
                  )}
                </AdminCardBody>
              </AdminCard>
            </TabsContent>
          </Tabs>
        </AdminPage>
      </main>

      {!embedded && <CompanyFooter />}
    </div>
  );
};

export default AssessmentReportsStatistics;
