import React, { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Download, Search, Calendar, Clock, TrendingUp, Pencil, Trash2, Mail, BarChart3, RefreshCw, Check, Paperclip, Send, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { sastNowParts } from "@/utils/dateTime";
import { supabase } from "@/integrations/supabase/client";
import { upsertExpertReport } from "@/utils/expertReports";
import { useToast } from "@/hooks/use-toast";
import { useSecureAssessments } from "@/hooks/useSecureAssessments";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import CompanyFooter from "@/components/CompanyFooter";
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from "@/utils/pdfBranding";
import { BulkAppointmentUpload } from "@/components/BulkAppointmentUpload";
import { BulkAppointmentEmailDialog } from "@/components/BulkAppointmentEmailDialog";
import { SaveStatusIndicator } from "@/components/SaveStatusIndicator";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DateRangePicker, isWithinDateRange } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ScheduledAppointment = {
  id: string;
  auto_id: string;
  claimant_name: string;
  expert_name: string;
  expert_type: string;
  appointment_date: string;
  appointment_time: string;
  referring_attorney: string;
  referring_attorney_id: string;
  deposit_amount: number;
  status: string;
  report_status: string;
  comments: string;
  deposit_date?: string;
  report_date?: string;
  assessment_fee: number;
  balance: number;
  payment_date?: string;
  payment_updated_at?: string;
  assessment_code?: string;
  sales_consultant_name?: string;
};

// Assessment Period Statistics Component
type AssessmentPeriodStatsProps = {
  appointments: ScheduledAppointment[];
  selectedYear: string;
  selectedMonth: string;
  selectedQuarter: string;
};

const AssessmentPeriodStats = ({ 
  appointments, 
  selectedYear, 
  selectedMonth, 
  selectedQuarter 
}: AssessmentPeriodStatsProps) => {
  const stats = useMemo(() => {
    const targetYear = parseInt(selectedYear);
    const targetMonth = parseInt(selectedMonth) - 1; // 0-indexed
    const targetQuarter = parseInt(selectedQuarter) - 1; // 0-indexed for calculation
    
    let monthlyCount = 0;
    let quarterlyCount = 0;
    let yearlyCount = 0;
    
    appointments.forEach(apt => {
      // Parse dd/MM/yyyy format
      const parts = apt.appointment_date.split('/');
      if (parts.length !== 3) return;
      
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // 0-indexed
      const year = parseInt(parts[2]);
      
      if (isNaN(day) || isNaN(month) || isNaN(year)) return;
      
      const aptQuarter = Math.floor(month / 3);
      
      // Count for selected year
      if (year === targetYear) {
        yearlyCount++;
        
        // Count for selected quarter
        if (aptQuarter === targetQuarter) {
          quarterlyCount++;
        }
        
        // Count for selected month
        if (month === targetMonth) {
          monthlyCount++;
        }
      }
    });
    
    return {
      monthlyCount,
      quarterlyCount,
      yearlyCount
    };
  }, [appointments, selectedYear, selectedMonth, selectedQuarter]);
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const displayMonth = parseInt(selectedMonth) - 1;
  const displayQuarter = parseInt(selectedQuarter);
  const displayYear = parseInt(selectedYear);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Monthly</p>
              <p className="text-xs text-muted-foreground">{monthNames[displayMonth]} {displayYear}</p>
            </div>
            <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-3xl font-bold mt-2 text-blue-700 dark:text-blue-300">{stats.monthlyCount}</p>
          <p className="text-xs text-muted-foreground mt-1">assessments</p>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Quarterly</p>
              <p className="text-xs text-muted-foreground">Q{displayQuarter} {displayYear}</p>
            </div>
            <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-3xl font-bold mt-2 text-purple-700 dark:text-purple-300">{stats.quarterlyCount}</p>
          <p className="text-xs text-muted-foreground mt-1">assessments</p>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Yearly</p>
              <p className="text-xs text-muted-foreground">{displayYear}</p>
            </div>
            <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-3xl font-bold mt-2 text-emerald-700 dark:text-emerald-300">{stats.yearlyCount}</p>
          <p className="text-xs text-muted-foreground mt-1">assessments</p>
        </CardContent>
      </Card>
    </div>
  );
};

