// src/components/admin/ExpertCreditControlContent.tsx
//
// The actual Credit Control experience — data, dialogs and all. Rendered
// both by the standalone /expert-credit-control route (wrapped in its own
// page chrome) and by the Expert Network "Credit Control" tab (embedded
// directly, no page chrome). This file owns none of that chrome itself, so
// it never fights a parent header/nav/footer or forces its own viewport
// height inside a tab — the overlap and oversized-card issues that came
// from reusing the full routed page via CSS hacks.
//
// Every panel here is a docked sliding sheet (side="right"), matching the
// rest of the Admin Portal — never a centered pop-up.
import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Mail, Clock, Search, Download, Edit, Trash2, Paperclip, Eye, FileText, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ExpertStatementPreviewDialog } from "@/components/ExpertStatementPreviewDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { Pencil, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { RandSign } from "@/components/icons/RandSign";
import {
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminEmptyState,
  AdminSearchInput,
  AdminPill,
  AdminLoadingState,
  BRAND_TEAL,
} from "@/components/admin/ui/AdminUI";

interface FeeHistoryEntry {
  id: string;
  fee_field: string;
  old_value: number | null;
  new_value: number;
  changed_by_name: string | null;
  source: string;
  created_at: string;
}

interface ExpertPaymentData {
  expert_id: string;
  expert_name: string;
  expert_email: string;
  expert_type: string;
  consultation_fees: number;
  court_fees: number;
  appointments: {
    appointment_id: string;
    appointment_date: string;
    claimant_name: string;
    consultation_fee: number;
    court_fee_used: boolean;
    court_fee_amount: number;
    total_due: number;
    deposit_paid: number;
    balance_due: number;
    payment_status: string;
    last_payment_date?: string;
    payment_updated_at?: string;
    payment_history: {
      id: string;
      amount: number;
      date: string;
      recorded_by: string;
      notes?: string;
      pop_url?: string;
      pop_file_name?: string;
    }[];
  }[];
  total_owed: number;
  total_deposit: number;
  total_balance: number;
}

const STATUS_TONE: Record<string, "success" | "warning" | "destructive"> = {
  paid: "success",
  pending: "warning",
  overdue: "destructive",
};

