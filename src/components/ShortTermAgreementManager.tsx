import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card } from "@/components/ui/card";
import { FileText, Plus, Edit, Trash2, Calendar as CalendarIcon, Upload, Download, Loader2, Mail, FileCheck, AlertTriangle, DollarSign } from "lucide-react";
import { useShortTermAgreements } from "@/hooks/useShortTermAgreements";
import { syncShortTermPaymentToAppointments, fetchLinkedAssessments } from "@/hooks/usePaymentSync";
import { ShortTermAgreementDialog } from "./ShortTermAgreementDialog";
import { format, addMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";
import { usePermissions } from "@/hooks/usePermissions";

type ReferringAttorney = {
  id: string;
  name: string;
  law_firm: string | null;
};

type ShortTermAgreementManagerProps = {
  attorneys: ReferringAttorney[];
  lawFirmId: string;
  onSyncAttorney?: (attorneyId?: string) => Promise<void>;
  isSyncing?: boolean;
};

export const ShortTermAgreementManager = ({ attorneys, lawFirmId, onSyncAttorney, isSyncing }: ShortTermAgreementManagerProps) => {
  const { triggerSync } = useAppointmentSync();
  const { agreements, loading, createAgreement, updateAgreement, deleteAgreement, refetch } = useShortTermAgreements(lawFirmId);
  const { isAdmin, isEmployee } = usePermissions();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<any>(null);
  const [selectedAttorney, setSelectedAttorney] = useState<string>("");
  const [contractStartDate, setContractStartDate] = useState<Date>();
  const [contractEndDate, setContractEndDate] = useState<Date>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [selectedAgreements, setSelectedAgreements] = useState<string[]>([]);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [attorneyNames, setAttorneyNames] = useState<{ [key: string]: string }>({});
  const [assessmentCounts, setAssessmentCounts] = useState<{ [key: string]: number }>({});
  const [reportCounts, setReportCounts] = useState<{ [key: string]: { completed: number; pending: number; total: number } }>({});
  
  // Payment capture state
  const [paymentAgreementId, setPaymentAgreementId] = useState<string | null>(null);
  const [paymentAttorneyId, setPaymentAttorneyId] = useState<string>('');
  const [capturePaymentAmount, setCapturePaymentAmount] = useState('');
  const [capturePaymentType, setCapturePaymentType] = useState<'deposit' | 'regular' | 'final'>('regular');
  const [captureReportsTaken, setCaptureReportsTaken] = useState('');
  const [capturePaymentDate, setCapturePaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [capturePaymentNotes, setCapturePaymentNotes] = useState('');
  const [capturingPayment, setCapturingPayment] = useState(false);
  const [captureAssessments, setCaptureAssessments] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    agreement_method: "email" as "email" | "telephone" | "both",
    agreement_reference: "",
    contract_description: "",
    total_contract_value: "",
    deposit_amount: "",
    payment_plan_structure: "",
    interest_rate_1_3_months: "",
    interest_rate_6_months: "",
    interest_rate_12_months: "",
    total_reports_agreed: "",
    notes: "",
    payment_status: "pending" as "pending" | "partial" | "paid" | "overdue",
  });

  const resetForm = () => {
    setSelectedAttorney("");
    setContractStartDate(undefined);
    setContractEndDate(undefined);
    setSelectedFile(null);
    setFormData({
      agreement_method: "email",
      agreement_reference: "",
      contract_description: "",
      total_contract_value: "",
      deposit_amount: "",
      payment_plan_structure: "",
      interest_rate_1_3_months: "",
      interest_rate_6_months: "",
      interest_rate_12_months: "",
      total_reports_agreed: "",
      notes: "",
      payment_status: "pending",
    });
  };

  const validateDuration = (startDate: Date, endDate: Date): boolean => {
    const maxEndDate = addMonths(startDate, 12);
    if (endDate > maxEndDate) {
      toast.error("Agreement duration cannot exceed 12 months");
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!selectedAttorney || !contractStartDate || !contractEndDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!validateDuration(contractStartDate, contractEndDate)) {
      return;
    }

    try {
      setIsUploading(true);
      let documentUrl: string | undefined;
      let fileName: string | undefined;

      // Upload file if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${lawFirmId}/${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('short-term-agreements')
          .upload(filePath, selectedFile);

        if (uploadError) {
          toast.error("Failed to upload document");
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('short-term-agreements')
          .getPublicUrl(filePath);

        documentUrl = publicUrl;
        fileName = selectedFile.name;
      }

      const agreementData = {
        referring_attorney_id: selectedAttorney,
        agreement_method: formData.agreement_method,
        agreement_reference: formData.agreement_reference || undefined,
        contract_description: formData.contract_description || undefined,
        contract_start_date: format(contractStartDate, "yyyy-MM-dd"),
        contract_end_date: format(contractEndDate, "yyyy-MM-dd"),
        total_contract_value: formData.total_contract_value ? parseFloat(formData.total_contract_value) : undefined,
        deposit_amount: formData.deposit_amount ? parseFloat(formData.deposit_amount) : undefined,
        payment_plan_structure: formData.payment_plan_structure || undefined,
        interest_rate_1_3_months: formData.interest_rate_1_3_months ? parseFloat(formData.interest_rate_1_3_months) : undefined,
        interest_rate_6_months: formData.interest_rate_6_months ? parseFloat(formData.interest_rate_6_months) : undefined,
        interest_rate_12_months: formData.interest_rate_12_months ? parseFloat(formData.interest_rate_12_months) : undefined,
        total_reports_agreed: formData.total_reports_agreed ? parseInt(formData.total_reports_agreed) : undefined,
        notes: formData.notes || undefined,
        payment_status: formData.payment_status,
        status: "active" as const,
        document_url: documentUrl,
        file_name: fileName,
      };

      await createAgreement(agreementData);
      triggerSync(); // Update all dashboards
      setIsCreateOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error creating agreement:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleEdit = (agreement: any) => {
    setEditingAgreement(agreement);
    setSelectedAttorney(agreement.attorney_id);
    setContractStartDate(new Date(agreement.contract_start_date));
    setContractEndDate(new Date(agreement.contract_end_date));
    setFormData({
      agreement_method: agreement.agreement_method,
      agreement_reference: agreement.agreement_reference || "",
      contract_description: agreement.contract_description || "",
      total_contract_value: agreement.total_contract_value?.toString() || "",
      deposit_amount: agreement.deposit_amount?.toString() || "",
      payment_plan_structure: agreement.payment_plan_structure || "",
      interest_rate_1_3_months: agreement.interest_rate_1_3_months?.toString() || "",
      interest_rate_6_months: agreement.interest_rate_6_months?.toString() || "",
      interest_rate_12_months: agreement.interest_rate_12_months?.toString() || "",
      total_reports_agreed: agreement.total_reports_agreed?.toString() || "",
      notes: agreement.notes || "",
      payment_status: agreement.payment_status,
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingAgreement || !contractStartDate || !contractEndDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!validateDuration(contractStartDate, contractEndDate)) {
      return;
    }

    try {
      setIsUploading(true);
      let documentUrl = editingAgreement.document_url;
      let fileName = editingAgreement.file_name;

      // Upload new file if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${lawFirmId}/${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('short-term-agreements')
          .upload(filePath, selectedFile);

        if (uploadError) {
          toast.error("Failed to upload document");
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('short-term-agreements')
          .getPublicUrl(filePath);

        documentUrl = publicUrl;
        fileName = selectedFile.name;
      }

      const updates = {
        attorney_id: selectedAttorney,
        agreement_method: formData.agreement_method,
        agreement_reference: formData.agreement_reference || undefined,
        contract_description: formData.contract_description || undefined,
        contract_start_date: format(contractStartDate, "yyyy-MM-dd"),
        contract_end_date: format(contractEndDate, "yyyy-MM-dd"),
        total_contract_value: formData.total_contract_value ? parseFloat(formData.total_contract_value) : undefined,
        deposit_amount: formData.deposit_amount ? parseFloat(formData.deposit_amount) : undefined,
        payment_plan_structure: formData.payment_plan_structure || undefined,
        interest_rate_1_3_months: formData.interest_rate_1_3_months ? parseFloat(formData.interest_rate_1_3_months) : undefined,
        interest_rate_6_months: formData.interest_rate_6_months ? parseFloat(formData.interest_rate_6_months) : undefined,
        interest_rate_12_months: formData.interest_rate_12_months ? parseFloat(formData.interest_rate_12_months) : undefined,
        total_reports_agreed: formData.total_reports_agreed ? parseInt(formData.total_reports_agreed) : undefined,
        notes: formData.notes || undefined,
        payment_status: formData.payment_status,
        document_url: documentUrl,
        file_name: fileName,
      };

      await updateAgreement(editingAgreement.id, updates);
      triggerSync(); // Update all dashboards
      setIsEditOpen(false);
      resetForm();
      setEditingAgreement(null);
    } catch (error) {
      console.error("Error updating agreement:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this agreement?")) {
      await deleteAgreement(id);
      triggerSync(); // Update all dashboards
    }
  };

  // Open payment capture dialog
  const handleOpenCapturePayment = async (agreement: any) => {
    setPaymentAgreementId(agreement.id);
    setPaymentAttorneyId(agreement.referring_attorney_id);
    setCapturePaymentAmount('');
    setCapturePaymentType('regular');
    setCaptureReportsTaken('');
    setCapturePaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setCapturePaymentNotes('');
    
    // Fetch linked assessments for this attorney
    const assessments = await fetchLinkedAssessments(agreement.referring_attorney_id);
    setCaptureAssessments(assessments);
  };

  const handleCapturePayment = async () => {
    if (!capturePaymentAmount || !capturePaymentDate || !paymentAgreementId || !paymentAttorneyId) {
      toast.error('Please fill in all required fields');
      return;
    }

    const amount = parseFloat(capturePaymentAmount);
    const reports = parseInt(captureReportsTaken) || 0;

    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    if (capturePaymentType !== 'deposit' && reports <= 0) {
      toast.error('Regular/Final payments require specifying the number of reports taken out');
      return;
    }

    try {
      setCapturingPayment(true);

      // Sync payment to appointments and AOD
      const syncResults = await syncShortTermPaymentToAppointments(
        paymentAgreementId,
        paymentAttorneyId,
        amount,
        reports,
        capturePaymentType,
        capturePaymentDate
      );

      if (capturePaymentType !== 'deposit' && syncResults.appointmentsSynced > 0) {
        toast.success(`Payment R${amount.toLocaleString()} captured: ${syncResults.appointmentsSynced} assessment(s) updated, reports marked as taken out${syncResults.aodSynced ? ' & AOD updated' : ''}`);
      } else if (capturePaymentType === 'deposit') {
        toast.success(`Deposit R${amount.toLocaleString()} captured and allocated to assessment${syncResults.aodSynced ? ' & AOD updated' : ''}`);
      } else {
        toast.success('Payment captured successfully');
      }

      setPaymentAgreementId(null);
      await refetch();
      triggerSync();
    } catch (error: any) {
      console.error('Error capturing payment:', error);
      toast.error('Failed to capture payment');
    } finally {
      setCapturingPayment(false);
    }
  };

  // Fetch attorney names from referring_attorneys table (excluding system companies)
  useEffect(() => {
    const fetchAttorneyNames = async () => {
      if (agreements.length === 0) return;
      
      const attorneyIds = [...new Set(agreements.map(a => a.referring_attorney_id))];
      const { data, error } = await supabase
        .from('referring_attorneys')
        .select('id, name, is_system_company')
        .in('id', attorneyIds);
      
      if (!error && data) {
        const nameMap: { [key: string]: string } = {};
        data.forEach(att => {
          // Only include non-system companies
          if (!att.is_system_company) {
            nameMap[att.id] = att.name;
          }
        });
        setAttorneyNames(nameMap);
      }
    };
    
    fetchAttorneyNames();
  }, [agreements]);

  // Fetch assessment counts and report counts for short-term agreements
  useEffect(() => {
    const fetchAssessmentAndReportCounts = async () => {
      if (agreements.length === 0) return;
      
      const counts: { [key: string]: number } = {};
      const reports: { [key: string]: { completed: number; pending: number; total: number } } = {};
      
      for (const agreement of agreements) {
        // Extract appointment ID from notes if linked
        const appointmentMatch = agreement.notes?.match(/APPOINTMENT:([a-f0-9-]+)/);
        const appointmentId = appointmentMatch ? appointmentMatch[1] : null;

        if (appointmentId) {
          // Direct link to appointment - count as 1 assessment
          counts[agreement.id] = 1;

          // Fetch report status for this specific appointment
          const { data: expertReports } = await supabase
            .from('expert_reports')
            .select('id, report_status')
            .eq('appointment_id', appointmentId);

          const completedReportStatuses = [
            'report_submitted_on_aod',
            'report_fully_paid_submitted',
            'report submitted on aod',
            'report fully paid & submitted',
            'completed',
            'received',
            'released'
          ];

          const completedReports = expertReports?.filter(report => 
            completedReportStatuses.some(status => 
              report.report_status?.toLowerCase().includes(status.toLowerCase().replace(/_/g, ' ')) ||
              report.report_status?.toLowerCase().replace(/_/g, ' ') === status.toLowerCase()
            )
          ).length || 0;

          const pendingReports = expertReports?.filter(report => 
            report.report_status && !completedReportStatuses.some(status => 
              report.report_status?.toLowerCase().includes(status.toLowerCase().replace(/_/g, ' '))
            )
          ).length || 0;

          reports[agreement.id] = {
            completed: completedReports,
            pending: pendingReports,
            total: expertReports?.length || 0
          };
        } else if (agreement.contract_start_date && agreement.referring_attorney_id) {
          // Fallback: count by month if no direct link
          const startDate = new Date(agreement.contract_start_date);
          const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
          const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59);

          const { data: appointments, count } = await supabase
            .from('appointments')
            .select('id', { count: 'exact' })
            .eq('referring_attorney_id', agreement.referring_attorney_id)
            .eq('payment_terms', 'short-term')
            .gte('appointment_date', monthStart.toISOString())
            .lte('appointment_date', monthEnd.toISOString())
            .is('deleted_at', null);

          counts[agreement.id] = count || 0;

          // Fetch reports for these appointments
          if (appointments && appointments.length > 0) {
            const appointmentIds = appointments.map(a => a.id);
            const { data: expertReports } = await supabase
              .from('expert_reports')
              .select('id, report_status, appointment_id')
              .in('appointment_id', appointmentIds);

            const completedReportStatuses = [
              'report_submitted_on_aod',
              'report_fully_paid_submitted',
              'completed',
              'received',
              'released'
            ];

            const completedReports = expertReports?.filter(report => 
              completedReportStatuses.some(status => 
                report.report_status?.toLowerCase().includes(status.toLowerCase().replace(/_/g, ' '))
              )
            ).length || 0;

            const pendingReports = expertReports?.filter(report => 
              report.report_status && !completedReportStatuses.some(status => 
                report.report_status?.toLowerCase().includes(status.toLowerCase().replace(/_/g, ' '))
              )
            ).length || 0;

            reports[agreement.id] = {
              completed: completedReports,
              pending: pendingReports,
              total: expertReports?.length || 0
            };
          } else {
            reports[agreement.id] = { completed: 0, pending: 0, total: 0 };
          }
        } else {
          counts[agreement.id] = 0;
          reports[agreement.id] = { completed: 0, pending: 0, total: 0 };
        }
      }
      
      setAssessmentCounts(counts);
      setReportCounts(reports);
    };
    
    fetchAssessmentAndReportCounts();

    // Subscribe to appointment and expert_reports changes
    const appointmentChannel = supabase
      .channel('short-term-appointment-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => fetchAssessmentAndReportCounts()
      )
      .subscribe();

    const expertReportsChannel = supabase
      .channel('short-term-expert-reports-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expert_reports' },
        () => fetchAssessmentAndReportCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentChannel);
      supabase.removeChannel(expertReportsChannel);
    };
  }, [agreements]);

  const getAttorneyName = (attorneyId: string) => {
    return attorneyNames[attorneyId] || "Unknown Referring Attorney";
  };

  // Deduplicate agreements: keep only one per attorney per month
  const deduplicatedAgreements = agreements.reduce((acc, agreement) => {
    const startDate = agreement.contract_start_date ? new Date(agreement.contract_start_date) : null;
    const monthKey = startDate 
      ? `${agreement.referring_attorney_id}_${startDate.getFullYear()}_${startDate.getMonth()}`
      : `${agreement.referring_attorney_id}_unknown`;
    
    if (!acc.has(monthKey)) {
      acc.set(monthKey, agreement);
    } else {
      // Keep the most recent one
      const existing = acc.get(monthKey);
      if (agreement.updated_at > existing.updated_at) {
        acc.set(monthKey, agreement);
      }
    }
    
    return acc;
  }, new Map());

  const uniqueAgreements = Array.from(deduplicatedAgreements.values());

  const handleGeneratePdf = async (agreementId: string) => {
    setGeneratingPdf(agreementId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-short-term-agreement-pdf', {
        body: { agreementId }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("PDF generated successfully");
      } else {
        throw new Error(data.error || "Failed to generate PDF");
      }
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast.error(error.message || "Failed to generate PDF");
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleSendEmail = async (agreementId: string) => {
    setSendingEmail(agreementId);
    try {
      const { data, error } = await supabase.functions.invoke('send-short-term-agreement-email', {
        body: { agreementId }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Agreement email sent to ${data.recipientEmail}`);
      } else {
        throw new Error(data.error || "Failed to send email");
      }
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Failed to send email");
    } finally {
      setSendingEmail(null);
    }
  };

  const handleDownload = async (documentUrl: string, fileName: string) => {
    try {
      const link = document.createElement('a');
      link.href = documentUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download started");
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file");
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAgreements(agreements.map(a => a.id));
    } else {
      setSelectedAgreements([]);
    }
  };

  const handleSelectAgreement = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedAgreements(prev => [...prev, id]);
    } else {
      setSelectedAgreements(prev => prev.filter(aid => aid !== id));
    }
  };

  const handleClearSelectedData = async () => {
    if (selectedAgreements.length === 0) {
      toast.error("Please select at least one agreement to delete");
      return;
    }

    const confirmed = confirm(
      `⚠️ WARNING: This will permanently delete ${selectedAgreements.length} selected agreement(s).\n\nThis action CANNOT be undone.\n\nAre you sure you want to proceed?`
    );
    
    if (!confirmed) return;

    try {
      setIsClearing(true);
      
      for (const agreementId of selectedAgreements) {
        await deleteAgreement(agreementId);
      }
      
      toast.success(`Successfully deleted ${selectedAgreements.length} agreement(s)`);
      setSelectedAgreements([]);
      setShowClearDialog(false);
      await refetch();
      triggerSync();
    } catch (error: any) {
      console.error("Error clearing data:", error);
      toast.error("Failed to delete some agreements");
    } finally {
      setIsClearing(false);
    }
  };

  const syncAppointmentsToShortTerm = async (specificAttorneyId?: string) => {
    console.log('🔄 Syncing appointments to short-term agreements', specificAttorneyId ? `for attorney: ${specificAttorneyId}` : 'for all attorneys');
    
    try {
      setIsClearing(true);
      
      // Build query for appointments with payment_terms = 'short-term'
      let appointmentsQuery = supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          case_status,
          service_fee,
          deposit_amount,
          payment_terms,
          referring_attorney_id,
          referring_attorney,
          claimants!inner (
            id,
            auto_id,
            first_name,
            last_name
          ),
          medical_experts (
            first_name,
            last_name,
            expert_type
          )
        `)
        .is('deleted_at', null)
        .eq('payment_terms', 'short-term'); // Only sync short-term payment appointments

      // Filter by specific attorney if provided
      if (specificAttorneyId) {
        appointmentsQuery = appointmentsQuery.eq('referring_attorney_id', specificAttorneyId);
      }

      const { data: appointments, error: appointmentsError } = await appointmentsQuery;

      if (appointmentsError) {
        console.error('Error fetching appointments:', appointmentsError);
        toast.error("Failed to fetch appointments");
        return;
      }

      console.log('📊 Raw appointments fetched:', appointments?.length || 0);

      if (!appointments || appointments.length === 0) {
        toast.info("No appointments found to sync");
        return;
      }

      // Get referring attorney details to filter out system companies
      const attorneyIds = [...new Set(appointments.map((a: any) => a.referring_attorney_id))];
      const { data: referringAttorneys, error: attorneyError } = await supabase
        .from('referring_attorneys')
        .select('id, name, is_system_company')
        .in('id', attorneyIds);

      if (attorneyError) {
        console.error('Error fetching attorneys:', attorneyError);
        toast.error("Failed to fetch attorney details");
        return;
      }

      // Filter out system companies
      const filteredAssessments = appointments.filter((apt: any) => {
        const attorney = referringAttorneys?.find((ra: any) => ra.id === apt.referring_attorney_id);
        return !attorney?.is_system_company;
      });

      console.log(`📊 After filtering system companies: ${filteredAssessments.length}`);

      if (filteredAssessments.length === 0) {
        toast.info("No valid appointments found to sync");
        return;
      }

      // Get existing agreements to avoid duplicates
      const { data: existingAgreements } = await supabase
        .from('short_term_agreements')
        .select('id, referring_attorney_id, agreement_reference');

      let syncedCount = 0;
      let skippedCount = 0;

      for (const apt of filteredAssessments) {
        // Extract claimant data from nested object
        const claimant = apt.claimants as any;
        const claimantName = claimant ? `${claimant.first_name} ${claimant.last_name}`.trim() : 'Unknown Claimant';
        const claimantAutoId = claimant?.auto_id || 'Unknown';
        const attorneyRecord = referringAttorneys?.find((ra: any) => ra.id === apt.referring_attorney_id);
        const attorneyName = attorneyRecord?.name || apt.referring_attorney || 'Unknown Attorney';
        
        // Skip if claimant name is empty or unknown
        if (!claimant || !claimant.first_name) {
          console.log('Skipping appointment with no claimant data:', apt.id);
          skippedCount++;
          continue;
        }
        
        // Check if agreement already exists for this claimant and attorney
        const exists = existingAgreements?.some(
          (ea: any) => 
            ea.referring_attorney_id === apt.referring_attorney_id && 
            ea.agreement_reference === claimantName
        );

        if (exists) {
          skippedCount++;
          continue;
        }

        // Create new short-term agreement
        const serviceFee = apt.service_fee || 0;
        const depositAmount = apt.deposit_amount || 0;
        const paymentStatus = depositAmount > 0 && depositAmount >= serviceFee ? 'paid' : 
                              depositAmount > 0 ? 'partial' : 'pending';
        
        const agreementData = {
          referring_attorney_id: apt.referring_attorney_id,
          agreement_method: 'email' as const,
          agreement_reference: claimantName, // Store claimant name here
          contract_description: `Agreement for ${claimantName} at ${attorneyName}`,
          contract_start_date: format(new Date(apt.appointment_date), 'yyyy-MM-dd'),
          contract_end_date: format(addMonths(new Date(apt.appointment_date), 6), 'yyyy-MM-dd'),
          total_contract_value: serviceFee,
          deposit_amount: depositAmount,
          payment_status: paymentStatus as 'pending' | 'partial' | 'paid',
          status: 'active' as const,
          notes: `Auto-synced from ${claimantAutoId} | Attorney: ${attorneyName} | Synced: ${format(new Date(), 'PPP')}`,
        };

        try {
          await createAgreement(agreementData);
          syncedCount++;
        } catch (error) {
          console.error('Error creating agreement for', claimantName, error);
        }
      }

      toast.success(`Sync complete: ${syncedCount} agreements created, ${skippedCount} skipped (duplicates)`);
      await refetch();
      triggerSync();
    } catch (error: any) {
      console.error("Error syncing appointments:", error);
      toast.error("Failed to sync appointments");
    } finally {
      setIsClearing(false);
    }
  };

  const FormFields = () => (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="attorney">Referring Attorney *</Label>
        <Select value={selectedAttorney} onValueChange={setSelectedAttorney}>
          <SelectTrigger>
            <SelectValue placeholder="Select referring attorney" />
          </SelectTrigger>
          <SelectContent>
            {attorneys.map((attorney) => (
              <SelectItem key={attorney.id} value={attorney.id}>
                {attorney.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="agreement_method">Agreement Method *</Label>
        <Select
          value={formData.agreement_method}
          onValueChange={(value: "email" | "telephone" | "both") =>
            setFormData({ ...formData, agreement_method: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="telephone">Telephone</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="agreement_reference">Agreement Reference</Label>
        <Input
          id="agreement_reference"
          value={formData.agreement_reference}
          onChange={(e) => setFormData({ ...formData, agreement_reference: e.target.value })}
          placeholder="e.g., STA-2025-001"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Start Date *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal", !contractStartDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {contractStartDate ? format(contractStartDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={contractStartDate} onSelect={setContractStartDate} initialFocus />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-2">
          <Label>End Date * (Max 12 months)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal", !contractEndDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {contractEndDate ? format(contractEndDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={contractEndDate}
                onSelect={setContractEndDate}
                disabled={(date) => contractStartDate ? date < contractStartDate || date > addMonths(contractStartDate, 12) : false}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="contract_description">Contract Description</Label>
        <Textarea
          id="contract_description"
          value={formData.contract_description}
          onChange={(e) => setFormData({ ...formData, contract_description: e.target.value })}
          placeholder="Describe the agreement terms..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="total_contract_value">Total Contract Value (R)</Label>
          <Input
            id="total_contract_value"
            type="number"
            step="0.01"
            value={formData.total_contract_value}
            onChange={(e) => setFormData({ ...formData, total_contract_value: e.target.value })}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="deposit_amount">Deposit Amount (R)</Label>
          <Input
            id="deposit_amount"
            type="number"
            step="0.01"
            value={formData.deposit_amount}
            onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="payment_plan_structure">Payment Plan Structure</Label>
        <Input
          id="payment_plan_structure"
          value={formData.payment_plan_structure}
          onChange={(e) => setFormData({ ...formData, payment_plan_structure: e.target.value })}
          placeholder="e.g., Monthly, Quarterly, etc."
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="interest_rate_1_3">Interest 1-3 Months (%)</Label>
          <Input
            id="interest_rate_1_3"
            type="number"
            step="0.01"
            value={formData.interest_rate_1_3_months}
            onChange={(e) => setFormData({ ...formData, interest_rate_1_3_months: e.target.value })}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="interest_rate_6">Interest 6 Months (%)</Label>
          <Input
            id="interest_rate_6"
            type="number"
            step="0.01"
            value={formData.interest_rate_6_months}
            onChange={(e) => setFormData({ ...formData, interest_rate_6_months: e.target.value })}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="interest_rate_12">Interest 12 Months (%)</Label>
          <Input
            id="interest_rate_12"
            type="number"
            step="0.01"
            value={formData.interest_rate_12_months}
            onChange={(e) => setFormData({ ...formData, interest_rate_12_months: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="total_reports">Total Reports Agreed</Label>
        <Input
          id="total_reports"
          type="number"
          value={formData.total_reports_agreed}
          onChange={(e) => setFormData({ ...formData, total_reports_agreed: e.target.value })}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="payment_status">Payment Status</Label>
        <Select
          value={formData.payment_status}
          onValueChange={(value: any) => setFormData({ ...formData, payment_status: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes..."
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="document">Attach Agreement Document</Label>
        <div className="flex items-center gap-2">
          <Input
            id="document"
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="cursor-pointer"
          />
          {selectedFile && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Upload className="h-3 w-3" />
              {selectedFile.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <div className="text-center py-8">Loading agreements...</div>;
  }

  return (
    <div className="w-full space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Short-Term Agreements
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage agreements concluded via email/phone (max 12 months)
        </p>
      </div>
      
      <div className="flex gap-2 justify-between items-center">
        <div className="flex gap-2">
          {(isAdmin() || isEmployee()) && (
            <Button 
              onClick={() => syncAppointmentsToShortTerm(lawFirmId)}
              disabled={isClearing}
              variant="secondary"
            >
              {isClearing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <FileCheck className="mr-2 h-4 w-4" />
                  Sync Appointments
                </>
              )}
            </Button>
          )}
          <Button onClick={() => { resetForm(); setIsQuickCreateOpen(true); }}>
            <FileCheck className="mr-2 h-4 w-4" />
            Quick Create & Send
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                New Agreement
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Short-Term Agreement</DialogTitle>
            </DialogHeader>
            <FormFields />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isUploading}>
                {isUploading ? "Creating..." : "Create Agreement"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>

        {(isAdmin() || isEmployee()) && agreements.length > 0 && (
          <Button 
            variant="destructive" 
            onClick={() => setShowClearDialog(true)}
            disabled={isClearing}
          >
            {isClearing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Clearing...
              </>
            ) : (
              <>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Clear Data
              </>
            )}
          </Button>
        )}
      </div>

      {agreements.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No short-term agreements yet</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Referring Attorney</TableHead>
                <TableHead className="min-w-[130px]">Period</TableHead>
                <TableHead className="min-w-[100px] text-center">Assessments</TableHead>
                <TableHead className="min-w-[120px] text-center">Reports</TableHead>
                <TableHead className="min-w-[150px]">Contract Value</TableHead>
                <TableHead className="min-w-[100px]">Paid</TableHead>
                <TableHead className="min-w-[120px]">Outstanding</TableHead>
                <TableHead className="min-w-[100px]">Status</TableHead>
                <TableHead className="min-w-[250px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {uniqueAgreements.map((agreement) => {
              const outstandingDebt = (agreement.total_contract_value || 0) - (agreement.deposit_amount || 0);
              const attorneyName = getAttorneyName(agreement.referring_attorney_id);
              
              // Skip if attorney name is not found (system company)
              if (!attorneyName || attorneyName === "Unknown Referring Attorney") {
                return null;
              }
              
              return (
              <TableRow key={agreement.id} className="hover:bg-muted/50">
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">
                        {attorneyName}
                      </div>
                      {onSyncAttorney && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onSyncAttorney(agreement.referring_attorney_id)}
                          disabled={isSyncing}
                          title={`Sync appointments for ${attorneyName}`}
                          className="h-6 px-2 text-xs"
                        >
                          <FileCheck className="h-3 w-3 mr-1" />
                          Sync
                        </Button>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">
                    {format(new Date(agreement.contract_start_date), "MMMM yyyy")}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className="inline-flex items-center justify-center min-w-[28px] h-7 bg-blue-500 text-white font-bold rounded-full text-sm">
                      {assessmentCounts[agreement.id] || 0}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Assessment{(assessmentCounts[agreement.id] || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex gap-1">
                      <span className="inline-flex items-center justify-center min-w-[24px] h-6 bg-green-500 text-white font-bold rounded-full text-xs" title="Completed">
                        {reportCounts[agreement.id]?.completed || 0}
                      </span>
                      {(reportCounts[agreement.id]?.pending || 0) > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[24px] h-6 bg-yellow-500 text-white font-bold rounded-full text-xs" title="Pending">
                          {reportCounts[agreement.id]?.pending || 0}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      of {reportCounts[agreement.id]?.total || 0} report{(reportCounts[agreement.id]?.total || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">
                    R{(agreement.total_contract_value || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-muted-foreground">
                    R{(agreement.deposit_amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </TableCell>
                <TableCell>
                  <div className={`text-sm font-bold ${outstandingDebt > 0 ? 'text-destructive' : 'text-green-600'}`}>
                    R{outstandingDebt.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </TableCell>
                <TableCell>
                  <span className={cn("px-2 py-1 rounded text-xs font-medium",
                    agreement.payment_status === "paid" && "bg-green-100 text-green-800",
                    agreement.payment_status === "partial" && "bg-blue-100 text-blue-800",
                    agreement.payment_status === "pending" && "bg-yellow-100 text-yellow-800",
                    agreement.payment_status === "overdue" && "bg-red-100 text-red-800"
                  )}>
                    {agreement.payment_status}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleOpenCapturePayment(agreement)}
                      title="Capture Payment"
                      className="gap-1"
                    >
                      <DollarSign className="h-3 w-3" />
                      Pay
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGeneratePdf(agreement.id)}
                      disabled={generatingPdf === agreement.id}
                      title="Generate PDF"
                    >
                      {generatingPdf === agreement.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendEmail(agreement.id)}
                      disabled={sendingEmail === agreement.id}
                      title="Send Email"
                    >
                      {sendingEmail === agreement.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                    </Button>
                    {agreement.document_url && agreement.file_name && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDownload(agreement.document_url!, agreement.file_name!)}
                        title="Download document"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleEdit(agreement)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(agreement.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Short-Term Agreement</DialogTitle>
          </DialogHeader>
          <FormFields />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isUploading}>
              {isUploading ? "Updating..." : "Update Agreement"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Create & Send Dialog */}
      <ShortTermAgreementDialog
        open={isQuickCreateOpen}
        onOpenChange={setIsQuickCreateOpen}
        referringAttorneyId={lawFirmId}
        referringAttorneyName={attorneys.find(a => a.id === lawFirmId)?.name}
        referringAttorneyEmail={attorneys.find(a => a.id === lawFirmId)?.law_firm || undefined}
      />

      {/* Clear Data Selection Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Agreements to Delete</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2 pb-4 border-b">
              <Checkbox
                id="select-all"
                checked={selectedAgreements.length === agreements.length && agreements.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Select All ({agreements.length} agreements)
              </label>
            </div>

            <div className="space-y-2">
              {agreements.map((agreement) => (
                <div key={agreement.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                  <Checkbox
                    id={agreement.id}
                    checked={selectedAgreements.includes(agreement.id)}
                    onCheckedChange={(checked) => handleSelectAgreement(agreement.id, checked as boolean)}
                  />
                  <label htmlFor={agreement.id} className="flex-1 cursor-pointer">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{agreement.agreement_reference || 'No Reference'}</p>
                        <p className="text-sm text-muted-foreground">
                          {agreement.contract_start_date} - {agreement.contract_end_date}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">R{agreement.total_contract_value?.toLocaleString() || '0'}</p>
                      </div>
                    </div>
                  </label>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {selectedAgreements.length} of {agreements.length} selected
              </p>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowClearDialog(false);
                    setSelectedAgreements([]);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleClearSelectedData}
                  disabled={selectedAgreements.length === 0 || isClearing}
                >
                  {isClearing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Selected ({selectedAgreements.length})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Capture Payment Dialog */}
      <Dialog open={!!paymentAgreementId} onOpenChange={(open) => !open && setPaymentAgreementId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Capture Payment
            </DialogTitle>
          </DialogHeader>

          {/* Linked Assessments Summary */}
          {captureAssessments.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Linked Assessments ({captureAssessments.length})</Label>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">
                  {captureAssessments.filter(a => a.paymentStatus === 'full_payment').length} Fully Paid
                </Badge>
                <Badge variant="secondary">
                  {captureAssessments.filter(a => a.reportStatus === 'taken_out').length} Reports Taken Out
                </Badge>
                <Badge variant="destructive">
                  {captureAssessments.filter(a => a.paymentStatus === 'pending' || a.paymentStatus === 'deposit').length} Pending Payment
                </Badge>
              </div>
              <div className="rounded-md border overflow-auto max-h-[200px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Claimant</TableHead>
                      <TableHead className="text-xs text-right">Fee</TableHead>
                      <TableHead className="text-xs text-right">Paid</TableHead>
                      <TableHead className="text-xs text-right">Balance</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Report</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {captureAssessments.filter(a => a.paymentTerms === 'short-term' || !a.paymentTerms).map((apt: any) => (
                      <TableRow key={apt.id} className="text-xs">
                        <TableCell>{format(new Date(apt.appointmentDate), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="font-medium">{apt.claimantName}</TableCell>
                        <TableCell className="text-right">R{apt.serviceFee.toLocaleString()}</TableCell>
                        <TableCell className="text-right">R{apt.depositAmount.toLocaleString()}</TableCell>
                        <TableCell className={`text-right font-semibold ${Math.max(0, apt.balance) > 0 ? 'text-destructive' : 'text-green-600'}`}>
                          R{Math.max(0, apt.balance).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={apt.paymentStatus === 'full_payment' ? 'default' : 'outline'} className="text-[10px]">
                            {apt.paymentStatus === 'full_payment' ? 'Paid' : apt.paymentStatus === 'deposit' ? 'Deposit' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={apt.reportStatus === 'taken_out' ? 'default' : 'outline'} className="text-[10px]">
                            {apt.reportStatus.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payment Amount (R) *</Label>
              <Input
                type="number"
                step="0.01"
                value={capturePaymentAmount}
                onChange={(e) => setCapturePaymentAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Type *</Label>
              <Select value={capturePaymentType} onValueChange={(v: any) => setCapturePaymentType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="regular">Regular Payment</SelectItem>
                  <SelectItem value="final">Final Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reports Taken Out {capturePaymentType !== 'deposit' && <span className="text-destructive">*</span>}</Label>
              <Input
                type="number"
                value={captureReportsTaken}
                onChange={(e) => setCaptureReportsTaken(e.target.value)}
                placeholder={capturePaymentType === 'deposit' ? 'N/A for deposits' : 'Required'}
                disabled={capturePaymentType === 'deposit'}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Date *</Label>
              <Input
                type="date"
                value={capturePaymentDate}
                onChange={(e) => setCapturePaymentDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              value={capturePaymentNotes}
              onChange={(e) => setCapturePaymentNotes(e.target.value)}
              placeholder="Payment notes..."
              rows={2}
            />
          </div>

          {capturePaymentType !== 'deposit' && (
            <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground">
              <strong>How it works:</strong> Payment will be allocated to the oldest pending assessments. The specified number of reports will be marked as "Taken Out" and payment dates will update across assessments, AOD, and this agreement.
            </div>
          )}
          {capturePaymentType === 'deposit' && (
            <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground">
              <strong>Deposit:</strong> Will be allocated to the oldest unpaid assessment and update the deposit amount on the scheduled assessment.
            </div>
          )}

          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setPaymentAgreementId(null)}>Cancel</Button>
            <Button onClick={handleCapturePayment} disabled={capturingPayment}>
              {capturingPayment ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
              ) : (
                <><DollarSign className="h-4 w-4 mr-2" /> Capture Payment</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