const ScheduledAssessment = () => {
  const { toast } = useToast();
  const { triggerSync } = useAppointmentSync();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [comments, setComments] = useState<{ [key: string]: string }>({});
  const [paymentInputs, setPaymentInputs] = useState<{ [key: string]: string }>({});
  const [reportPeriod, setReportPeriod] = useState("monthly");
  const [selectedYear, setSelectedYear] = useState(() => { const { year } = sastNowParts(); return year.toString(); });
  const [selectedMonth, setSelectedMonth] = useState(() => { const { month } = sastNowParts(); return month.toString(); });
  const [selectedQuarter, setSelectedQuarter] = useState(() => { const { month } = sastNowParts(); return Math.floor((month - 1) / 3 + 1).toString(); });
  const { assessments, loading, error, saveStatus, updateAssessmentStatus, updateReportStatus, updatePaymentInfo, updateReportNotes, updateSalesConsultant, refetch } = useSecureAssessments();
  const [salesConsultants, setSalesConsultants] = useState<{ id: string; name: string }[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  const [bulkEmailDialogOpen, setBulkEmailDialogOpen] = useState(false);

  // Attach Report & Send to Attorney state
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<ScheduledAppointment | null>(null);
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [attachUploading, setAttachUploading] = useState(false);
  const [existingAttachments, setExistingAttachments] = useState<{ id: string; file_name: string; file_path?: string; upload_date: string; upload_time: string }[]>([]);
  const [selectedExistingIds, setSelectedExistingIds] = useState<Set<string>>(new Set());
  const [attachmentSort, setAttachmentSort] = useState<'newest' | 'oldest' | 'name_asc' | 'name_desc'>('newest');
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [attorneyEmail, setAttorneyEmail] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [reportAttachmentList, setReportAttachmentList] = useState<{ name: string; path: string; displayName: string; created_at?: string }[]>([]);
  const [selectedAttachmentPaths, setSelectedAttachmentPaths] = useState<Set<string>>(new Set());

  // Financial edit dialog state
  const [financeDialogOpen, setFinanceDialogOpen] = useState(false);
  const [financeSaving, setFinanceSaving] = useState(false);
  const [financeForm, setFinanceForm] = useState({
    assessmentFee: "",
    discount: "",
    discountType: "amount" as "amount" | "percentage",
    deposit: "",
  });

  // Fetch sales consultants for the dropdown
  useEffect(() => {
    const fetchConsultants = async () => {
      const { data } = await supabase
        .from('sales_consultants')
        .select('id, name, user_id')
        .order('name');
      if (data) {
        // Enrich with profile full names where possible
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name');
        const profileMap = new Map((profiles || []).map(p => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim()]));
        setSalesConsultants(data.map(sc => ({
          id: sc.id,
          name: (sc.user_id && profileMap.get(sc.user_id)) || sc.name
        })));
      }
    };
    fetchConsultants();
  }, []);

  // Auto-update status from "Scheduled" to "Assessed" when appointment date has passed
  useEffect(() => {
    const autoUpdateExpiredScheduled = async () => {
      if (!loading && assessments.length > 0) {
        const { year, month, day } = sastNowParts();
        const nowSAST = new Date(year, month - 1, day, 0, 0, 0, 0); // midnight SAST today
        
        for (const assessment of assessments) {
          const currentStatus = assessment.case_status?.toLowerCase();
          if (currentStatus !== 'scheduled') continue;
          
          const appointmentDate = new Date(assessment.appointment_date);
          appointmentDate.setHours(0, 0, 0, 0);
          
          if (appointmentDate < nowSAST) {
            console.log(`Auto-updating expired appointment ${assessment.appointment_id} from Scheduled to Assessed`);
            await updateAssessmentStatus(assessment.appointment_id, 'Assessed');
          }
        }
      }
    };
    
    autoUpdateExpiredScheduled();
  }, [loading, assessments.length]);

  // Sync appointments on load and when assessments change
  useEffect(() => {
    const syncOnLoad = async () => {
      if (!loading && assessments.length > 0) {
        console.log('Starting auto-sync for all referring attorneys...');
        
        // Get unique referring attorneys from assessments
        const lawFirmIds = [...new Set(assessments.map(a => a.referring_attorney_id).filter(Boolean))];
        console.log(`Found ${lawFirmIds.length} unique referring attorney(s) to sync`);
        
        for (const lawFirmId of lawFirmIds) {
          try {
            // Find assessments for this referring attorney with outstanding balance
            const lawFirmAssessments = assessments.filter(a => {
              const balance = (a.service_fee || 0) - (a.deposit_amount || 0);
              return a.referring_attorney_id === lawFirmId && balance > 0;
            });
            
            if (lawFirmAssessments.length > 0) {
              console.log(`Syncing referring attorney ${lawFirmId}: ${lawFirmAssessments.length} assessment(s) with outstanding balance`);
              
              // Use first assessment's appointment_id to trigger sync
              const assessment = lawFirmAssessments[0];
              if (assessment?.appointment_id) {
                const balance = (assessment.service_fee || 0) - (assessment.deposit_amount || 0);
                await syncToAODManagement(assessment.appointment_id, balance);
              }
            }
          } catch (error) {
            console.error(`Failed to sync referring attorney ${lawFirmId}:`, error);
          }
        }
        
        console.log('Auto-sync completed');
      }
    };
    
    syncOnLoad();
  }, [loading, assessments.length]);

  // Convert secure assessments to the format expected by the component
  const formatAssessments = (secureAssessments: any[]): ScheduledAppointment[] => {
    return secureAssessments.map((assessment) => {
      const assessmentFee = assessment.service_fee || 0;
      const depositAmount = assessment.deposit_amount || 0;
      // Clamp balance at zero – overpayments should not show negative
      const balance = Math.max(0, assessmentFee - depositAmount);
      
      return {
        id: assessment.appointment_id,
        auto_id: assessment.claimant_auto_id || 'N/A',
        claimant_name: assessment.claimant_name || 'N/A',
        expert_name: assessment.expert_name || 'N/A',
        expert_type: assessment.expert_type || 'N/A',
        appointment_date: assessment.appointment_date ? format(new Date(assessment.appointment_date), 'dd/MM/yyyy') : 'N/A',
        appointment_time: assessment.appointment_date ? format(new Date(assessment.appointment_date), 'HH:mm') : 'N/A',
        referring_attorney: assessment.referring_attorney || 'N/A',
        referring_attorney_id: assessment.referring_attorney_id || '',
        deposit_amount: depositAmount,
        assessment_fee: assessmentFee,
        balance: balance,
        status: assessment.case_status ? assessment.case_status.charAt(0).toUpperCase() + assessment.case_status.slice(1) : 'Scheduled',
        report_status: formatReportStatus(assessment.report_status),
        comments: assessment.report_notes || '',
        report_date: assessment.report_submitted_date ? format(new Date(assessment.report_submitted_date), 'dd/MM/yyyy HH:mm') : undefined,
        payment_date: assessment.payment_date ? format(new Date(assessment.payment_date), 'dd/MM/yyyy HH:mm') : undefined,
        assessment_code: assessment.assessment_code || undefined,
        sales_consultant_name: assessment.sales_consultant_name || undefined
      };
    });
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
    // Parse appointment date for month/year comparison (stored as dd/MM/yyyy)
    const appointmentDate = new Date(appointment.appointment_date.split('/').reverse().join('-'));
    const appointmentMonth = appointmentDate.getMonth() + 1;
    const appointmentYear = appointmentDate.getFullYear();

    // If a date range is set, it overrides the period selectors entirely.
    let dateMatch = false;
    if (dateRange?.from || dateRange?.to) {
      dateMatch = isWithinDateRange(appointmentDate, dateRange);
    } else if (reportPeriod === 'all') {
      dateMatch = true;
    } else if (reportPeriod === 'monthly') {
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
      appointment.auto_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.referring_attorney.toLowerCase().includes(searchTerm.toLowerCase());

    return dateMatch && searchMatch;
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "initial stage": return "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300";
      case "scheduled": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "assessed": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "re-assessed": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
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
      case "report fully paid & submitted": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300";
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
      case "court attendance": return "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300";
      case "court preparation": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
      case "affidavits": return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300";
      case "joint minutes": return "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300";
      case "addendum": return "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-300";
      case "re-assessment": return "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const commentDebounceRef = React.useRef<{ [key: string]: NodeJS.Timeout }>({});

  const updateComments = (appointmentId: string, newComments: string) => {
    setComments(prev => ({
      ...prev,
      [appointmentId]: newComments
    }));

    // Debounce save to database
    if (commentDebounceRef.current[appointmentId]) {
      clearTimeout(commentDebounceRef.current[appointmentId]);
    }
    commentDebounceRef.current[appointmentId] = setTimeout(() => {
      updateReportNotes(appointmentId, newComments);
    }, 1500);
  };

  const handlePaymentSave = async (appointmentId: string) => {
    const inputValue = paymentInputs[appointmentId];
    if (inputValue === undefined || inputValue === '') return;
    
    const amount = parseFloat(inputValue);
    if (isNaN(amount) || amount < 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      });
      return;
    }

    await updatePaymentInfo(appointmentId, amount);
    // Clear input after save
    setPaymentInputs(prev => {
      const next = { ...prev };
      delete next[appointmentId];
      return next;
    });
  };

  // Sync appointment with outstanding balance to AOD/Short-term agreement
  // Groups by attorney and routes based on number of debts
  const syncToAODManagement = async (appointmentId: string, balance: number) => {
    console.log(`🔄 syncToAODManagement called for appointment ${appointmentId}, balance: R${balance}`);
    
    if (balance <= 0) {
      console.log('❌ Balance is zero or negative, skipping sync');
      return; // No debt, no need to sync
    }

    try {
      // Get current appointment details
      console.log('📋 Fetching appointment details...');
      const { data: appointmentData, error: appointmentError } = await supabase
        .from('appointments')
        .select('referring_attorney_id, referring_attorney, payment_terms, agreement_duration_months, service_fee, deposit_amount')
        .eq('id', appointmentId)
        .single();

      if (appointmentError) {
        console.error('❌ Error fetching appointment:', appointmentError);
        return;
      }

      if (!appointmentData) {
        console.log('❌ No appointment data found');
        return;
      }

      console.log('✅ Appointment data:', appointmentData);

      // Get ALL appointments for this referring attorney with outstanding balance
      // Include both scheduled and assessed appointments
      console.log(`📊 Fetching all appointments for referring attorney ${appointmentData.referring_attorney_id}...`);
      const { data: allLawFirmAppointments, error: fetchError } = await supabase
        .from('appointments')
        .select('id, referring_attorney_id, service_fee, deposit_amount, payment_terms, agreement_duration_months, appointment_date, claimant_id, referring_attorney, case_status')
        .eq('referring_attorney_id', appointmentData.referring_attorney_id)
        .in('case_status', ['scheduled', 'assessed'])
        .not('service_fee', 'is', null);

      if (fetchError) {
        console.error('❌ Error fetching appointments:', fetchError);
        toast({
          title: "Sync Error",
          description: `Failed to fetch appointments: ${fetchError.message}`,
          variant: "destructive",
        });
        return;
      }

      if (!allLawFirmAppointments) {
        console.log('❌ No appointments returned');
        return;
      }

      console.log(`✅ Found ${allLawFirmAppointments.length} total appointments`);

      // Filter appointments with outstanding balance
      const appointmentsWithDebt = allLawFirmAppointments.filter(apt => {
        const fee = apt.service_fee || 0;
        const deposit = apt.deposit_amount || 0;
        const hasDebt = (fee - deposit) > 0;
        if (hasDebt) {
          console.log(`  💰 Appointment ${apt.id.substring(0, 8)}: R${fee} - R${deposit} = R${fee - deposit}`);
        }
        return hasDebt;
      });

      if (appointmentsWithDebt.length === 0) {
        console.log(`❌ No appointments with debt found for referring attorney ${appointmentData.referring_attorney_id}`);
        return;
      }

      console.log(`✅ Referring attorney ${appointmentData.referring_attorney_id} has ${appointmentsWithDebt.length} appointment(s) with debt`);

      // Get referring attorney name (use first appointment's attorney)
      const referringAttorneyName = appointmentsWithDebt[0]?.referring_attorney || 'Unknown';

      // Calculate totals
      const totalContractValue = appointmentsWithDebt.reduce((sum, apt) => sum + (apt.service_fee || 0), 0);
      const totalDeposit = appointmentsWithDebt.reduce((sum, apt) => sum + (apt.deposit_amount || 0), 0);
      const totalOutstanding = totalContractValue - totalDeposit;
      const totalReports = appointmentsWithDebt.length;

      const { data: { user } } = await supabase.auth.getUser();

      // Determine routing:
      // - Multiple assessments (>1) -> Always AOD Documents (aggregate all debts)
      // - Single assessment with duration >= 12 months OR payment_terms contains "AOD" -> AOD Documents
      // - Single assessment with duration < 12 months -> Short Term Agreements
      
      const hasAODTerms = appointmentsWithDebt.some(apt => 
        apt.payment_terms?.toUpperCase().includes('AOD')
      );
      const hasLongDuration = appointmentsWithDebt.some(apt => 
        (apt.agreement_duration_months || 0) >= 12
      );
      
      // Route to AOD if multiple assessments OR single with AOD terms/long duration
      if (appointmentsWithDebt.length > 1 || hasAODTerms || hasLongDuration) {
        // MULTIPLE ASSESSMENTS OR AOD >= 12 MONTHS: Sync to AOD Documents with aggregated data
        console.log(`Routing to AOD Documents: ${totalReports} assessments, R${totalOutstanding.toFixed(2)} outstanding`);

        // Check for existing AOD document for this referring attorney and attorney
        const { data: existingAOD } = await supabase
          .from('aod_documents')
          .select('id, total_contract_value, deposit_amount, total_reports_agreed, reports_released')
          .eq('referring_attorney_id', appointmentData.referring_attorney_id)
          .maybeSingle();

        // Get claimant names for description
        const claimantNames = await Promise.all(
          appointmentsWithDebt.map(async (apt) => {
            if (!apt.claimant_id) return 'Unknown';
            const { data } = await supabase
              .from('claimants')
              .select('first_name, last_name')
              .eq('id', apt.claimant_id)
              .single();
            return data ? `${data.first_name} ${data.last_name}` : 'Unknown';
          })
        );

        const claimantsList = claimantNames.join(', ');

        // Get appointment IDs for fetching report statuses
        const appointmentIds = appointmentsWithDebt.map(apt => apt.id);

        // Fetch completed reports count from expert_reports table
        const { data: expertReportsData } = await supabase
          .from('expert_reports')
          .select('id, report_status, appointment_id')
          .in('appointment_id', appointmentIds);

        // Count completed reports (statuses that indicate report is done)
        const completedReportStatuses = [
          'report_submitted_on_aod',
          'report_fully_paid_submitted',
          'report submitted on aod',
          'report fully paid & submitted',
          'completed',
          'received'
        ];
        
        const reportsReleased = expertReportsData?.filter(report => 
          completedReportStatuses.some(status => 
            report.report_status?.toLowerCase().includes(status.toLowerCase().replace(/_/g, ' ')) ||
            report.report_status?.toLowerCase().replace(/_/g, ' ') === status.toLowerCase()
          )
        ).length || 0;

        console.log(`📊 Reports: ${totalReports} total assessments, ${reportsReleased} reports released`);

        if (!existingAOD) {
          // Create new aggregated AOD document
          console.log('📝 Creating new AOD document...');
          const startDate = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + 12); // Default 12 months for AOD

          const { data: newAOD, error: insertError } = await supabase
            .from('aod_documents')
            .insert({
              referring_attorney_id: appointmentData.referring_attorney_id,
              uploaded_by: user?.id,
              contract_description: `AOD - ${referringAttorneyName} - ${totalReports} assessments: ${claimantsList}`,
              contract_start_date: startDate.toISOString().split('T')[0],
              contract_end_date: endDate.toISOString().split('T')[0],
              total_contract_value: totalContractValue,
              deposit_amount: totalDeposit,
              payment_status: totalOutstanding > 0 ? 'pending' : 'paid',
              total_reports_agreed: totalReports,
              reports_released: reportsReleased,
              payments_made: appointmentsWithDebt.filter(apt => (apt.deposit_amount || 0) > 0).length,
              file_name: `AOD - ${referringAttorneyName}`,
              document_url: '',
              notes: `Attorney: ${referringAttorneyName}. Claimants: ${claimantsList}. Total debt: R${totalOutstanding.toFixed(2)}. Synced: ${new Date().toISOString()}`
            })
            .select();

          if (insertError) {
            console.error('❌ Error creating AOD document:', insertError);
            toast({
              title: "Sync Error",
              description: `Failed to create AOD: ${insertError.message}`,
              variant: "destructive",
            });
            return;
          }

          console.log('✅ AOD document created:', newAOD);
          toast({
            title: "Synced to AOD Documents",
            description: `${totalReports} assessments, ${reportsReleased} reports released. Total outstanding: R${totalOutstanding.toFixed(2)}`,
          });
        } else {
          // Update existing AOD with current aggregated values
          await supabase
            .from('aod_documents')
            .update({
              total_contract_value: totalContractValue,
              deposit_amount: totalDeposit,
              payment_status: totalOutstanding > 0 ? 'pending' : 'paid',
              total_reports_agreed: totalReports,
              reports_released: reportsReleased,
              payments_made: appointmentsWithDebt.filter(apt => (apt.deposit_amount || 0) > 0).length,
              contract_description: `AOD - ${referringAttorneyName} - ${totalReports} assessments: ${claimantsList}`,
              notes: `Attorney: ${referringAttorneyName}. Claimants: ${claimantsList}. Total debt: R${totalOutstanding.toFixed(2)}. Synced: ${new Date().toISOString()}`
            })
            .eq('id', existingAOD.id);

          toast({
            title: "Updated AOD Document",
            description: `AOD updated: ${totalReports} assessments, ${reportsReleased} reports released, R${totalOutstanding.toFixed(2)} outstanding`,
          });
        }
      } else {
        // SINGLE ASSESSMENT WITH DURATION < 12 MONTHS: Sync to Short Term Agreements
        const apt = appointmentsWithDebt[0];
        const fee = apt.service_fee || 0;
        const deposit = apt.deposit_amount || 0;
        const outstanding = fee - deposit;
        const duration = apt.agreement_duration_months || 6;

        console.log(`Routing to Short Term Agreements: Single assessment (${duration} months), R${outstanding.toFixed(2)} outstanding`);

        // Get claimant name
        let claimantName = 'Unknown';
        if (apt.claimant_id) {
          const { data: claimantData } = await supabase
            .from('claimants')
            .select('first_name, last_name')
            .eq('id', apt.claimant_id)
            .single();
          if (claimantData) {
            claimantName = `${claimantData.first_name} ${claimantData.last_name}`;
          }
        }

        // Check for existing short-term agreement for this appointment
        const { data: existingAgreement } = await supabase
          .from('short_term_agreements')
          .select('id, total_contract_value, deposit_amount')
          .eq('referring_attorney_id', appointmentData.referring_attorney_id)
          .contains('notes', apt.id.substring(0, 8))
          .maybeSingle();

        if (!existingAgreement) {
          // Create new short-term agreement
          const startDate = new Date(apt.appointment_date || new Date());
          const endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + duration);

          await supabase
            .from('short_term_agreements')
            .insert({
              referring_attorney_id: appointmentData.referring_attorney_id,
              created_by: user?.id,
              agreement_method: 'email',
              contract_description: `Short Term - ${referringAttorneyName} - ${claimantName}`,
              contract_start_date: startDate.toISOString().split('T')[0],
              contract_end_date: endDate.toISOString().split('T')[0],
              total_contract_value: fee,
              deposit_amount: deposit,
              payment_status: outstanding > 0 ? 'pending' : 'paid',
              total_reports_agreed: 1,
              reports_completed: 0,
              payments_made: deposit > 0 ? 1 : 0,
              status: 'active',
              notes: `Attorney: ${referringAttorneyName}. Claimant: ${claimantName}. Duration: ${duration} months. Appointment ID: ${apt.id.substring(0, 8)}. Outstanding: R${outstanding.toFixed(2)}. Synced: ${new Date().toISOString()}`
            });

          toast({
            title: "Synced to Short Term Agreements",
            description: `Single assessment (${duration} months). Outstanding: R${outstanding.toFixed(2)}`,
          });
        } else {
          // Update existing agreement
          await supabase
            .from('short_term_agreements')
            .update({
              total_contract_value: fee,
              deposit_amount: deposit,
              payment_status: outstanding > 0 ? 'pending' : 'paid',
              contract_description: `Short Term - ${referringAttorneyName} - ${claimantName}`,
              notes: `Attorney: ${referringAttorneyName}. Claimant: ${claimantName}. Duration: ${duration} months. Appointment ID: ${apt.id.substring(0, 8)}. Outstanding: R${outstanding.toFixed(2)}. Synced: ${new Date().toISOString()}`
            })
            .eq('id', existingAgreement.id);

          toast({
            title: "Updated Short Term Agreement",
            description: `Agreement updated: R${outstanding.toFixed(2)} outstanding`,
          });
        }
      }
    } catch (error) {
      console.error('Error syncing to AOD management:', error);
      toast({
        title: "Sync Error",
        description: "Failed to sync to AOD management",
        variant: "destructive"
      });
    }
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

        // Sync to AOD management if there's an outstanding balance
        if (appointment.balance > 0) {
          await syncToAODManagement(appointmentId, appointment.balance);
        }
      }
    }
    
    // Get appointment details for notification
    const appointment = appointments.find(app => app.id === appointmentId);
    const oldStatus = appointment?.status || 'Unknown';
    
    // Update status first
    const success = await updateAssessmentStatus(appointmentId, newStatus);
    
    if (success) {
      triggerSync(false, true); // Force-broadcast: user-initiated save propagates to all dashboards
    }
    
    // Queue assessment change notification for manual review/approval
    if (success && appointment) {
      try {
        // Get attorney email from referring_attorneys table
        const { data: attorneyData } = await supabase
          .from('referring_attorneys')
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
        console.error('Failed to queue assessment change notification:', error);
      }
    }
  };

  const updateReportStatusLocal = async (appointmentId: string, newReportStatus: string) => {
    const success = await updateReportStatus(appointmentId, newReportStatus);
    if (success) {
      triggerSync(false, true); // Force-broadcast: user-initiated save propagates to all dashboards
    }
  };

  const handleDeleteClick = (appointmentId: string) => {
    setAppointmentToDelete(appointmentId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!appointmentToDelete) return;

    try {
      // First delete related expert reports
      const { error: reportError } = await supabase
        .from('expert_reports')
        .delete()
        .eq('appointment_id', appointmentToDelete);

      if (reportError) {
        console.error('Error deleting expert reports:', reportError);
      }

      // Permanently delete the appointment
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentToDelete);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Assessment permanently deleted.",
      });

      refetch();
      triggerSync();
      setDeleteDialogOpen(false);
      setAppointmentToDelete(null);
    } catch (error) {
      console.error('Error deleting assessment:', error);
      toast({
        title: "Error",
        description: "Failed to delete assessment.",
        variant: "destructive",
      });
    }
  };

  const handleEditClick = (appointmentId: string) => {
    window.location.href = `/new-appointment?appointmentId=${appointmentId}`;
  };

  // Open financial edit dialog (inline edit fee/discount/deposit)
  const handleFinanceEdit = async (appointment: ScheduledAppointment) => {
    setSelectedAppointment(appointment);
    // Load fresh values from DB so we get raw assessment fee + discount type
    const { data: apt } = await supabase
      .from('appointments')
      .select('service_fee, deposit_amount, discount_amount, discount_rate, discount_type')
      .eq('id', appointment.id)
      .maybeSingle();

    const discountType = ((apt as any)?.discount_type || 'amount') as 'amount' | 'percentage';
    const rawFee = (Number(apt?.service_fee) || 0) + (Number((apt as any)?.discount_amount) || 0);
    const discountValue = discountType === 'percentage'
      ? String(Number((apt as any)?.discount_rate) || 0)
      : String(Number((apt as any)?.discount_amount) || 0);

    setFinanceForm({
      assessmentFee: String(rawFee),
      discount: discountValue,
      discountType,
      deposit: String(Number(apt?.deposit_amount) || 0),
    });
    setFinanceDialogOpen(true);
  };

  // Live preview of computed values
  const financePreview = useMemo(() => {
    const rawFee = parseFloat(financeForm.assessmentFee) || 0;
    const rawDiscount = parseFloat(financeForm.discount) || 0;
    const discount = financeForm.discountType === 'percentage'
      ? (rawFee * rawDiscount) / 100
      : rawDiscount;
    const finalFee = Math.max(0, rawFee - discount);
    const deposit = parseFloat(financeForm.deposit) || 0;
    const balance = Math.max(0, finalFee - deposit);
    return { discount, finalFee, deposit, balance };
  }, [financeForm]);

  // Save financial edits + sync to AOD + Short-term agreement
  const handleFinanceSave = async () => {
    if (!selectedAppointment) return;
    setFinanceSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const rawFee = parseFloat(financeForm.assessmentFee) || 0;
      const rawDiscount = parseFloat(financeForm.discount) || 0;
      const discount = financeForm.discountType === 'percentage'
        ? (rawFee * rawDiscount) / 100
        : rawDiscount;
      const serviceFee = Math.max(0, rawFee - discount);
      const depositAmount = parseFloat(financeForm.deposit) || 0;

      // Get previous values for delta-based sync
      const { data: prevAppt } = await supabase
        .from('appointments')
        .select('service_fee, deposit_amount, discount_amount, referring_attorney_id, appointment_date')
        .eq('id', selectedAppointment.id)
        .maybeSingle();

      const prevFee = Number(prevAppt?.service_fee) || 0;
      const prevDep = Number(prevAppt?.deposit_amount) || 0;
      const prevDisc = Number((prevAppt as any)?.discount_amount) || 0;

      // Determine new payment_status from totals
      let paymentStatus: 'pending' | 'deposit' | 'full_payment' = 'pending';
      if (depositAmount > 0) {
        paymentStatus = depositAmount >= serviceFee ? 'full_payment' : 'deposit';
      }

      // 1. Update the appointment
      const { error: updErr } = await supabase
        .from('appointments')
        .update({
          service_fee: serviceFee,
          deposit_amount: depositAmount,
          discount_amount: discount,
          discount_rate: financeForm.discountType === 'percentage' ? rawDiscount : 0,
          discount_type: financeForm.discountType,
          payment_status: paymentStatus,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', selectedAppointment.id);
      if (updErr) throw updErr;

      // 2. Recalculate ALL linked AOD docs and Short-term agreements that include this appointment
      let recalcAodIds: string[] = [];
      let recalcStIds: string[] = [];
      try {
        const { recalculateAODFromAppointments, recalculateShortTermFromAppointments } = await import('@/hooks/usePaymentSync');

        const attorneyId = (prevAppt as any)?.referring_attorney_id;

        const [{ data: linkedAods }, { data: linkedSTs }] = await Promise.all([
          supabase
            .from('aod_documents')
            .select('id, referring_attorney_id, linked_appointment_ids, notes')
            .contains('linked_appointment_ids', [selectedAppointment.id]),
          supabase
            .from('short_term_agreements')
            .select('id, referring_attorney_id, linked_appointment_ids, notes')
            .contains('linked_appointment_ids', [selectedAppointment.id]),
        ]);

        let aodList: any[] = linkedAods || [];
        let stList: any[] = linkedSTs || [];

        // Fallback: if nothing was explicitly linked, recalc every agreement for this attorney
        // so legacy AODs/Short-term docs without linked_appointment_ids stay in sync.
        if (attorneyId && aodList.length === 0) {
          const { data: attorneyAods } = await supabase
            .from('aod_documents')
            .select('id, referring_attorney_id')
            .eq('referring_attorney_id', attorneyId);
          aodList = attorneyAods || [];

          // Backfill linked_appointment_ids on the most recent AOD so future edits resolve directly
          if (aodList.length > 0) {
            const target = aodList[0];
            
            const { data: current } = await supabase
              .from('aod_documents')
              .select('linked_appointment_ids')
              .eq('id', target.id)
              .maybeSingle();
            const existing: string[] = ((current as any)?.linked_appointment_ids) || [];
            if (!existing.includes(selectedAppointment.id)) {
              await supabase
                .from('aod_documents')
                .update({ linked_appointment_ids: [...existing, selectedAppointment.id] } as any)
                .eq('id', target.id);
            }
          }
        }
        if (attorneyId && stList.length === 0) {
          const { data: attorneySTs } = await supabase
            .from('short_term_agreements')
            .select('id, referring_attorney_id')
            .eq('referring_attorney_id', attorneyId)
            .eq('status', 'active');
          stList = attorneySTs || [];

          if (stList.length > 0) {
            const target = stList[0];
            const { data: current } = await supabase
              .from('short_term_agreements')
              .select('linked_appointment_ids')
              .eq('id', target.id)
              .maybeSingle();
            const existing: string[] = ((current as any)?.linked_appointment_ids) || [];
            if (!existing.includes(selectedAppointment.id)) {
              await supabase
                .from('short_term_agreements')
                .update({ linked_appointment_ids: [...existing, selectedAppointment.id] } as any)
                .eq('id', target.id);
            }
          }
        }

        recalcAodIds = aodList.map((d: any) => d.id);
        recalcStIds = stList.map((d: any) => d.id);

        const linkedAodsForRecalc = aodList;
        const linkedSTsForRecalc = stList;

        await Promise.all([
          ...linkedAodsForRecalc.map((d: any) =>
            recalculateAODFromAppointments(d.id, d.referring_attorney_id)
          ),
          ...linkedSTsForRecalc.map((d: any) =>
            recalculateShortTermFromAppointments(d.id, d.referring_attorney_id)
          ),
        ]);

        // 2b. Audit each recalculation triggered by this edit
        if (recalcAodIds.length + recalcStIds.length > 0) {
          const now = new Date().toISOString();
          const recalcRows = [
            ...recalcAodIds.map((id) => ({
              action_type: 'AGREEMENT_RECALCULATED',
              table_name: 'aod_documents',
              record_id: id,
              function_area: 'scheduled_assessment',
              user_id: user.id,
              description: `AOD recalculated at ${now} after finance edit on appointment ${selectedAppointment.id} (${selectedAppointment.claimant_name}) by ${user.email || user.id}.`,
            })),
            ...recalcStIds.map((id) => ({
              action_type: 'AGREEMENT_RECALCULATED',
              table_name: 'short_term_agreements',
              record_id: id,
              function_area: 'scheduled_assessment',
              user_id: user.id,
              description: `Short-term agreement recalculated at ${now} after finance edit on appointment ${selectedAppointment.id} (${selectedAppointment.claimant_name}) by ${user.email || user.id}.`,
            })),
          ];
          await supabase.from('audit_logs').insert(recalcRows);
        }
      } catch (syncErr) {
        console.warn('Agreement recalc warning:', syncErr);
      }

      // 4. Audit log
      await supabase.from('audit_logs').insert({
        action_type: 'APPOINTMENT_FINANCE_UPDATED',
        table_name: 'appointments',
        record_id: selectedAppointment.id,
        function_area: 'scheduled_assessment',
        user_id: user.id,
        description: `Financials updated for ${selectedAppointment.claimant_name}: fee R${serviceFee.toFixed(2)}, discount R${discount.toFixed(2)}, deposit R${depositAmount.toFixed(2)}. Synced to AOD & Short-term agreements.`,
      });

      // 5. Broadcast events for cross-dashboard refresh
      window.dispatchEvent(new CustomEvent('agreement-data-updated', {
        detail: { source: 'scheduled-assessment-finance-edit', appointmentId: selectedAppointment.id }
      }));
      window.dispatchEvent(new CustomEvent('appointment-financials-updated', {
        detail: { appointmentId: selectedAppointment.id, serviceFee, depositAmount, discount }
      }));

      toast({
        title: "Financials Updated",
        description: "Assessment fee, discount and deposit synced to AOD and Short-term agreements.",
      });

      setFinanceDialogOpen(false);
      refetch();
      triggerSync();
    } catch (error: any) {
      console.error('Finance update error:', error);
      toast({
        title: "Update failed",
        description: error?.message || "Could not save financial changes.",
        variant: "destructive",
      });
    } finally {
      setFinanceSaving(false);
    }
  };

  // Open attach report dialog
  const handleAttachReport = async (appointment: ScheduledAppointment) => {
    setSelectedAppointment(appointment);
    setReportFiles([]);
    setAttachDialogOpen(true);

    // Load existing attachments linked to this CLAIMANT (auto-attach across appointments)
    const { data: aptInfo } = await supabase
      .from('appointments')
      .select('claimant_id')
      .eq('id', appointment.id)
      .maybeSingle();

    const claimantId = aptInfo?.claimant_id;
    const query = supabase
      .from('documents')
      .select('id, file_name, file_path, upload_date, upload_time')
      .eq('document_type', 'expert_report')
      .order('upload_date', { ascending: false })
      .order('upload_time', { ascending: false });

    const { data: existing } = claimantId
      ? await query.eq('claimant_id', claimantId)
      : await query.eq('appointment_id', appointment.id);

    setExistingAttachments(existing || []);
    // Auto-select all by default (user can toggle individuals)
    setSelectedExistingIds(new Set((existing || []).map(d => d.id)));
  };

  // Upload report(s) -> Document Vault + expert_reports sync + Report Management
  const handleUploadReport = async () => {
    if (reportFiles.length === 0 || !selectedAppointment) return;
    setAttachUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: aptData } = await supabase
        .from('appointments')
        .select('claimant_id, expert_id')
        .eq('id', selectedAppointment.id)
        .single();

      if (!aptData) throw new Error('Appointment not found');

      const uploadedNames: string[] = [];

      for (const file of reportFiles) {
        const filePath = `reports/${selectedAppointment.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from('attorney-documents').upload(filePath, file);
        if (uploadError) throw uploadError;

        // 1. Sync to Document Vault (append, never overwrite)
        await supabase.from('documents').insert({
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          document_type: 'expert_report',
          claimant_id: aptData.claimant_id,
          expert_id: aptData.expert_id,
          appointment_id: selectedAppointment.id,
          referring_attorney_id: selectedAppointment.referring_attorney_id || null,
          uploaded_by: user.id,
          upload_date: new Date().toISOString().split('T')[0],
          upload_time: new Date().toTimeString().split(' ')[0],
          access_level: 'internal',
          approval_status: 'pending',
          is_visible_to_attorney: true,
          is_visible_to_expert: false,
          notes: `Attached from Scheduled Assessment for ${selectedAppointment.claimant_name}`,
        });

        uploadedNames.push(file.name);
      }

      // 2. Sync to Report Management (expert_reports) — guarded against duplicates
      const batchNote = `Report(s) attached: ${uploadedNames.join(', ')}`;
      const { data: existingReport } = await supabase
        .from('expert_reports')
        .select('id, notes')
        .eq('appointment_id', selectedAppointment.id)
        .limit(1)
        .maybeSingle();

      const mergedNotes = existingReport
        ? [existingReport.notes, batchNote].filter(Boolean).join('\n')
        : batchNote;

      const result = await upsertExpertReport({
        appointment_id: selectedAppointment.id,
        expert_id: aptData.expert_id,
        claimant_id: aptData.claimant_id,
        report_status: 'uploaded',
        report_submitted_date: new Date().toISOString(),
        notes: mergedNotes,
      });

      if (!result.ok) {
        console.error('Expert report upsert failed:', result.error);
        toast({
          title: 'Report sync failed',
          description: result.error ?? 'Could not sync to Report Management.',
          variant: 'destructive',
        });
      }

      // 3. Update appointment report status
      await updateReportStatus(selectedAppointment.id, 'Report Submitted without full payment');

      // 4. Audit log
      await supabase.from('audit_logs').insert({
        action_type: 'REPORT_ATTACHED',
        table_name: 'appointments',
        record_id: selectedAppointment.id,
        function_area: 'scheduled_assessment',
        user_id: user.id,
        description: `${uploadedNames.length} report file(s) attached for ${selectedAppointment.claimant_name}: ${uploadedNames.join(', ')}. Synced to Document Vault & Report Management.`,
      });

      const actionLabel =
        result.action === 'inserted' ? 'created'
        : result.action === 'updated' ? 'updated'
        : 'synced';
      toast({
        title: uploadedNames.length > 1 ? 'Reports Attached' : 'Report Attached',
        description: `${uploadedNames.length} file(s) synced to Document Vault. Report Management entry ${actionLabel}.`,
      });

      // Refresh existing attachments list (claimant-scoped) and auto-select new uploads
      const { data: aptInfo2 } = await supabase
        .from('appointments')
        .select('claimant_id')
        .eq('id', selectedAppointment.id)
        .maybeSingle();
      const claimantId2 = aptInfo2?.claimant_id;
      const refreshQuery = supabase
        .from('documents')
        .select('id, file_name, file_path, upload_date, upload_time')
        .eq('document_type', 'expert_report')
        .order('upload_date', { ascending: false })
        .order('upload_time', { ascending: false });
      const { data: refreshed } = claimantId2
        ? await refreshQuery.eq('claimant_id', claimantId2)
        : await refreshQuery.eq('appointment_id', selectedAppointment.id);
      setExistingAttachments(refreshed || []);
      setSelectedExistingIds(new Set((refreshed || []).map(d => d.id)));
      setReportFiles([]);
      refetch();
      triggerSync();
    } catch (error: any) {
      console.error('Error attaching report:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to attach report.",
        variant: "destructive",
      });
    } finally {
      setAttachUploading(false);
    }
  };

  // Open send-to-attorney email dialog
  const handleSendToAttorney = async (appointment: ScheduledAppointment) => {
    setSelectedAppointment(appointment);
    // Fetch attorney email
    const { data: attyData } = await supabase
      .from('referring_attorneys')
      .select('email')
      .eq('id', appointment.referring_attorney_id)
      .maybeSingle();
    setAttorneyEmail(attyData?.email || '');
    setEmailSubject(`Medico-Legal Report – ${appointment.claimant_name} (${appointment.auto_id})`);
    setEmailBody(`Dear ${appointment.referring_attorney},\n\nPlease find attached the medico-legal report for ${appointment.claimant_name}.\n\nExpert: ${appointment.expert_name} (${appointment.expert_type})\nAppointment Date: ${appointment.appointment_date}\n\nKind regards,\nKutlwano & Associate`);
    setEmailCc('');

    // Load ALL reports linked to this claimant (auto-attach across appointments)
    // 1) Lookup claimant_id for this appointment
    const { data: aptRow } = await supabase
      .from('appointments')
      .select('claimant_id')
      .eq('id', appointment.id)
      .maybeSingle();

    const map = new Map<string, { name: string; path: string; displayName: string; created_at?: string }>();

    // 2) Pull from documents table (canonical source — covers any expert report tied to claimant)
    if (aptRow?.claimant_id) {
      const { data: claimantDocs } = await supabase
        .from('documents')
        .select('file_name, file_path, upload_date, upload_time')
        .eq('claimant_id', aptRow.claimant_id)
        .eq('document_type', 'expert_report')
        .order('upload_date', { ascending: false })
        .order('upload_time', { ascending: false });
      (claimantDocs || []).forEach(d => {
        if (!d.file_path) return;
        map.set(d.file_path, {
          name: d.file_name,
          path: d.file_path,
          displayName: (d.file_name || '').replace(/^\d+_/, ''),
          created_at: `${d.upload_date} ${d.upload_time || ''}`,
        });
      });
    }

    // 3) Fallback: storage folder for this appointment (legacy uploads not in documents table)
    const reportFolder = `reports/${appointment.id}/`;
    const { data: files } = await supabase.storage
      .from('attorney-documents')
      .list(reportFolder, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    (files || []).forEach(f => {
      const path = `${reportFolder}${f.name}`;
      if (!map.has(path)) {
        map.set(path, {
          name: f.name,
          path,
          displayName: f.name.replace(/^\d+_/, ''),
          created_at: (f as any).created_at,
        });
      }
    });

    const list = Array.from(map.values());
    setReportAttachmentList(list);
    // Default: select all (auto-attached)
    setSelectedAttachmentPaths(new Set(list.map(f => f.path)));

    setEmailDialogOpen(true);
  };

  // Send report email to attorney
  const handleSendEmail = async () => {
    if (!selectedAppointment || !attorneyEmail.trim()) {
      toast({ title: "Email Required", description: "Please provide an attorney email.", variant: "destructive" });
      return;
    }
    setEmailSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Download each selected report file and base64-encode for attachment
      let attachments: { filename: string; content: string }[] = [];
      const selectedFiles = reportAttachmentList.filter(f => selectedAttachmentPaths.has(f.path));

      if (selectedFiles.length === 0) {
        toast({ title: "No reports selected", description: "Select at least one report to attach.", variant: "destructive" });
        setEmailSending(false);
        return;
      }

      for (const file of selectedFiles) {
        const { data: fileBlob, error: dlError } = await supabase.storage
          .from('attorney-documents')
          .download(file.path);
        if (dlError || !fileBlob) {
          console.warn('Could not download report:', file.path, dlError?.message);
          continue;
        }
        const arrayBuffer = await fileBlob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < uint8.length; i += chunkSize) {
          binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
        }
        const base64 = btoa(binary);
        attachments.push({ filename: file.displayName, content: base64 });
      }

      const attachmentListHtml = attachments.length > 0
        ? `<ul style="margin:8px 0 0 18px; padding:0;">${attachments.map(a => `<li>📎 ${a.filename}</li>`).join('')}</ul>`
        : '<p style="color:#b91c1c;">⚠ No report file found to attach.</p>';

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1fb6ce, #0e7490); padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: #ffffff; margin: 0;">Medico-Legal Report</h2>
          </div>
          <div style="padding: 20px; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p><strong>Claimant:</strong> ${selectedAppointment.claimant_name}</p>
            <p><strong>Case Reference:</strong> ${selectedAppointment.auto_id}</p>
            <p><strong>Expert:</strong> ${(selectedAppointment.expert_type || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
            <p><strong>Appointment Date:</strong> ${selectedAppointment.appointment_date}</p>
            <p><strong>Attached Report${attachments.length > 1 ? 's' : ''} (${attachments.length}):</strong></p>
            ${attachmentListHtml}
            <hr style="border: 1px solid #e2e8f0; margin: 16px 0;" />
            <div>${emailBody.replace(/\n/g, '<br/>')}</div>
            <hr style="border: 1px solid #e2e8f0; margin: 16px 0;" />
            <p style="font-size: 12px; color: #718096;">Sent from Kutlwano Medico-Legal Assessment System</p>
          </div>
        </div>`;

      // Parse CC addresses
      const ccAddresses = emailCc
        .split(/[,;]/)
        .map(e => e.trim())
        .filter(e => e.length > 0 && e.includes('@'));

      // Queue email
      const { data: inserted, error: insertError } = await supabase.from('email_queue').insert({
        email_type: 'report_delivery',
        recipient_email: attorneyEmail.trim(),
        recipient_name: selectedAppointment.referring_attorney,
        subject: emailSubject,
        html_content: htmlContent,
        status: 'pending',
        related_record_id: selectedAppointment.id,
        related_table: 'appointments',
        metadata: {
          claimant: selectedAppointment.claimant_name,
          recipient_type: 'Attorney',
          source: 'scheduled_assessment',
          ...(ccAddresses.length > 0 && { cc_addresses: ccAddresses }),
          ...(attachments.length > 0 && { attachments }),
        },
      }).select('id').single();

      if (insertError) {
        console.error('Email queue insert error:', insertError);
        throw new Error(`Failed to queue email: ${insertError.message}`);
      }

      // Auto-send via edge function
      if (inserted?.id) {
        const { data: sendResult, error: sendError } = await supabase.functions.invoke('auto-send-queued-email', { body: { emailId: inserted.id } });
        
        if (sendError) {
          console.error('Edge function invoke error:', sendError);
          throw new Error(`Failed to send email: ${sendError.message}`);
        }
        
        if (sendResult && !sendResult.success) {
          console.error('Email send failed:', sendResult.error);
          throw new Error(`Email delivery failed: ${sendResult.error}`);
        }
      } else {
        throw new Error('Failed to queue email: no ID returned');
      }

      // Record delivery in report_deliveries if expert_report exists
      const { data: expertReport } = await supabase
        .from('expert_reports')
        .select('id')
        .eq('appointment_id', selectedAppointment.id)
        .maybeSingle();

      if (expertReport) {
        await supabase.from('report_deliveries').insert({
          expert_report_id: expertReport.id,
          delivered_to_attorney_id: selectedAppointment.referring_attorney_id || null,
          delivery_method: 'email',
          delivered_by: user.id,
          notes: `Sent from Scheduled Assessment: ${emailSubject}`,
        });

        // Update report status to delivered
        await supabase.from('expert_reports').update({
          report_status: 'report delivered',
          updated_at: new Date().toISOString(),
        }).eq('id', expertReport.id);
      }

      // Update appointment report status
      await updateReportStatus(selectedAppointment.id, 'Report Submitted on AOD');

      // Audit log
      await supabase.from('audit_logs').insert({
        action_type: 'REPORT_EMAILED_TO_ATTORNEY',
        table_name: 'appointments',
        record_id: selectedAppointment.id,
        function_area: 'scheduled_assessment',
        user_id: user.id,
        description: `Report emailed to ${selectedAppointment.referring_attorney} (${attorneyEmail}) for ${selectedAppointment.claimant_name}.`,
      });

      toast({ title: "Email Sent", description: `Report sent to ${selectedAppointment.referring_attorney}.` });
      setEmailDialogOpen(false);
      setSelectedAppointment(null);
      refetch();
      triggerSync();
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({ title: "Error", description: error.message || "Failed to send email.", variant: "destructive" });
    } finally {
      setEmailSending(false);
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
      
      let reportData = filteredAppointments;
      
      // If not current period, fetch historical data
      const { year: currentYear, month: currentMonth } = sastNowParts();
      const currentQuarter = Math.floor((currentMonth - 1) / 3) + 1;
      
      const isCurrentPeriod = (
        (reportPeriod === 'yearly' && parseInt(selectedYear) === currentYear) ||
        (reportPeriod === 'monthly' && parseInt(selectedYear) === currentYear && parseInt(selectedMonth) === currentMonth) ||
        (reportPeriod === 'quarterly' && parseInt(selectedYear) === currentYear && parseInt(selectedQuarter) === currentQuarter)
      );

      if (!isCurrentPeriod) {
        const historicalData = await getHistoricalData(reportPeriod, selectedYear, selectedMonth, selectedQuarter);
        if (historicalData.length > 0) {
          reportData = historicalData;
        } else {
          // Fall back to current filtered appointments if no archived data
          console.log('No archived data found, using current filtered appointments for report generation');
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

      // Generate PDF on the client for reliability - landscape for wide tables
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      
      // Add branding
      const startY = addBrandingToPDF(doc, 'Scheduled Assessments Report', `Period: ${periodText}`);

      // Summary statistics
      const totalFees = reportData.reduce((sum, a) => sum + (a.assessment_fee || 0), 0);
      const completedCount = reportData.filter(a => a.report_status === 'Received' || a.report_status === 'Completed').length;
      const pendingCount = reportData.filter(a => a.report_status === 'Pending' || a.report_status === 'Awaiting').length;

      // Summary cards
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const summaryY = startY;
      const colW = 90;
      const summaryItems = [
        { label: 'Total Assessments', value: `${reportData.length}` },
        { label: 'Total Fees', value: `R ${totalFees.toFixed(2)}` },
        { label: 'Reports Completed', value: `${completedCount} / ${reportData.length}` },
      ];
      summaryItems.forEach((item, i) => {
        const x = 14 + i * colW;
        doc.setDrawColor(31, 182, 206);
        doc.setFillColor(245, 250, 252);
        doc.roundedRect(x, summaryY, colW - 4, 14, 2, 2, 'FD');
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(item.label, x + (colW - 4) / 2, summaryY + 5, { align: 'center' });
        doc.setFontSize(10);
        doc.setTextColor(31, 41, 55);
        doc.text(item.value, x + (colW - 4) / 2, summaryY + 11, { align: 'center' });
      });

      const tableStartY = summaryY + 20;

      const rows = reportData.map(a => [
        a.auto_id,
        a.claimant_name,
        a.referring_attorney || 'N/A',
        a.expert_name,
        a.expert_type,
        a.appointment_date,
        `R ${a.assessment_fee?.toFixed(2) || '0.00'}`,
        a.status,
        a.report_status,
        a.report_date || 'N/A',
      ]);

      const styledOptions = getStyledTableOptions();

      autoTable(doc, {
        startY: tableStartY,
        head: [[
          'Auto ID',
          'Claimant Name',
          'Referring\nAttorney',
          'Expert Name',
          'Expert Type',
          'Appt. Date',
          'Assess. Fee',
          'Status',
          'Report\nStatus',
          'Report\nDate',
        ]],
        body: rows,
        theme: 'grid',
        headStyles: {
          ...styledOptions.headStyles,
          fontSize: 7,
          cellPadding: 2,
          valign: 'middle',
          halign: 'center',
          minCellHeight: 12,
        },
        bodyStyles: {
          fontSize: 7,
          cellPadding: 1.5,
          valign: 'middle',
          overflow: 'linebreak',
        },
        alternateRowStyles: styledOptions.alternateRowStyles,
        columnStyles: {
          0: { cellWidth: 18, halign: 'center' },
          1: { cellWidth: 26 },
          2: { cellWidth: 28 },
          3: { cellWidth: 26 },
          4: { cellWidth: 22 },
          5: { cellWidth: 20, halign: 'center' },
          6: { cellWidth: 22, halign: 'right' },
          7: { cellWidth: 22, halign: 'right' },
          8: { cellWidth: 22, halign: 'right' },
          9: { cellWidth: 18, halign: 'center' },
          10: { cellWidth: 20, halign: 'center' },
          11: { cellWidth: 20, halign: 'center' },
        },
        margin: { left: 14, right: 14 },
        didDrawPage: () => {
          // Page border
          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.3);
          doc.rect(7, 7, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 14);
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
              <SaveStatusIndicator 
                status={saveStatus.status}
                lastSaved={saveStatus.lastSaved}
                error={saveStatus.error}
              />
            </div>
            <div className="flex items-center gap-2">
              <BulkAppointmentUpload onUploadComplete={() => triggerSync()} />
              <Button variant="outline" onClick={() => refetch()} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
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

        {/* Assessment Period Statistics */}
        <AssessmentPeriodStats 
          appointments={appointments} 
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          selectedQuarter={selectedQuarter}
        />
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Scheduled Assessment Appointments
            </CardTitle>
            <div className="flex items-center gap-2 max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by claimant, expert or referring attorney..."
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
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
                
                {reportPeriod !== 'all' && (
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 15 }, (_, i) => sastNowParts().year - i).map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                )}
                
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
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  placeholder="Filter by date range"
                />
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
                    <TableHead>Assessment Code</TableHead>
                    <TableHead>Claimant Name</TableHead>
                    <TableHead>Medical Expert</TableHead>
                    <TableHead>Type of Expert</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Referring Attorney</TableHead>
                    <TableHead>Sales Consultant</TableHead>
                    <TableHead>Assessment Fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Report Status</TableHead>
                    <TableHead>Comments</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-8">
                        Loading appointments...
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAppointments.map((appointment) => (
                      <TableRow key={appointment.id}>
                        <TableCell className="font-medium">{appointment.auto_id}</TableCell>
                        <TableCell>
                          {appointment.assessment_code ? (
                            <Badge variant="outline" className="font-mono text-xs whitespace-nowrap">
                              {appointment.assessment_code}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
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
                          <Select
                            value={salesConsultants.find(sc => sc.name === appointment.sales_consultant_name)?.id || "unassigned"}
                            onValueChange={(value) => {
                              const consultantId = value === "unassigned" ? null : value;
                              updateSalesConsultant(appointment.id, consultantId);
                            }}
                          >
                            <SelectTrigger className="w-36 h-8 text-xs">
                              <SelectValue placeholder="Assign..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">— Unassigned —</SelectItem>
                              {salesConsultants.map(sc => (
                                <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">R {appointment.assessment_fee.toFixed(2)}</span>
                        </TableCell>
                        <TableCell>
                          <Select value={appointment.status} onValueChange={(value) => updateStatus(appointment.id, value)}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Scheduled">Scheduled</SelectItem>
                              <SelectItem value="Assessed">Assessed</SelectItem>
                              <SelectItem value="Re-Assessed">Re-Assessed</SelectItem>
                              <SelectItem value="Cancelled">Cancelled</SelectItem>
                              <SelectItem value="Rescheduled">Rescheduled</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Select value={appointment.report_status} onValueChange={(value) => updateReportStatusLocal(appointment.id, value)}>
                              <SelectTrigger className="w-56 bg-background">
                                <SelectValue placeholder="Select status">
                                  {appointment.report_status}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="max-h-72 overflow-y-auto bg-popover border shadow-lg z-[100]">
                                <SelectItem value="Initial Stage">Initial Stage</SelectItem>
                                <SelectItem value="Preparing report">Preparing Report</SelectItem>
                                <SelectItem value="Report on Final Stage">Report on Final Stage</SelectItem>
                                <SelectItem value="Report Submitted without full payment">Report Submitted without Full Payment</SelectItem>
                                <SelectItem value="Report Submitted on AOD">Report Submitted on AOD</SelectItem>
                                <SelectItem value="Report fully paid & submitted">Report Fully Paid & Submitted</SelectItem>
                                <SelectItem value="Court Attendance">Court Attendance</SelectItem>
                                <SelectItem value="Court Preparation">Court Preparation</SelectItem>
                                <SelectItem value="Affidavits">Affidavits</SelectItem>
                                <SelectItem value="Joint Minutes">Joint Minutes</SelectItem>
                                <SelectItem value="Addendum">Addendum</SelectItem>
                                <SelectItem value="Re-Assessment">Re-Assessment</SelectItem>
                              </SelectContent>
                            </Select>
                            {/* Show timestamp for submitted/completed statuses */}
                            {(appointment.report_status.toLowerCase().includes('submitted') || 
                              appointment.report_status.toLowerCase().includes('fully paid')) && 
                              appointment.report_date && (
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium leading-tight">
                                ✓ Submitted: {appointment.report_date}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Textarea
                            placeholder="Add comments..."
                            value={comments[appointment.id] !== undefined ? comments[appointment.id] : appointment.comments}
                            onChange={(e) => updateComments(appointment.id, e.target.value)}
                            className="min-h-[60px] w-40"
                          />
                          {comments[appointment.id] !== undefined && comments[appointment.id] !== appointment.comments && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">Auto-saving...</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAttachReport(appointment)}
                              className="h-8 w-8 p-0"
                              title="Attach Report"
                            >
                              <Paperclip className="h-4 w-4 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSendToAttorney(appointment)}
                              className="h-8 w-8 p-0"
                              title="Send to Attorney"
                            >
                              <Send className="h-4 w-4 text-teal-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleFinanceEdit(appointment)}
                              className="h-8 w-8 p-0"
                              title="Edit Fee / Discount / Deposit (syncs to AOD & Short-term)"
                            >
                              <span className="text-emerald-600 text-sm font-bold leading-none">R</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(appointment.id)}
                              className="h-8 w-8 p-0"
                              title="Edit (full appointment)"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(appointment.id)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this assessment appointment. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>

        <BulkAppointmentEmailDialog
          isOpen={bulkEmailDialogOpen}
          onClose={() => setBulkEmailDialogOpen(false)}
          appointments={filteredAppointments.map(apt => ({
            id: apt.id,
            claimant_name: apt.claimant_name,
            expert_name: apt.expert_name,
            appointment_date: `${apt.appointment_date} ${apt.appointment_time}`,
            referring_attorney: apt.referring_attorney,
            referring_attorney_id: apt.referring_attorney_id || ''
          }))}
          onSuccess={refetch}
        />

        {/* Attach Report Dialog */}
        <Dialog open={attachDialogOpen} onOpenChange={setAttachDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5 text-primary" />
                Attach Report
              </DialogTitle>
              <DialogDescription>
                Upload a report for <strong>{selectedAppointment?.claimant_name}</strong>. 
                This will sync to the Document Vault and Report Management.
              </DialogDescription>
            </DialogHeader>
            {selectedAppointment && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Expert:</span> {selectedAppointment.expert_name}</div>
                  <div><span className="text-muted-foreground">Type:</span> {selectedAppointment.expert_type}</div>
                  <div><span className="text-muted-foreground">Attorney:</span> {selectedAppointment.referring_attorney}</div>
                  <div><span className="text-muted-foreground">Date:</span> {selectedAppointment.appointment_date}</div>
                </div>
                {existingAttachments.length > 0 && (
                  <div className="space-y-2 border rounded-md p-2 bg-muted/30">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Linked reports for this claimant ({selectedExistingIds.size}/{existingAttachments.length})
                      </p>
                      <Select value={attachmentSort} onValueChange={(v: any) => setAttachmentSort(v)}>
                        <SelectTrigger className="h-7 w-[140px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Newest first</SelectItem>
                          <SelectItem value="oldest">Oldest first</SelectItem>
                          <SelectItem value="name_asc">Name (A–Z)</SelectItem>
                          <SelectItem value="name_desc">Name (Z–A)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => setSelectedExistingIds(new Set(existingAttachments.map(d => d.id)))}
                      >
                        Select all
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => setSelectedExistingIds(new Set())}
                      >
                        Clear
                      </Button>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {[...existingAttachments].sort((a, b) => {
                        if (attachmentSort === 'name_asc') return a.file_name.localeCompare(b.file_name);
                        if (attachmentSort === 'name_desc') return b.file_name.localeCompare(a.file_name);
                        const aKey = `${a.upload_date} ${a.upload_time || ''}`;
                        const bKey = `${b.upload_date} ${b.upload_time || ''}`;
                        return attachmentSort === 'newest' ? bKey.localeCompare(aKey) : aKey.localeCompare(bKey);
                      }).map(doc => {
                        const checked = selectedExistingIds.has(doc.id);
                        return (
                          <label key={doc.id} className="text-xs flex items-center gap-2 hover:bg-background rounded px-1 py-1 cursor-pointer">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setSelectedExistingIds(prev => {
                                  const next = new Set(prev);
                                  if (v) next.add(doc.id); else next.delete(doc.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="truncate flex-1">📄 {doc.file_name}</span>
                            <span className="text-muted-foreground shrink-0">
                              {doc.upload_date} {doc.upload_time?.slice(0, 5)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="report-file">Add Report File(s) — PDF, DOC, DOCX</Label>
                  <Input
                    id="report-file"
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setReportFiles(Array.from(e.target.files || []))}
                  />
                  {reportFiles.length > 0 && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {reportFiles.map((f, i) => (
                        <p key={i}>• {f.name} ({(f.size / 1024).toFixed(0)} KB)</p>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground italic">
                    You can attach multiple files now or return later to add more — all uploads sync to Report Management.
                  </p>
                </div>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
              <Button variant="outline" onClick={() => setAttachDialogOpen(false)}>Close</Button>
              {existingAttachments.length > 0 && selectedExistingIds.size > 0 && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    if (!selectedAppointment) return;
                    const chosen = existingAttachments.filter(d => selectedExistingIds.has(d.id) && d.file_path);
                    setAttachDialogOpen(false);
                    await handleSendToAttorney(selectedAppointment);
                    // Override selection with the user-picked subset
                    setSelectedAttachmentPaths(new Set(chosen.map(d => d.file_path as string)));
                  }}
                >
                  <Send className="h-4 w-4 mr-1" />
                  Send Selected ({selectedExistingIds.size})
                </Button>
              )}
              <Button onClick={handleUploadReport} disabled={reportFiles.length === 0 || attachUploading}>
                {attachUploading ? 'Uploading...' : `Attach ${reportFiles.length || ''} & Sync`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Send to Attorney Email Dialog */}
        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] sm:max-h-[85vh] p-0 flex flex-col gap-0">
            <DialogHeader className="p-4 sm:p-6 pb-2 border-b shrink-0">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Send className="h-5 w-5 text-teal-600" />
                Send Report to Attorney
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Email report notification to the referring attorney for <strong>{selectedAppointment?.claimant_name}</strong>.
              </DialogDescription>
            </DialogHeader>
            {selectedAppointment && (
              <div className="space-y-4 overflow-y-auto px-4 sm:px-6 py-4 flex-1 min-h-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm bg-muted/50 p-3 rounded-lg">
                  <div><span className="text-muted-foreground">Claimant:</span> {selectedAppointment.claimant_name}</div>
                  <div><span className="text-muted-foreground">Expert:</span> {selectedAppointment.expert_name}</div>
                  <div><span className="text-muted-foreground">Attorney:</span> {selectedAppointment.referring_attorney}</div>
                  <div><span className="text-muted-foreground">Date:</span> {selectedAppointment.appointment_date}</div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attorney-email">Attorney Email</Label>
                  <Input
                    id="attorney-email"
                    type="email"
                    value={attorneyEmail}
                    onChange={(e) => setAttorneyEmail(e.target.value)}
                    placeholder="attorney@lawfirm.co.za"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-cc">CC (comma-separated)</Label>
                  <Input
                    id="email-cc"
                    type="text"
                    value={emailCc}
                    onChange={(e) => setEmailCc(e.target.value)}
                    placeholder="cc1@example.com, cc2@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-subject">Subject</Label>
                  <Input
                    id="email-subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-body">Message</Label>
                  <Textarea
                    id="email-body"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={5}
                    className="resize-none"
                  />
                </div>

                {/* Report Attachments Selector */}
                <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-teal-600" />
                      Attach Reports ({selectedAttachmentPaths.size}/{reportAttachmentList.length})
                    </Label>
                    {reportAttachmentList.length > 0 && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setSelectedAttachmentPaths(new Set(reportAttachmentList.map(f => f.path)))}
                        >
                          Select all
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setSelectedAttachmentPaths(new Set())}
                        >
                          Clear
                        </Button>
                      </div>
                    )}
                  </div>
                  {reportAttachmentList.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No reports linked to this claimant yet. Use the 📎 attach action to upload one.
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {reportAttachmentList.map((f) => {
                        const checked = selectedAttachmentPaths.has(f.path);
                        return (
                          <label
                            key={f.path}
                            className="flex items-center gap-2 p-2 rounded hover:bg-background cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setSelectedAttachmentPaths(prev => {
                                  const next = new Set(prev);
                                  if (v) next.add(f.path); else next.delete(f.path);
                                  return next;
                                });
                              }}
                            />
                            <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="truncate flex-1" title={f.displayName}>{f.displayName}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter className="p-4 sm:p-6 pt-3 border-t shrink-0 flex-col-reverse sm:flex-row gap-2 sm:gap-2">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
              <Button className="w-full sm:w-auto" onClick={handleSendEmail} disabled={emailSending || !attorneyEmail.trim() || selectedAttachmentPaths.size === 0}>
                {emailSending ? 'Sending...' : `Send Email${selectedAttachmentPaths.size > 0 ? ` (${selectedAttachmentPaths.size})` : ''}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Financial Edit Dialog — Fee, Discount, Deposit (auto-syncs to AOD + Short-term) */}
         <Dialog open={financeDialogOpen} onOpenChange={setFinanceDialogOpen}>
           <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
             <DialogHeader>
               <DialogTitle className="flex items-center gap-2">
                 <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold">R</span>
                 Edit Financials
               </DialogTitle>
              <DialogDescription>
                Update assessment fee, discount and deposit for{' '}
                <strong>{selectedAppointment?.claimant_name}</strong>. Changes
                automatically sync to the linked AOD and Short-term agreement.
              </DialogDescription>
            </DialogHeader>
            {selectedAppointment && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/50 p-3 rounded-md">
                  <div><span className="text-muted-foreground">Attorney:</span> {selectedAppointment.referring_attorney}</div>
                  <div><span className="text-muted-foreground">Date:</span> {selectedAppointment.appointment_date}</div>
                  <div><span className="text-muted-foreground">Expert:</span> {selectedAppointment.expert_name}</div>
                  <div><span className="text-muted-foreground">Ref:</span> {selectedAppointment.auto_id}</div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fin-fee">Assessment Fee (R)</Label>
                  <Input
                    id="fin-fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={financeForm.assessmentFee}
                    onChange={(e) => setFinanceForm(f => ({ ...f, assessmentFee: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="fin-discount">Discount</Label>
                    <Input
                      id="fin-discount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={financeForm.discount}
                      onChange={(e) => setFinanceForm(f => ({ ...f, discount: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={financeForm.discountType}
                      onValueChange={(v: any) => setFinanceForm(f => ({ ...f, discountType: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="amount">R (amount)</SelectItem>
                        <SelectItem value="percentage">% (percent)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fin-deposit">Deposit / Payment Received (R)</Label>
                  <Input
                    id="fin-deposit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={financeForm.deposit}
                    onChange={(e) => setFinanceForm(f => ({ ...f, deposit: e.target.value }))}
                  />
                </div>

                <div className="rounded-md border bg-emerald-50/40 p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Discount applied:</span><span className="font-medium">R {financePreview.discount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Final fee:</span><span className="font-medium">R {financePreview.finalFee.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Deposit:</span><span className="font-medium">R {financePreview.deposit.toFixed(2)}</span></div>
                  <div className="flex justify-between border-t pt-1 mt-1"><span className="text-muted-foreground">Outstanding balance:</span><span className="font-semibold">R {financePreview.balance.toFixed(2)}</span></div>
                </div>

                <p className="text-xs text-muted-foreground italic">
                  Saving updates the appointment, the linked AOD document for the same
                  attorney/month, and any linked Short-term agreement.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setFinanceDialogOpen(false)} disabled={financeSaving}>
                Cancel
              </Button>
              <Button onClick={handleFinanceSave} disabled={financeSaving}>
                {financeSaving ? 'Saving & Syncing...' : 'Save & Sync'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <CompanyFooter />
      </div>
    );
  };

  export default ScheduledAssessment;