export const ExpertCreditControlContent: React.FC = () => {
  const [expertsData, setExpertsData] = useState<ExpertPaymentData[]>([]);
  const [filteredExperts, setFilteredExperts] = useState<ExpertPaymentData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [selectedExpertId, setSelectedExpertId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [selectedExpertForEmail, setSelectedExpertForEmail] = useState<ExpertPaymentData | null>(null);
  const [expandedAppointment, setExpandedAppointment] = useState<string | null>(null);
  const [popFile, setPopFile] = useState<File | null>(null);
  const [existingPopUrl, setExistingPopUrl] = useState<string | null>(null);
  const [existingPopFileName, setExistingPopFileName] = useState<string | null>(null);
  const [uploadingPop, setUploadingPop] = useState(false);
  const { isAdmin } = usePermissions();
  const { user } = useAuth();
  const [feeEditExpert, setFeeEditExpert] = useState<ExpertPaymentData | null>(null);
  const [feeConsultation, setFeeConsultation] = useState("");
  const [feeCourt, setFeeCourt] = useState("");
  const [savingFees, setSavingFees] = useState(false);
  const [feeHistory, setFeeHistory] = useState<FeeHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadFeeHistory = async (expertId: string) => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("expert_fee_change_history" as any)
        .select("id, fee_field, old_value, new_value, changed_by_name, source, created_at")
        .eq("expert_id", expertId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setFeeHistory((data as any) || []);
    } catch (e: any) {
      setFeeHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openFeeEditor = (expert: ExpertPaymentData) => {
    setFeeEditExpert(expert);
    setFeeConsultation(String(expert.consultation_fees ?? 0));
    setFeeCourt(String(expert.court_fees ?? 0));
    loadFeeHistory(expert.expert_id);
  };

  const handleSaveFees = async () => {
    if (!feeEditExpert) return;
    const c = Number(feeConsultation);
    const k = Number(feeCourt);
    if (Number.isNaN(c) || c < 0 || Number.isNaN(k) || k < 0) {
      toast.error("Enter valid non-negative fee amounts.");
      return;
    }
    setSavingFees(true);
    try {
      const oldC = Number(feeEditExpert.consultation_fees) || 0;
      const oldK = Number(feeEditExpert.court_fees) || 0;
      const { error } = await supabase
        .from("medical_experts")
        .update({ consultation_fees: c, court_fees: k })
        .eq("id", feeEditExpert.expert_id);
      if (error) throw error;

      const changedByName =
        (user?.user_metadata?.full_name as string | undefined) ||
        user?.email ||
        null;
      const entries: any[] = [];
      if (c !== oldC) {
        entries.push({
          expert_id: feeEditExpert.expert_id,
          fee_field: "consultation_fees",
          old_value: oldC,
          new_value: c,
          changed_by: user?.id ?? null,
          changed_by_name: changedByName,
          source: "credit_control",
        });
      }
      if (k !== oldK) {
        entries.push({
          expert_id: feeEditExpert.expert_id,
          fee_field: "court_fees",
          old_value: oldK,
          new_value: k,
          changed_by: user?.id ?? null,
          changed_by_name: changedByName,
          source: "credit_control",
        });
      }
      if (entries.length) {
        await supabase.from("expert_fee_change_history" as any).insert(entries);
      }

      toast.success("Expert fees updated. Directory synced.");
      window.dispatchEvent(new Event("medical-expert-updated"));
      await loadFeeHistory(feeEditExpert.expert_id);
      await fetchExpertPaymentData();
      setFeeEditExpert(null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to update fees.");
    } finally {
      setSavingFees(false);
    }
  };

  useEffect(() => {
    fetchExpertPaymentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    const handler = () => fetchExpertPaymentData();
    window.addEventListener('medical-expert-updated', handler);
    return () => window.removeEventListener('medical-expert-updated', handler);
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredExperts(expertsData);
    } else {
      const filtered = expertsData.filter(expert =>
        expert.expert_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredExperts(filtered);
    }
  }, [searchQuery, expertsData]);

  const fetchExpertPaymentData = async () => {
    try {
      setLoading(true);

      const { data: appointments, error: appointmentsError } = await supabase
        .from("appointments")
        .select(`
          id,
          expert_id,
          claimant_id,
          payment_status,
          payment_date,
          appointment_date,
          matter_type,
          deposit_amount,
          updated_at
        `);

      if (appointmentsError) throw appointmentsError;

      const { data: experts, error: expertsError } = await supabase
        .rpc('get_medical_experts_secure');

      if (expertsError) throw expertsError;

      const { data: claimants, error: claimantsError } = await supabase
        .from("claimants")
        .select("id, first_name, last_name");

      if (claimantsError) throw claimantsError;

      const { data: expertPayments, error: paymentsError } = await supabase
        .from("expert_payments")
        .select("*")
        .order("payment_date", { ascending: false });

      if (paymentsError) throw paymentsError;

      const expertMap = new Map<string, ExpertPaymentData>();

      const expertAppointmentCounts = new Map<string, number>();
      appointments?.forEach((apt: any) => {
        const count = expertAppointmentCounts.get(apt.expert_id) || 0;
        expertAppointmentCounts.set(apt.expert_id, count + 1);
      });

      experts?.forEach((expert: any) => {
        const hasAppointments = (expertAppointmentCounts.get(expert.id) || 0) > 0;
        const shouldInclude =
          statusFilter === 'all' ||
          (statusFilter === 'active' && hasAppointments) ||
          (statusFilter === 'inactive' && !hasAppointments);

        if (shouldInclude) {
          const consultationFee = Number(expert.consultation_fees) || 0;
          const courtFeeAmount = Number(expert.court_fees) || 0;

          expertMap.set(expert.id, {
            expert_id: expert.id,
            expert_name: `${expert.first_name} ${expert.last_name}`,
            expert_email: expert.email_masked || '',
            expert_type: expert.expert_type,
            consultation_fees: consultationFee,
            court_fees: courtFeeAmount,
            appointments: [],
            total_owed: 0,
            total_deposit: 0,
            total_balance: 0,
          });
        }
      });

      appointments?.forEach((appointment) => {
        const expert = experts?.find((e: any) => e.id === appointment.expert_id);
        const claimant = claimants?.find((c) => c.id === appointment.claimant_id);

        if (!expert) return;

        const expertKey = appointment.expert_id;

        const consultationFee = Number(expert.consultation_fees) || 0;
        const courtFeeAmount = Number(expert.court_fees) || 0;

        const courtFeeUsed = appointment.matter_type?.toLowerCase().includes('court') || false;

        const totalDue = consultationFee + (courtFeeUsed ? courtFeeAmount : 0);

        const appointmentPayments = expertPayments?.filter((p: any) => p.appointment_id === appointment.id) || [];
        const depositPaid = appointmentPayments.reduce((sum: number, p: any) => sum + Number(p.payment_amount), 0);
        const balanceDue = Math.max(0, totalDue - depositPaid);

        const paymentHistory = appointmentPayments.map((p: any) => ({
          id: p.id,
          amount: Number(p.payment_amount),
          date: p.payment_date,
          recorded_by: p.recorded_by,
          notes: p.payment_notes,
          pop_url: p.pop_url,
          pop_file_name: p.pop_file_name
        }));

        if (!expertMap.has(expertKey)) {
          expertMap.set(expertKey, {
            expert_id: appointment.expert_id,
            expert_name: `${expert.first_name} ${expert.last_name}`,
            expert_email: expert.email_masked || '',
            expert_type: expert.expert_type,
            consultation_fees: consultationFee,
            court_fees: courtFeeAmount,
            appointments: [],
            total_owed: 0,
            total_deposit: 0,
            total_balance: 0,
          });
        }

        const expertData = expertMap.get(expertKey)!;
        expertData.appointments.push({
          appointment_id: appointment.id,
          appointment_date: appointment.appointment_date,
          claimant_name: claimant ? `${claimant.first_name} ${claimant.last_name}` : 'Unknown',
          consultation_fee: consultationFee,
          court_fee_used: courtFeeUsed,
          court_fee_amount: courtFeeUsed ? courtFeeAmount : 0,
          total_due: totalDue,
          deposit_paid: depositPaid,
          balance_due: balanceDue,
          payment_status: depositPaid >= totalDue ? 'paid' : 'pending',
          last_payment_date: appointmentPayments[0]?.payment_date || null,
          payment_updated_at: appointmentPayments[0]?.created_at || null,
          payment_history: paymentHistory,
        });

        expertData.total_owed += totalDue;
        expertData.total_deposit += depositPaid;
        expertData.total_balance += balanceDue;
      });

      const sortedExperts = Array.from(expertMap.values()).sort((a, b) =>
        a.expert_name.localeCompare(b.expert_name)
      );

      setExpertsData(sortedExperts);
    } catch (error: any) {
      console.error("Error fetching expert payment data:", error);
      toast.error("Failed to load expert payment data");
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedAppointmentId || !selectedExpertId || !paymentAmount) {
      toast.error("Please enter payment amount");
      return;
    }

    try {
      const amount = parseFloat(paymentAmount);

      if (isNaN(amount) || amount <= 0) {
        toast.error("Invalid payment amount");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User not authenticated");
        return;
      }

      let popUrl = existingPopUrl;
      let popFileName = existingPopFileName;

      if (popFile) {
        setUploadingPop(true);
        const fileExt = popFile.name.split('.').pop();
        const fileName = `${selectedExpertId}/${selectedAppointmentId}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('expert-pop-documents')
          .upload(fileName, popFile);

        if (uploadError) {
          setUploadingPop(false);
          throw new Error(`Failed to upload POP: ${uploadError.message}`);
        }

        popUrl = uploadData.path;
        popFileName = popFile.name;
        setUploadingPop(false);
      }

      if (editingPaymentId) {
        const { error: updateError } = await supabase
          .from("expert_payments")
          .update({
            payment_amount: amount,
            payment_date: paymentDate || new Date().toISOString(),
            payment_notes: paymentNotes || null,
            pop_url: popUrl,
            pop_file_name: popFileName,
          })
          .eq('id', editingPaymentId);

        if (updateError) throw updateError;

        await supabase.rpc('log_audit_trail', {
          p_table_name: 'expert_payments',
          p_record_id: editingPaymentId,
          p_action_type: 'UPDATE',
          p_function_area: 'expert_payment',
          p_new_values: {
            payment_amount: amount,
            payment_date: paymentDate || new Date().toISOString(),
            payment_notes: paymentNotes,
            pop_file_name: popFileName,
          },
          p_description: `Payment updated to R${amount} for expert ${selectedExpertId}`,
        });

        toast.success("Payment updated successfully");
      } else {
        const { error: insertError } = await supabase
          .from("expert_payments")
          .insert({
            appointment_id: selectedAppointmentId,
            expert_id: selectedExpertId,
            payment_amount: amount,
            payment_date: paymentDate || new Date().toISOString(),
            payment_notes: paymentNotes || null,
            recorded_by: user.id,
            pop_url: popUrl,
            pop_file_name: popFileName,
          });

        if (insertError) throw insertError;

        await supabase.rpc('log_audit_trail', {
          p_table_name: 'expert_payments',
          p_record_id: selectedAppointmentId,
          p_action_type: 'INSERT',
          p_function_area: 'expert_payment',
          p_new_values: {
            payment_amount: amount,
            payment_date: paymentDate || new Date().toISOString(),
            payment_notes: paymentNotes,
            pop_file_name: popFileName,
          },
          p_description: `Payment of R${amount} recorded for expert ${selectedExpertId}`,
        });

        toast.success("Payment recorded successfully");
      }

      setShowPaymentDialog(false);
      setPaymentAmount("");
      setPaymentNotes("");
      setPaymentDate("");
      setSelectedAppointmentId(null);
      setSelectedExpertId(null);
      setEditingPaymentId(null);
      setPopFile(null);
      setExistingPopUrl(null);
      setExistingPopFileName(null);
      fetchExpertPaymentData();
    } catch (error: any) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment: " + error.message);
    }
  };

  const handleEditPayment = (payment: any, appointmentId: string, expertId: string) => {
    setEditingPaymentId(payment.id);
    setSelectedAppointmentId(appointmentId);
    setSelectedExpertId(expertId);
    setPaymentAmount(payment.amount.toString());
    setPaymentDate(payment.date);
    setPaymentNotes(payment.notes || "");
    setExistingPopUrl(payment.pop_url || null);
    setExistingPopFileName(payment.pop_file_name || null);
    setPopFile(null);
    setShowPaymentDialog(true);
  };

  const handleViewPop = async (popUrl: string, popFileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('expert-pop-documents')
        .createSignedUrl(popUrl, 604800);

      if (error) throw error;

      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      console.error("Error viewing POP:", error);
      toast.error("Failed to view proof of payment");
    }
  };

  const handleDownloadPop = async (popUrl: string, popFileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('expert-pop-documents')
        .download(popUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = popFileName || 'proof-of-payment';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error downloading POP:", error);
      toast.error("Failed to download proof of payment");
    }
  };

  const handleDeletePayment = async (paymentId: string, expertId: string) => {
    if (!confirm("Are you sure you want to delete this payment record? This action cannot be undone.")) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from("expert_payments")
        .delete()
        .eq('id', paymentId);

      if (deleteError) throw deleteError;

      await supabase.rpc('log_audit_trail', {
        p_table_name: 'expert_payments',
        p_record_id: paymentId,
        p_action_type: 'DELETE',
        p_function_area: 'expert_payment',
        p_description: `Payment record deleted for expert ${expertId}`,
      });

      toast.success("Payment deleted successfully");
      fetchExpertPaymentData();
    } catch (error: any) {
      console.error("Error deleting payment:", error);
      toast.error("Failed to delete payment: " + error.message);
    }
  };

  const handleDownloadPDF = (expertData: ExpertPaymentData) => {
    try {
      const doc = new jsPDF();

      doc.setFontSize(20);
      doc.text('Expert Payment Statement', 14, 20);

      doc.setFontSize(12);
      doc.text('Expert: ' + expertData.expert_name, 14, 30);
      doc.text('Expert Type: ' + expertData.expert_type, 14, 37);
      doc.text('Statement Date: ' + format(new Date(), 'dd MMM yyyy'), 14, 44);

      doc.setFontSize(10);
      doc.text('Summary', 14, 55);
      doc.text('Total Owed: R ' + expertData.total_owed.toLocaleString('en-ZA', { minimumFractionDigits: 2 }), 14, 62);
      doc.text('Deposit Received: R ' + expertData.total_deposit.toLocaleString('en-ZA', { minimumFractionDigits: 2 }), 14, 69);
      doc.text('Balance Due: R ' + expertData.total_balance.toLocaleString('en-ZA', { minimumFractionDigits: 2 }), 14, 76);

      const tableData = expertData.appointments.map((appointment) => [
        format(new Date(appointment.appointment_date), 'dd MMM yyyy'),
        appointment.claimant_name,
        'R ' + appointment.consultation_fee.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
        appointment.court_fee_used ? 'R ' + appointment.court_fee_amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 }) : '—',
        'R ' + appointment.total_due.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
        'R ' + appointment.deposit_paid.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
        'R ' + appointment.balance_due.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
        appointment.payment_status,
        appointment.payment_updated_at ? format(new Date(appointment.payment_updated_at), 'dd MMM yyyy HH:mm') : '—',
      ]);

      autoTable(doc, {
        startY: 83,
        head: [['Date', 'Claimant', 'Consultation', 'Court Fee', 'Total Due', 'Deposit', 'Balance', 'Status', 'Updated']],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 28 },
          2: { cellWidth: 22 },
          3: { cellWidth: 20 },
          4: { cellWidth: 22 },
          5: { cellWidth: 20 },
          6: { cellWidth: 20 },
          7: { cellWidth: 20 },
          8: { cellWidth: 26 },
        },
      });

      const fileName = 'Expert_Statement_' + expertData.expert_name.replace(/\s+/g, '_') + '_' + format(new Date(), 'yyyyMMdd') + '.pdf';
      doc.save(fileName);

      toast.success('PDF statement downloaded successfully');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF statement');
    }
  };

  const handleSendStatement = async (toEmail: string, ccEmails: string, subject: string, message: string, pdfBase64: string, additionalAttachments?: { name: string; size: number; type: string; base64: string }[]) => {
    if (!selectedExpertForEmail) return;

    try {
      setSendingEmail(true);

      const { error } = await supabase.functions.invoke('send-expert-statement', {
        body: {
          expertId: selectedExpertForEmail.expert_id,
          expertName: selectedExpertForEmail.expert_name,
          toEmail: toEmail,
          ccEmails: ccEmails,
          subject: subject,
          message: message,
          pdfBase64: pdfBase64,
          additionalAttachments: additionalAttachments || [],
          appointments: selectedExpertForEmail.appointments,
          totalOwed: selectedExpertForEmail.total_owed,
          totalDeposit: selectedExpertForEmail.total_deposit,
          totalBalance: selectedExpertForEmail.total_balance,
        },
      });

      if (error) throw error;

      const attachCount = 1 + (additionalAttachments?.length || 0);
      toast.success('Statement sent to ' + selectedExpertForEmail.expert_name + ' with ' + attachCount + ' attachment(s)');
    } catch (error: any) {
      console.error("Error sending statement:", error);
      toast.error("Failed to send statement email: " + error.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleOpenEmailPreview = (expertData: ExpertPaymentData) => {
    setSelectedExpertForEmail(expertData);
    setShowEmailPreview(true);
  };

  const getPaymentStatusPill = (status: string) => (
    <AdminPill tone={STATUS_TONE[status] || "neutral"}>{status}</AdminPill>
  );

  if (loading) {
    return <AdminLoadingState label="Loading expert payment data…" />;
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <AdminSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search expert by name…"
          className="w-full sm:max-w-xs"
        />
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 shrink-0 text-slate-400" />
          <Select value={statusFilter} onValueChange={(value: "active" | "inactive" | "all") => setStatusFilter(value)}>
            <SelectTrigger className="w-full min-w-[180px] rounded-none border-black/15 sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">With Appointments</SelectItem>
              <SelectItem value="inactive">Without Appointments</SelectItem>
              <SelectItem value="all">All Experts</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredExperts.length === 0 ? (
          <AdminCard>
            <AdminEmptyState
              icon={Search}
              title={searchQuery ? `No experts found matching "${searchQuery}"` : 'No expert payment data available'}
            />
          </AdminCard>
        ) : (
          filteredExperts.map((expert) => (
            <AdminCard key={expert.expert_id} className="overflow-hidden">
              <AdminCardHeader
                title={expert.expert_name}
                description={expert.expert_type}
                actions={
                  <>
                    <Button
                      onClick={() => handleDownloadPDF(expert)}
                      size="sm"
                      variant="outline"
                      className="rounded-none border-black/15"
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      PDF
                    </Button>
                    <Button
                      onClick={() => handleOpenEmailPreview(expert)}
                      disabled={sendingEmail}
                      size="sm"
                      className="rounded-none"
                    >
                      <Mail className="h-3.5 w-3.5 mr-1.5" />
                      Send Statement
                    </Button>
                  </>
                }
              />

              <AdminCardBody className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="relative border border-black/10 bg-black/[0.02] p-3">
                    <p className="text-[11px] text-slate-500">Consultation Fee</p>
                    <p className="text-sm font-semibold text-black">
                      R {expert.consultation_fees.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </p>
                    {isAdmin() && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 rounded-none"
                        onClick={() => openFeeEditor(expert)}
                        title="Edit fees (syncs to directory)"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="relative border border-black/10 bg-black/[0.02] p-3">
                    <p className="text-[11px] text-slate-500">Court Fee (if applicable)</p>
                    <p className="text-sm font-semibold text-black">
                      R {expert.court_fees.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </p>
                    {isAdmin() && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 rounded-none"
                        onClick={() => openFeeEditor(expert)}
                        title="Edit fees (syncs to directory)"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="border border-black/10 bg-black/[0.02] p-3">
                    <p className="text-[11px] text-slate-500">Total Owed to Expert</p>
                    <p className="text-lg font-bold text-black">
                      R {expert.total_owed.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="border border-black/10 bg-black/[0.02] p-3">
                    <p className="text-[11px] text-slate-500">Deposit Received</p>
                    <p className="text-lg font-bold" style={{ color: BRAND_TEAL }}>
                      R {expert.total_deposit.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="border border-black/10 bg-black/[0.02] p-3">
                    <p className="text-[11px] text-slate-500">Balance Due</p>
                    <p className="text-lg font-bold text-destructive">
                      R {expert.total_balance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Table scrolls horizontally on narrow viewports instead of
                    forcing the whole card wide and overlapping the page. */}
                <div className="-mx-4 overflow-x-auto border-t border-black/10 sm:mx-0 sm:border sm:border-black/10">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Date</TableHead>
                        <TableHead className="whitespace-nowrap">Claimant</TableHead>
                        <TableHead className="whitespace-nowrap">Consultation Fee</TableHead>
                        <TableHead className="whitespace-nowrap">Court Fee</TableHead>
                        <TableHead className="whitespace-nowrap">Total Due</TableHead>
                        <TableHead className="whitespace-nowrap">Deposit</TableHead>
                        <TableHead className="whitespace-nowrap">Balance</TableHead>
                        <TableHead className="whitespace-nowrap">Status</TableHead>
                        <TableHead className="whitespace-nowrap">Last Update</TableHead>
                        <TableHead className="whitespace-nowrap">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expert.appointments.map((appointment) => (
                        <React.Fragment key={appointment.appointment_id}>
                          <TableRow>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(appointment.appointment_date), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{appointment.claimant_name}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              R {appointment.consultation_fee.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {appointment.court_fee_used ? (
                                <span className="text-black">
                                  R {appointment.court_fee_amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-semibold">
                              R {appointment.total_due.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="font-medium" style={{ color: BRAND_TEAL }}>
                                  R {appointment.deposit_paid.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                                </span>
                                {appointment.deposit_paid > 0 && appointment.payment_updated_at && (
                                  <span className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(appointment.payment_updated_at), 'dd/MM/yy HH:mm')}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-destructive">
                              R {appointment.balance_due.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                {getPaymentStatusPill(appointment.payment_status)}
                                {appointment.payment_updated_at && (
                                  <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(appointment.payment_updated_at), 'dd/MM/yy HH:mm')}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {appointment.payment_updated_at ? (
                                <div className="flex flex-col gap-1 text-xs">
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(appointment.payment_updated_at), 'dd MMM yyyy')}
                                  </div>
                                  <span className="text-slate-400">
                                    {format(new Date(appointment.payment_updated_at), 'HH:mm')}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="rounded-none"
                                  onClick={() => {
                                    setEditingPaymentId(null);
                                    setSelectedAppointmentId(appointment.appointment_id);
                                    setSelectedExpertId(expert.expert_id);
                                    setPaymentAmount("");
                                    setPaymentNotes("");
                                    setPaymentDate("");
                                    setPopFile(null);
                                    setExistingPopUrl(null);
                                    setExistingPopFileName(null);
                                    setShowPaymentDialog(true);
                                  }}
                                >
                                  <RandSign className="h-4 w-4 mr-1" />
                                  Record Payment
                                </Button>
                                {appointment.payment_history.length > 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-none border-black/15"
                                    onClick={() => setExpandedAppointment(
                                      expandedAppointment === appointment.appointment_id ? null : appointment.appointment_id
                                    )}
                                  >
                                    {expandedAppointment === appointment.appointment_id ? 'Hide' : 'Show'} History ({appointment.payment_history.length})
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          {expandedAppointment === appointment.appointment_id && appointment.payment_history.length > 0 && (
                            <TableRow>
                              <TableCell colSpan={10} className="bg-black/[0.02]">
                                <div className="p-4">
                                  <h4 className="text-sm font-semibold mb-3 text-black">Payment History</h4>
                                  <div className="space-y-2">
                                    {appointment.payment_history.map((payment) => (
                                      <div
                                        key={payment.id}
                                        className="flex flex-col gap-3 border border-black/10 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                                      >
                                        <div className="flex-1">
                                          <div className="flex flex-wrap items-center gap-4">
                                            <div>
                                              <p className="text-sm font-semibold text-black">
                                                R {payment.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                                              </p>
                                              <p className="text-xs text-slate-500">
                                                {format(new Date(payment.date), 'dd MMM yyyy HH:mm')}
                                              </p>
                                            </div>
                                            {payment.notes && (
                                              <div className="flex-1 min-w-[150px]">
                                                <p className="text-xs text-slate-500">
                                                  {payment.notes}
                                                </p>
                                              </div>
                                            )}
                                            {payment.pop_url && (
                                              <div className="flex items-center gap-2">
                                                <AdminPill>
                                                  <Paperclip className="h-3 w-3 mr-1" />
                                                  POP Attached
                                                </AdminPill>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="rounded-none"
                                                  onClick={() => handleViewPop(payment.pop_url!, payment.pop_file_name || 'pop')}
                                                >
                                                  <Eye className="h-3 w-3 mr-1" />
                                                  View
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="rounded-none"
                                                  onClick={() => handleDownloadPop(payment.pop_url!, payment.pop_file_name || 'pop')}
                                                >
                                                  <Download className="h-3 w-3 mr-1" />
                                                  Download
                                                </Button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="rounded-none"
                                            onClick={() => handleEditPayment(payment, appointment.appointment_id, expert.expert_id)}
                                          >
                                            <Edit className="h-3 w-3 mr-1" />
                                            Edit
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="rounded-none text-destructive hover:text-destructive"
                                            onClick={() => handleDeletePayment(payment.id, expert.expert_id)}
                                          >
                                            <Trash2 className="h-3 w-3 mr-1" />
                                            Delete
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </AdminCardBody>
            </AdminCard>
          ))
        )}
      </div>

      {/* Email Preview panel — docked sliding sheet (see ExpertStatementPreviewDialog) */}
      <ExpertStatementPreviewDialog
        open={showEmailPreview}
        onOpenChange={setShowEmailPreview}
        expertData={selectedExpertForEmail}
        onSend={handleSendStatement}
      />

      {/* Record/Edit Payment — docked sliding panel, not a centered pop-up */}
      <Sheet open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <SheetContent side="right" className="flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-md">
          <SheetHeader className="space-y-0 border-b border-black/10 px-5 py-4 text-left">
            <SheetTitle className="text-base font-bold text-black">
              {editingPaymentId ? 'Edit' : 'Record'} Expert Payment
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-4 px-5 py-5">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Payment Amount (R) *</Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="rounded-none border-black/15"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-date">Payment Date *</Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate ? format(new Date(paymentDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setPaymentDate(e.target.value ? new Date(e.target.value).toISOString() : "")}
                className="rounded-none border-black/15"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-notes">Notes (Optional)</Label>
              <Textarea
                id="payment-notes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Add any notes about this payment..."
                rows={3}
                className="rounded-none border-black/15"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pop-file">Proof of Payment (POP)</Label>
              {existingPopFileName && !popFile && (
                <div className="flex items-center gap-2 border border-black/10 bg-black/[0.02] p-2 text-sm">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-500">Current: {existingPopFileName}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="rounded-none"
                    onClick={() => existingPopUrl && handleViewPop(existingPopUrl, existingPopFileName)}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <Input
                id="pop-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => setPopFile(e.target.files?.[0] || null)}
                className="rounded-none border-black/15"
              />
              {popFile && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Paperclip className="h-3 w-3" />
                  {popFile.name}
                </div>
              )}
              <p className="text-xs text-slate-500">
                Upload proof of payment (PDF, JPG, PNG, DOC)
              </p>
            </div>

            {!editingPaymentId && (
              <div className="text-xs text-slate-500">
                Payment will be recorded with current timestamp: {format(new Date(), 'dd MMM yyyy HH:mm')}
              </div>
            )}
          </div>

          <SheetFooter className="gap-2 border-t border-black/10 px-5 py-4 sm:justify-end">
            <Button
              variant="outline"
              className="rounded-none border-black/15"
              onClick={() => {
                setShowPaymentDialog(false);
                setPaymentAmount("");
                setPaymentNotes("");
                setPaymentDate("");
                setSelectedAppointmentId(null);
                setSelectedExpertId(null);
                setEditingPaymentId(null);
                setPopFile(null);
                setExistingPopUrl(null);
                setExistingPopFileName(null);
              }}
            >
              Cancel
            </Button>
            <Button className="rounded-none" onClick={handleRecordPayment} disabled={uploadingPop}>
              {uploadingPop ? 'Uploading...' : (editingPaymentId ? 'Update' : 'Record')} Payment
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit Expert Fees — docked sliding panel, opened from the pencil icon
          on the fee tiles (previously a centered pop-up that overlapped the
          page underneath it). */}
      <Sheet open={!!feeEditExpert} onOpenChange={(o) => !o && setFeeEditExpert(null)}>
        <SheetContent side="right" className="flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-lg">
          <SheetHeader className="space-y-0 border-b border-black/10 px-5 py-4 text-left">
            <SheetTitle className="text-base font-bold text-black">Edit Expert Fees</SheetTitle>
            <SheetDescription className="text-xs text-slate-500">
              Updates {feeEditExpert?.expert_name}'s fees in the Medical Expert Directory immediately.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 px-5 py-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="fee-consultation">Consultation Fee (R)</Label>
                <Input
                  id="fee-consultation"
                  type="number"
                  min="0"
                  step="0.01"
                  value={feeConsultation}
                  onChange={(e) => setFeeConsultation(e.target.value)}
                  className="rounded-none border-black/15"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fee-court">Court Fee (R)</Label>
                <Input
                  id="fee-court"
                  type="number"
                  min="0"
                  step="0.01"
                  value={feeCourt}
                  onChange={(e) => setFeeCourt(e.target.value)}
                  className="rounded-none border-black/15"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Changes sync both ways: edits made in the Medical Expert Directory also refresh here automatically.
            </p>

            <div className="border-t border-black/10 pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Fee Change History</Label>
                <span className="text-xs text-slate-500">
                  {feeHistory.length} {feeHistory.length === 1 ? "entry" : "entries"}
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto border border-black/10">
                {historyLoading ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1" /> Loading history…
                  </div>
                ) : feeHistory.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No fee changes recorded yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">When</TableHead>
                        <TableHead className="text-xs">Who</TableHead>
                        <TableHead className="text-xs">Field</TableHead>
                        <TableHead className="text-xs">Change</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {feeHistory.map((h) => {
                        const oldV = h.old_value == null ? "—" : `R ${Number(h.old_value).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
                        const newV = `R ${Number(h.new_value).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
                        const fieldLabel = h.fee_field === "consultation_fees" ? "Consultation" : h.fee_field === "court_fees" ? "Court" : h.fee_field;
                        return (
                          <TableRow key={h.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {format(new Date(h.created_at), "dd MMM yyyy HH:mm")}
                            </TableCell>
                            <TableCell className="text-xs">{h.changed_by_name || "—"}</TableCell>
                            <TableCell className="text-xs">{fieldLabel}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              <span className="text-slate-500">{oldV}</span>
                              <span className="mx-1">→</span>
                              <span className="font-medium text-black">{newV}</span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </div>

          <SheetFooter className="gap-2 border-t border-black/10 px-5 py-4 sm:justify-end">
            <Button variant="ghost" className="rounded-none" onClick={() => setFeeEditExpert(null)} disabled={savingFees}>
              Cancel
            </Button>
            <Button className="rounded-none" onClick={handleSaveFees} disabled={savingFees}>
              {savingFees && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Save & Sync
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ExpertCreditControlContent;
