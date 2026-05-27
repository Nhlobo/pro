import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, DollarSign, FileText, Trash2, Pencil, Zap, CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import CompanyFooter from "@/components/CompanyFooter";
import { format } from "date-fns";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";
import { syncAODPaymentToAppointments, recalculateShortTermFromAppointments, fetchLinkedAssessments } from "@/hooks/usePaymentSync";
import { useAuditTrail } from "@/hooks/useAuditTrail";
import { Badge } from "@/components/ui/badge";

interface AODDocument {
  id: string;
  file_name: string;
  total_contract_value: number | null;
  deposit_amount: number | null;
  payments_made: number;
  contract_description: string | null;
  total_reports_agreed: number | null;
  referring_attorney_id: string;
}

interface Payment {
  id: string;
  payment_amount: number;
  payment_type: 'deposit' | 'regular' | 'final';
  payment_date: string;
  reports_taken_out: number;
  payment_notes: string | null;
  created_at: string;
}
interface LinkedAssessment {
  id: string;
  appointmentDate: string;
  claimantName: string;
  claimantAutoId: string;
  expertName: string;
  expertType: string;
  serviceFee: number;
  depositAmount: number;
  paymentStatus: string;
  paymentDate: string | null;
  paymentTerms: string;
  reportStatus: string;
  reportPaymentStatus: string;
  balance: number;
}

export default function AODPaymentTracking() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const { triggerSync } = useAppointmentSync();
  const { logAuditTrail } = useAuditTrail();
  const [document, setDocument] = useState<AODDocument | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [linkedAssessments, setLinkedAssessments] = useState<LinkedAssessment[]>([]);
  
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentType, setPaymentType] = useState<'deposit' | 'regular' | 'final'>('regular');
  const [reportsTakenOut, setReportsTakenOut] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentNotes, setPaymentNotes] = useState("");

  // Quick payment state
  const [quickAmount, setQuickAmount] = useState("");
  const [quickReports, setQuickReports] = useState("1");
  const [quickDate, setQuickDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [quickSuccess, setQuickSuccess] = useState(false);
  // Per-assessment allocation for Quick Payment
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [syncPaymentId, setSyncPaymentId] = useState<string | null>(null);

  useEffect(() => {
    fetchDocumentAndPayments();
  }, [documentId]);

  // Fetch linked assessments when document loads
  useEffect(() => {
    if (document?.referring_attorney_id) {
      fetchLinkedAssessments(document.referring_attorney_id).then(data => {
        setLinkedAssessments(data as LinkedAssessment[]);
      });
    }
  }, [document?.referring_attorney_id, payments]);

  const fetchDocumentAndPayments = async () => {
    if (!documentId) return;

    try {
      const { data: docData, error: docError } = await supabase
        .from("aod_documents")
        .select("*")
        .eq("id", documentId)
        .single();

      if (docError) throw docError;
      setDocument(docData);

      // Fetch payments from aod_payments table
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("aod_payments")
        .select("*")
        .eq("aod_document_id", documentId)
        .order("payment_date", { ascending: false });

      if (paymentsError) throw paymentsError;
      setPayments((paymentsData || []) as Payment[]);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load payment tracking data");
    } finally {
      setLoading(false);
    }
  };

  // Allocate deposit to a specific appointment (manual allocation)
  const allocateDepositToAppointment = async (appointmentId: string, depositAmount: number) => {
    try {
      // Get the appointment
      const { data: appointment, error: fetchError } = await supabase
        .from('appointments')
        .select('id, service_fee, deposit_amount, payment_status')
        .eq('id', appointmentId)
        .single();

      if (fetchError || !appointment) {
        throw new Error('Appointment not found');
      }

      const currentDeposit = appointment.deposit_amount || 0;
      const serviceFee = appointment.service_fee || 0;
      const newDepositAmount = currentDeposit + depositAmount;

      // Determine new payment status
      let newPaymentStatus = 'pending';
      if (newDepositAmount > 0) {
        newPaymentStatus = newDepositAmount >= serviceFee ? 'full_payment' : 'deposit';
      }

      // Update appointment with deposit
      await supabase
        .from('appointments')
        .update({
          deposit_amount: newDepositAmount,
          payment_status: newPaymentStatus,
          payment_date: new Date().toISOString()
        })
        .eq('id', appointmentId);

      // Update expert report - mark as cleared for report progress
      await supabase
        .from('expert_reports')
        .update({
          report_status: newPaymentStatus === 'full_payment' ? 'in_progress' : 'pending',
          payment_status: newPaymentStatus === 'full_payment' ? 'paid' : 'partial',
          payment_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('appointment_id', appointmentId);

      return { success: true, newPaymentStatus };
    } catch (error: any) {
      console.error('Error allocating deposit:', error);
      throw error;
    }
  };

  const handleAddPayment = async () => {
    if (!paymentAmount || !paymentDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    const amount = parseFloat(paymentAmount);
    const reports = parseInt(reportsTakenOut) || 0;

    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    // Validation for regular/final payments - reports must be specified
    if (paymentType !== 'deposit' && reports <= 0) {
      toast.error("Regular/Final payments require specifying the number of reports taken out");
      return;
    }

    // Validation for deposit - deposits are recorded but NOT auto-allocated
    if (paymentType === 'deposit' && reports > 0) {
      toast.error("Deposits should not specify reports. Deposits must be manually allocated to specific appointments.");
      return;
    }

    try {
      // Insert the payment record
      const { data: insertedPayment, error } = await supabase
        .from("aod_payments")
        .insert({
          aod_document_id: documentId,
          payment_amount: amount,
          payment_type: paymentType,
          payment_date: paymentDate,
          reports_taken_out: reports,
          payment_notes: paymentNotes || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Audit: report-allocation create
      if (insertedPayment) {
        await logAuditTrail(
          'aod_payments',
          insertedPayment.id,
          'CREATE',
          'finance_reports_allocation',
          null,
          { payment_id: insertedPayment.id, aod_document_id: documentId, reports_taken_out: reports, payment_type: paymentType, payment_amount: amount },
          `Reports allocated: +${reports} (payment ${insertedPayment.id})`
        );
      }


      // Use centralized sync to update appointments and short-term agreements
      if (document) {
        const syncResults = await syncAODPaymentToAppointments(
          documentId,
          document.referring_attorney_id,
          amount,
          reports,
          paymentType,
          paymentDate
        );

        if (paymentType !== 'deposit' && syncResults.appointmentsSynced > 0) {
          toast.success(`Payment recorded: R${amount.toLocaleString()} allocated to ${syncResults.appointmentsSynced} assessment(s), reports marked as taken out${syncResults.shortTermSynced ? ' & short-term agreement updated' : ''}`);
        } else if (paymentType === 'deposit') {
          toast.success("Deposit recorded successfully. Please manually allocate this deposit to specific appointments from the Scheduled Assessments page.");
        } else {
          toast.success("Payment recorded successfully");
        }
      } else {
        toast.success("Payment recorded successfully");
      }

      // Update AOD document payment status
      await updateAODPaymentStatus();

      // Reset form
      setPaymentAmount("");
      setPaymentType('regular');
      setReportsTakenOut("");
      setPaymentNotes("");
      setShowAddPayment(false);

      // Refresh data first
      await fetchDocumentAndPayments();

      // Trigger sync to update all dashboards
      triggerSync();
    } catch (error: any) {
      console.error("Error adding payment:", error);
      toast.error("Failed to record payment");
    }
  };

  const updateAODPaymentStatus = async () => {
    if (!documentId || !document) return;
    
    try {
      // Get all payments for this AOD
      const { data: allPayments } = await supabase
        .from("aod_payments")
        .select("payment_amount, payment_type")
        .eq("aod_document_id", documentId);
      
      const totalPaidAmount = (allPayments || []).reduce((sum, p) => sum + p.payment_amount, 0);
      const contractValue = document.total_contract_value || 0;
      
      let newPaymentStatus = 'pending';
      if (totalPaidAmount >= contractValue && contractValue > 0) {
        newPaymentStatus = 'paid';
      } else if (totalPaidAmount > 0) {
        newPaymentStatus = 'partial';
      }
      
      await supabase
        .from("aod_documents")
        .update({
          payment_status: newPaymentStatus,
          last_payment_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", documentId);
    } catch (error) {
      console.error("Error updating AOD payment status:", error);
    }
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setPaymentAmount(payment.payment_amount.toString());
    setPaymentType(payment.payment_type);
    setReportsTakenOut(payment.reports_taken_out?.toString() || "");
    setPaymentDate(payment.payment_date);
    setPaymentNotes(payment.payment_notes || "");
    setShowAddPayment(true);
  };

  const handleUpdatePayment = async () => {
    if (!paymentAmount || !paymentDate || !editingPayment) {
      toast.error("Please fill in all required fields");
      return;
    }

    const amount = parseFloat(paymentAmount);
    const reports = parseInt(reportsTakenOut) || 0;

    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    try {
      // Get the difference in reports taken out
      const oldReports = editingPayment.reports_taken_out || 0;
      const reportsDifference = reports - oldReports;
      
      const { error } = await supabase
        .from("aod_payments")
        .update({
          payment_amount: amount,
          payment_type: paymentType,
          payment_date: paymentDate,
          reports_taken_out: reports,
          payment_notes: paymentNotes || null,
        })
        .eq("id", editingPayment.id);

      if (error) throw error;

      // Audit: report-allocation update
      await logAuditTrail(
        'aod_payments',
        editingPayment.id,
        'UPDATE',
        'finance_reports_allocation',
        { reports_taken_out: oldReports, payment_amount: editingPayment.payment_amount, payment_type: editingPayment.payment_type },
        { reports_taken_out: reports, payment_amount: amount, payment_type: paymentType },
        `Reports allocation changed by ${reportsDifference >= 0 ? '+' : ''}${reportsDifference} (was ${oldReports}, now ${reports}) on payment ${editingPayment.id}`
      );


      // Update related appointments if reports taken out changed
      if (reportsDifference !== 0 && document) {
        const { data: appointments, error: appointmentsError } = await supabase
          .from('appointments')
          .select('id, service_fee, deposit_amount, payment_status, payment_date')
          .eq('referring_attorney_id', document.referring_attorney_id)
          .in('payment_status', ['pending', 'deposit', 'full_payment'])
          .order('appointment_date', { ascending: true })
          .limit(Math.abs(reportsDifference));

        if (!appointmentsError && appointments && appointments.length > 0) {
          const paymentPerReport = amount / reports;
          
          for (const appointment of appointments) {
            const currentDeposit = appointment.deposit_amount || 0;
            const serviceFee = appointment.service_fee || 0;
            const adjustmentAmount = reportsDifference > 0 ? paymentPerReport : -paymentPerReport;
            const newDepositAmount = Math.max(0, currentDeposit + adjustmentAmount);
            
            let newPaymentStatus = 'pending';
            if (newDepositAmount > 0) {
              newPaymentStatus = newDepositAmount >= serviceFee ? 'full_payment' : 'deposit';
            }

            // Update appointment
            await supabase
              .from('appointments')
              .update({
                deposit_amount: newDepositAmount,
                payment_status: newPaymentStatus,
                payment_date: reportsDifference > 0 ? new Date().toISOString() : appointment.payment_date
              })
              .eq('id', appointment.id);

            // Update expert report status based on report difference
            if (reportsDifference > 0) {
              // Reports taken out - mark as taken_out
              await supabase
                .from('expert_reports')
                .update({
                  report_status: 'taken_out',
                  payment_status: 'paid',
                  payment_date: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('appointment_id', appointment.id);
            } else if (reportsDifference < 0) {
              // Reports returned - revert to pending
              await supabase
                .from('expert_reports')
                .update({
                  report_status: 'pending',
                  payment_status: 'pending',
                  updated_at: new Date().toISOString()
                })
                .eq('appointment_id', appointment.id);
            }
          }
          
          toast.success(`Payment updated and ${appointments.length} appointment(s) updated with report statuses`);
        } else {
          toast.success("Payment updated successfully");
        }
      } else {
      toast.success("Payment updated successfully");
      }

      // Update AOD document payment status
      await updateAODPaymentStatus();
      
      // Reset form
      setPaymentAmount("");
      setPaymentType('regular');
      setReportsTakenOut("");
      setPaymentNotes("");
      setShowAddPayment(false);
      setEditingPayment(null);
      
      // Refresh data first
      await fetchDocumentAndPayments();
      
      // Trigger sync to update all dashboards
      triggerSync();
    } catch (error: any) {
      console.error("Error updating payment:", error);
      toast.error("Failed to update payment");
    }
  };

  const handleCancelEdit = () => {
    setEditingPayment(null);
    setPaymentAmount("");
    setPaymentType('regular');
    setReportsTakenOut("");
    setPaymentNotes("");
    setShowAddPayment(false);
  };

  const handleDeletePayment = async () => {
    if (!deletePaymentId) return;

    try {
      // Get the payment details before deleting to check if reports need reverting
      const paymentToDelete = payments.find(p => p.id === deletePaymentId);
      
      const { error } = await supabase
        .from("aod_payments")
        .delete()
        .eq("id", deletePaymentId);

      if (error) throw error;

      // Audit: report-allocation delete (reports reverted)
      if (paymentToDelete) {
        await logAuditTrail(
          'aod_payments',
          paymentToDelete.id,
          'DELETE',
          'finance_reports_allocation',
          { reports_taken_out: paymentToDelete.reports_taken_out, payment_amount: paymentToDelete.payment_amount, payment_type: paymentToDelete.payment_type },
          null,
          `Payment deleted — reports allocation reverted by -${paymentToDelete.reports_taken_out || 0} (payment ${paymentToDelete.id})`
        );
      }

      // If the deleted payment had reports taken out, we should revert those reports
      if (paymentToDelete && paymentToDelete.reports_taken_out > 0 && document) {
        const { data: takenOutReports } = await supabase
          .from('expert_reports')
          .select('id, appointment_id')
          .eq('report_status', 'taken_out')
          .order('updated_at', { ascending: false })
          .limit(paymentToDelete.reports_taken_out);

        if (takenOutReports && takenOutReports.length > 0) {
          for (const report of takenOutReports) {
            await supabase
              .from('expert_reports')
              .update({
                report_status: 'pending',
                payment_status: 'pending',
                payment_date: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', report.id);
          }
        }
      }

      // Update AOD document payment status
      await updateAODPaymentStatus();

      toast.success("Payment deleted successfully");
      setDeletePaymentId(null);
      
      // Refresh data first
      await fetchDocumentAndPayments();
      
      // Trigger sync to update all dashboards
      triggerSync();
    } catch (error: any) {
      console.error("Error deleting payment:", error);
      toast.error("Failed to delete payment");
    }
  };

  // Include initial deposit from contract plus any deposit payments
  const initialDeposit = document?.deposit_amount || 0;

  // Quick regular payment handler
  const handleQuickPayment = async () => {
    const amount = parseFloat(quickAmount);
    const reports = parseInt(quickReports) || 0;

    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }
    if (reports <= 0) {
      toast.error("Specify how many reports are being taken out");
      return;
    }

    // Validate allocations vs payment amount
    const totalAllocated = Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0);
    const remainingUnallocated = amount - totalAllocated;
    if (totalAllocated > amount + 0.0001) {
      const over = (totalAllocated - amount);
      toast.error(
        `Allocation exceeds payment by R${over.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Payment R${amount.toLocaleString()}, allocated R${totalAllocated.toLocaleString()}. Reduce allocations before saving.`
      );
      return;
    }
    if (totalAllocated > 0 && remainingUnallocated > 0.0001) {
      const ok = window.confirm(
        `You have allocated R${totalAllocated.toLocaleString()} of R${amount.toLocaleString()}. R${remainingUnallocated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} will remain unallocated. Continue?`
      );
      if (!ok) return;
    }



    setQuickSubmitting(true);
    try {
      const { data: insertedQuick, error } = await supabase
        .from("aod_payments")
        .insert({
          aod_document_id: documentId,
          payment_amount: amount,
          payment_type: 'regular',
          payment_date: quickDate,
          reports_taken_out: reports,
          payment_notes: `Quick payment: ${reports} report(s) taken out`,
        })
        .select()
        .single();

      if (error) throw error;

      // Audit: report-allocation create (quick payment)
      if (insertedQuick) {
        await logAuditTrail(
          'aod_payments',
          insertedQuick.id,
          'CREATE',
          'finance_reports_allocation',
          null,
          { payment_id: insertedQuick.id, aod_document_id: documentId, reports_taken_out: reports, payment_type: 'regular', payment_amount: amount, source: 'quick_payment' },
          `Quick payment: reports allocated +${reports} (payment ${insertedQuick.id})`
        );
      }

      const selectedEntries = Object.entries(allocations).filter(([, v]) => v > 0);
      if (document && selectedEntries.length > 0) {
        // Atomic allocation: single RPC wraps all appointment + expert_report updates in one transaction
        const payload = selectedEntries.map(([appointment_id, amt]) => ({ appointment_id, amount: amt }));
        const { data: rpcData, error: rpcError } = await supabase.rpc('apply_aod_allocations', {
          p_allocations: payload as any,
          p_payment_date: quickDate,
        });
        if (rpcError) {
          throw new Error(`Atomic allocation failed — no changes saved: ${rpcError.message}`);
        }
        const fullyPaidCount = Number((rpcData as any)?.fully_paid_count ?? 0);
        const updatedCount = Number((rpcData as any)?.updated_count ?? selectedEntries.length);
        toast.success(`R${amount.toLocaleString()} allocated across ${updatedCount} assessment(s) — ${fullyPaidCount} marked as report taken out.`);
        setAllocations({});
      } else if (document) {
        const syncResults = await syncAODPaymentToAppointments(
          documentId!,
          document.referring_attorney_id,
          amount,
          reports,
          'regular',
          quickDate
        );
        toast.success(`R${amount.toLocaleString()} recorded — ${syncResults.appointmentsSynced} assessment(s) updated, ${reports} report(s) marked taken out`);
      }

      await updateAODPaymentStatus();
      setQuickAmount("");
      setQuickReports("1");
      setQuickDate(format(new Date(), "yyyy-MM-dd"));
      setSyncPaymentId(null);
      setAllocations({});
      setQuickSuccess(true);
      setTimeout(() => setQuickSuccess(false), 3000);
      await fetchDocumentAndPayments();
      triggerSync();
    } catch (error: any) {
      console.error("Quick payment error:", error);
      toast.error("Failed to record payment");
    } finally {
      setQuickSubmitting(false);
    }
  };

  // Sync from recorded payment: pre-fill quick payment + allocations
  const handleSyncFromPayment = (paymentId: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;

    setSyncPaymentId(paymentId);
    setQuickAmount(payment.payment_amount.toString());
    setQuickReports(payment.reports_taken_out?.toString() || "1");
    setQuickDate(payment.payment_date);

    // Pre-fill allocations: tick the first N pending assessments
    const reportsCount = payment.reports_taken_out || 0;
    const paymentAmt = payment.payment_amount;
    const pending = linkedAssessments.filter(a => a.paymentStatus !== 'full_payment');

    const newAllocations: Record<string, number> = {};
    const amountPerReport = reportsCount > 0 ? paymentAmt / reportsCount : 0;

    for (let i = 0; i < Math.min(reportsCount, pending.length); i++) {
      const apt = pending[i];
      const outstanding = Math.max(0, apt.serviceFee - apt.depositAmount);
      newAllocations[apt.id] = Math.min(amountPerReport, outstanding);
    }

    setAllocations(newAllocations);
    toast.info(`Synced from ${format(new Date(payment.payment_date), 'dd MMM yyyy')}: R${paymentAmt.toLocaleString()} across ${reportsCount} report(s)`);
  };

  const depositPayments = payments
    .filter(p => p.payment_type === 'deposit')
    .reduce((sum, p) => sum + p.payment_amount, 0);
  const totalDeposits = initialDeposit + depositPayments;
  
  const totalRegularPayments = payments
    .filter(p => p.payment_type !== 'deposit')
    .reduce((sum, p) => sum + p.payment_amount, 0);
  
  // Both deposits and regular payments reduce the contract value
  const totalPaid = totalDeposits + totalRegularPayments;
  const remainingBalance = (document?.total_contract_value || 0) - totalPaid;
  
  // Calculate reports taken out ONLY from regular/final payments (deposits don't count)
  const reportsTaken = payments
    .filter(p => p.payment_type !== 'deposit')
    .reduce((sum, p) => sum + (p.reports_taken_out || 0), 0);
  
  // Calculate remaining reports from total agreed upon in contract
  const totalReportsAgreed = document?.total_reports_agreed || 0;
  const remainingReports = Math.max(0, totalReportsAgreed - reportsTaken);

  // Real-time validation: projected totals for pending inputs (edit/add form & quick payment)
  const editingDelta = editingPayment && editingPayment.payment_type !== 'deposit'
    ? (parseInt(reportsTakenOut || '0', 10) || 0) - (editingPayment.reports_taken_out || 0)
    : 0;
  const addingDelta = !editingPayment && showAddPayment && paymentType !== 'deposit'
    ? (parseInt(reportsTakenOut || '0', 10) || 0)
    : 0;
  const quickDelta = parseInt(quickReports || '0', 10) || 0;
  const projectedFormTotal = reportsTaken + editingDelta + addingDelta;
  const projectedQuickTotal = reportsTaken + quickDelta;
  const mismatch = totalReportsAgreed > 0 && reportsTaken !== totalReportsAgreed;
  const overAgreed = totalReportsAgreed > 0 && reportsTaken > totalReportsAgreed;

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!document) {
    return <div className="flex items-center justify-center min-h-screen">Document not found</div>;
  }

  return (
    <>
      <Helmet>
        <title>AOD Payment Tracking - Medico-Legal Assessment System</title>
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/aod-management")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to AOD Management
            </Button>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-foreground">Payment & Report Tracking</h1>
            <p className="text-muted-foreground mt-2">{document.file_name}</p>
            {document.contract_description && (
              <p className="text-sm text-muted-foreground mt-1">{document.contract_description}</p>
            )}
            {!document.total_reports_agreed && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                ⚠️ Total assessments not set. Please edit the AOD document to add the total number of reports/assessments agreed upon.
              </div>
            )}
            {mismatch && (
              <div
                role="alert"
                className={`mt-3 p-3 rounded border flex items-start gap-2 text-sm ${
                  overAgreed
                    ? 'bg-destructive/10 border-destructive/40 text-destructive'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                <span className="font-semibold">
                  {overAgreed ? '🚫 Over-allocation:' : '⚠️ Reports mismatch:'}
                </span>
                <span>
                  Reports Taken Out (<strong>{reportsTaken}</strong>) does not match Reports Agreed
                  (<strong>{totalReportsAgreed}</strong>).{' '}
                  {overAgreed
                    ? `You have allocated ${reportsTaken - totalReportsAgreed} more report(s) than the contract allows. Please correct before saving.`
                    : `${totalReportsAgreed - reportsTaken} report(s) still need to be allocated against payments.`}
                </span>
              </div>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Contract Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  R {(document.total_contract_value || 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Deposits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  R {totalDeposits.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Initial: R{initialDeposit.toLocaleString()} + Payments: R{depositPayments.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Regular Payments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  R {totalRegularPayments.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Covers reports taken</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Remaining Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  R {remainingBalance.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">After all payments</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Reports Status</CardTitle>
              </CardHeader>
              <CardContent>
                {totalReportsAgreed > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Taken:</span>
                      <span className="text-lg font-bold text-foreground">{reportsTaken}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Remaining:</span>
                      <span className="text-lg font-bold text-primary">{remainingReports}</span>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Total agreed:</span>
                        <span className="text-sm font-semibold">{totalReportsAgreed}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">No total assessments set</p>
                    <p className="text-xs text-muted-foreground mt-1">Edit document to add</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Expanded Payment Breakdown */}
          {payments.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Payment Breakdown
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {payments.length} transaction{payments.length !== 1 ? 's' : ''}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-auto max-h-[320px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs w-[14%]">Date</TableHead>
                        <TableHead className="text-xs w-[12%]">Type</TableHead>
                        <TableHead className="text-xs w-[14%] text-right">Amount</TableHead>
                        <TableHead className="text-xs w-[12%] text-center">Reports Out</TableHead>
                        <TableHead className="text-xs w-[12%] text-center">Cumulative</TableHead>
                        <TableHead className="text-xs w-[12%] text-center">Remaining</TableHead>
                        <TableHead className="text-xs w-[14%] text-right">Balance After</TableHead>
                        <TableHead className="text-xs w-[10%]">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        let cumulativeReports = 0;
                        let cumulativePaid = 0;
                        const contractValue = document?.total_contract_value || 0;
                        const agreed = document?.total_reports_agreed || 0;
                        return payments
                          .slice()
                          .sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())
                          .map((payment) => {
                            const isDeposit = payment.payment_type === 'deposit';
                            const reportsOut = isDeposit ? 0 : (payment.reports_taken_out || 0);
                            cumulativeReports += reportsOut;
                            cumulativePaid += payment.payment_amount;
                            const remainingReports = Math.max(0, agreed - cumulativeReports);
                            const balanceAfter = Math.max(0, contractValue - cumulativePaid);
                            return (
                              <TableRow key={payment.id} className="text-xs">
                                <TableCell className="font-medium">
                                  {format(new Date(payment.payment_date), "dd MMM yyyy")}
                                </TableCell>
                                <TableCell>
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    payment.payment_type === 'deposit'
                                      ? 'bg-blue-100 text-blue-800'
                                      : payment.payment_type === 'final'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {payment.payment_type.charAt(0).toUpperCase() + payment.payment_type.slice(1)}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  R{payment.payment_amount.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-center">
                                  {reportsOut > 0 ? (
                                    <span className="font-semibold text-foreground">+{reportsOut}</span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center font-semibold text-primary">
                                  {cumulativeReports}
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className={`font-semibold ${remainingReports === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                                    {agreed > 0 ? remainingReports : '—'}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  R{balanceAfter.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-muted-foreground truncate max-w-[80px]">
                                  {payment.payment_notes || "—"}
                                </TableCell>
                              </TableRow>
                            );
                          });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Regular Payment — Always Visible */}
          <Card className="border-2 border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-primary" />
                Quick Regular Payment
                {quickSuccess && (
                  <span className="flex items-center gap-1 text-sm font-normal text-green-600 ml-auto">
                    <CheckCircle2 className="h-4 w-4" /> Recorded!
                  </span>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Capture payment received and specify how many reports are being taken out. Updates assessments automatically.
              </p>
            </CardHeader>
            <CardContent>
              {/* Sync from recorded payment */}
              <div className="flex flex-col sm:flex-row items-end gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <Label className="text-xs font-medium">Sync from recorded payment</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Select
                      value={syncPaymentId || ''}
                      onValueChange={(value) => {
                        if (value) handleSyncFromPayment(value);
                        else {
                          setSyncPaymentId(null);
                          setAllocations({});
                        }
                      }}
                    >
                      <SelectTrigger className="w-[300px]">
                        <SelectValue placeholder="Select a past payment..." />
                      </SelectTrigger>
                      <SelectContent>
                        {payments
                          .filter(p => p.payment_type !== 'deposit' && (p.reports_taken_out || 0) > 0)
                          .map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {format(new Date(p.payment_date), 'dd MMM yyyy')} — R{p.payment_amount.toLocaleString()} ({p.reports_taken_out || 0} reports)
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {syncPaymentId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSyncPaymentId(null);
                          setAllocations({});
                          setQuickAmount('');
                          setQuickReports('1');
                          setQuickDate(format(new Date(), 'yyyy-MM-dd'));
                        }}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-end gap-3">
                <div className="flex-1 min-w-0">
                  <Label htmlFor="quick-amount" className="text-xs font-medium">Amount (R)</Label>
                  <Input
                    id="quick-amount"
                    type="number"
                    step="0.01"
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(e.target.value)}
                    placeholder="e.g. 15000"
                    className="mt-1"
                  />
                </div>
                <div className="w-32">
                  <Label htmlFor="quick-reports" className="text-xs font-medium">Reports Taken</Label>
                  <Input
                    id="quick-reports"
                    type="number"
                    min="1"
                    value={quickReports}
                    onChange={(e) => setQuickReports(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="w-40">
                  <Label htmlFor="quick-date" className="text-xs font-medium">Payment Date</Label>
                  <Input
                    id="quick-date"
                    type="date"
                    value={quickDate}
                    onChange={(e) => setQuickDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <Button
                  onClick={() => {
                    const amt = parseFloat(quickAmount) || 0;
                    const totalAlloc = Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0);
                    if (totalAlloc > amt + 0.0001) {
                      toast.error(`Cannot save: allocations (R${totalAlloc.toLocaleString()}) exceed payment amount (R${amt.toLocaleString()}). Over by R${(totalAlloc - amt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
                      return;
                    }
                    if (totalReportsAgreed > 0 && projectedQuickTotal > totalReportsAgreed) {
                      toast.error(`Cannot save: this would push total Reports Taken Out to ${projectedQuickTotal}, exceeding Reports Agreed (${totalReportsAgreed}).`);
                      return;
                    }
                    if (totalReportsAgreed > 0 && projectedQuickTotal < totalReportsAgreed) {
                      const ok = window.confirm(`Reports Taken Out will be ${projectedQuickTotal}/${totalReportsAgreed} after this payment. ${totalReportsAgreed - projectedQuickTotal} report(s) will remain unallocated. Continue?`);
                      if (!ok) return;
                    }
                    handleQuickPayment();
                  }}
                  disabled={
                    quickSubmitting ||
                    !quickAmount ||
                    Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0) > (parseFloat(quickAmount) || 0) + 0.0001
                  }
                  className="whitespace-nowrap"
                >
                  {quickSubmitting ? "Recording..." : (
                    <>
                      <Zap className="h-4 w-4 mr-1" />
                      Record Payment
                    </>
                  )}
                </Button>

              </div>
              {remainingReports > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {remainingReports} report(s) remaining out of {totalReportsAgreed} agreed • Balance: R{remainingBalance.toLocaleString()}
                </p>
              )}
              {totalReportsAgreed > 0 && quickDelta > 0 && projectedQuickTotal !== totalReportsAgreed && (
                <p className={`text-xs mt-1 font-medium ${projectedQuickTotal > totalReportsAgreed ? 'text-destructive' : 'text-amber-700'}`}>
                  {projectedQuickTotal > totalReportsAgreed
                    ? `🚫 This will exceed Reports Agreed by ${projectedQuickTotal - totalReportsAgreed} (projected ${projectedQuickTotal}/${totalReportsAgreed}).`
                    : `⚠️ After saving, total will be ${projectedQuickTotal}/${totalReportsAgreed} — ${totalReportsAgreed - projectedQuickTotal} still unallocated.`}
                </p>
              )}

              {/* Per-Assessment Allocation */}
              {linkedAssessments.length > 0 && (() => {
                const pendingAssessments = linkedAssessments.filter(
                  a => a.paymentStatus !== 'full_payment'
                );
                if (pendingAssessments.length === 0) return null;
                const paymentAmt = parseFloat(quickAmount) || 0;
                const totalAllocated = Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0);
                const remainingToAllocate = paymentAmt - totalAllocated;
                const overAllocated = remainingToAllocate < 0;
                return (
                  <div className="mt-4 border-t pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs font-semibold">
                        Allocate to specific reports / files (optional)
                      </Label>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">
                          Payment: <strong className="text-foreground">R{paymentAmt.toLocaleString()}</strong>
                        </span>
                        <span className="text-muted-foreground">
                          Allocated: <strong className="text-primary">R{totalAllocated.toLocaleString()}</strong>
                        </span>
                        <span className={overAllocated ? 'text-destructive font-semibold' : remainingToAllocate === 0 && paymentAmt > 0 ? 'text-green-600 font-semibold' : 'text-amber-700 font-semibold'}>
                          {overAllocated
                            ? `Over by R${Math.abs(remainingToAllocate).toLocaleString()}`
                            : remainingToAllocate === 0 && paymentAmt > 0
                            ? 'Fully allocated'
                            : `Unallocated: R${remainingToAllocate.toLocaleString()}`}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Tick a file to allocate from this payment. Edit the amount to split partially. If left empty, payment will auto-allocate to oldest pending assessments.
                    </p>
                    <div className="rounded border max-h-[220px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead className="text-xs">Claimant</TableHead>
                            <TableHead className="text-xs">Expert</TableHead>
                            <TableHead className="text-xs text-right">Fee</TableHead>
                            <TableHead className="text-xs text-right">Paid</TableHead>
                            <TableHead className="text-xs text-right">Outstanding</TableHead>
                            <TableHead className="text-xs w-[130px]">Allocate (R)</TableHead>
                            <TableHead className="text-xs w-[90px]">Coverage</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingAssessments.map(apt => {
                            const checked = allocations[apt.id] !== undefined;
                            const allocated = allocations[apt.id] || 0;
                            const outstanding = Math.max(0, apt.serviceFee - apt.depositAmount);
                            const newPaid = apt.depositAmount + allocated;
                            const fullyCovered = allocated > 0 && newPaid >= apt.serviceFee;
                            const partial = allocated > 0 && newPaid < apt.serviceFee;
                            return (
                              <TableRow key={apt.id} className="text-xs">
                                <TableCell>
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => {
                                      setAllocations(prev => {
                                        const next = { ...prev };
                                        if (v) {
                                          const remaining = paymentAmt - Object.values(prev).reduce((s, x) => s + x, 0);
                                          next[apt.id] = Math.min(Math.max(0, remaining), outstanding) || outstanding;
                                        } else {
                                          delete next[apt.id];
                                        }
                                        return next;
                                      });
                                    }}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{apt.claimantName}</TableCell>
                                <TableCell>{apt.expertName}</TableCell>
                                <TableCell className="text-right">R{apt.serviceFee.toLocaleString()}</TableCell>
                                <TableCell className="text-right text-muted-foreground">R{apt.depositAmount.toLocaleString()}</TableCell>
                                <TableCell className="text-right font-semibold text-destructive">R{outstanding.toLocaleString()}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={checked ? allocated : ''}
                                    disabled={!checked}
                                    onChange={(e) => {
                                      const v = parseFloat(e.target.value) || 0;
                                      setAllocations(prev => ({ ...prev, [apt.id]: v }));
                                    }}
                                    className="h-7 text-xs"
                                  />
                                </TableCell>
                                <TableCell>
                                  {fullyCovered ? (
                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-[10px]">Fully Paid</Badge>
                                  ) : partial ? (
                                    <Badge variant="secondary" className="text-[10px]">
                                      Partial (R{Math.max(0, apt.serviceFee - newPaid).toLocaleString()} left)
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Linked Assessments Overview */}
          {linkedAssessments.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Linked Assessments ({linkedAssessments.length})
                  <Badge variant="outline" className="ml-2">
                    {linkedAssessments.filter(a => a.reportStatus === 'taken_out' || a.paymentStatus === 'full_payment').length} Reports Taken Out
                  </Badge>
                  <Badge variant="secondary" className="ml-1">
                    {linkedAssessments.filter(a => a.paymentStatus === 'pending' || a.paymentStatus === 'deposit').length} Pending
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-auto max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Claimant</TableHead>
                        <TableHead className="text-xs">Expert</TableHead>
                        <TableHead className="text-xs text-right">Fee</TableHead>
                        <TableHead className="text-xs text-right">Paid</TableHead>
                        <TableHead className="text-xs text-right">Balance</TableHead>
                        <TableHead className="text-xs">Payment</TableHead>
                        <TableHead className="text-xs">Report</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linkedAssessments.map((apt) => (
                        <TableRow key={apt.id} className="text-xs">
                          <TableCell>{format(new Date(apt.appointmentDate), "dd MMM yyyy")}</TableCell>
                          <TableCell className="font-medium">{apt.claimantName}</TableCell>
                          <TableCell>{apt.expertName}</TableCell>
                          <TableCell className="text-right">R{apt.serviceFee.toLocaleString()}</TableCell>
                          <TableCell className="text-right">R{apt.depositAmount.toLocaleString()}</TableCell>
                          <TableCell className={`text-right font-semibold ${apt.balance > 0 ? 'text-destructive' : 'text-green-600'}`}>
                            R{Math.max(0, apt.balance).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={apt.paymentStatus === 'full_payment' ? 'default' : apt.paymentStatus === 'deposit' ? 'secondary' : 'outline'} className="text-[10px]">
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
              </CardContent>
            </Card>
          )}

          {/* Add Payment Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Payment History
                </CardTitle>
                {!editingPayment && (
                  <Button
                    onClick={() => setShowAddPayment(!showAddPayment)}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Payment
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showAddPayment && (
                <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                  {editingPayment && (
                    <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                      Editing payment from {format(new Date(editingPayment.payment_date), "MMM dd, yyyy")}
                    </div>
                  )}
                  {!editingPayment && paymentType === 'deposit' && (
                    <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                      <strong>Note:</strong> Deposits are recorded but must be manually allocated to specific appointments from the Scheduled Assessments page.
                    </div>
                  )}
                  {!editingPayment && paymentType !== 'deposit' && (
                    <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                      <strong>Regular/Final Payments:</strong> Specify the number of reports being taken out. The payment will be automatically allocated to pending appointments.
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="amount">Payment Amount (R) *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="Enter amount"
                      />
                    </div>
                    <div>
                      <Label htmlFor="paymentType">Payment Type *</Label>
                      <Select value={paymentType} onValueChange={(value: 'deposit' | 'regular' | 'final') => setPaymentType(value)}>
                        <SelectTrigger id="paymentType">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deposit">Deposit</SelectItem>
                          <SelectItem value="regular">Regular Payment</SelectItem>
                          <SelectItem value="final">Final Payment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="reports">
                        Reports Taken Out {paymentType !== 'deposit' && <span className="text-destructive">*</span>}
                      </Label>
                      <Input
                        id="reports"
                        type="number"
                        value={reportsTakenOut}
                        onChange={(e) => setReportsTakenOut(e.target.value)}
                        placeholder={paymentType === 'deposit' ? "N/A for deposits" : "Required"}
                        disabled={paymentType === 'deposit'}
                      />
                      {paymentType === 'deposit' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Deposits don't specify reports
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="date">Payment Date *</Label>
                      <Input
                        id="date"
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="Payment notes..."
                      rows={2}
                    />
                  </div>
                  {totalReportsAgreed > 0 && paymentType !== 'deposit' && (editingDelta !== 0 || addingDelta > 0) && projectedFormTotal !== totalReportsAgreed && (
                    <div
                      role="alert"
                      className={`p-2 rounded border text-xs ${
                        projectedFormTotal > totalReportsAgreed
                          ? 'bg-destructive/10 border-destructive/40 text-destructive'
                          : 'bg-amber-50 border-amber-300 text-amber-900'
                      }`}
                    >
                      {projectedFormTotal > totalReportsAgreed
                        ? `🚫 Saving will exceed Reports Agreed by ${projectedFormTotal - totalReportsAgreed} (projected ${projectedFormTotal}/${totalReportsAgreed}). Reduce Reports Taken Out before saving.`
                        : `⚠️ After saving, total Reports Taken Out will be ${projectedFormTotal}/${totalReportsAgreed} — ${totalReportsAgreed - projectedFormTotal} still unallocated.`}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        if (totalReportsAgreed > 0 && paymentType !== 'deposit' && projectedFormTotal > totalReportsAgreed) {
                          toast.error(`Cannot save: total Reports Taken Out (${projectedFormTotal}) would exceed Reports Agreed (${totalReportsAgreed}).`);
                          return;
                        }
                        if (totalReportsAgreed > 0 && paymentType !== 'deposit' && projectedFormTotal < totalReportsAgreed) {
                          const ok = window.confirm(`Reports Taken Out will be ${projectedFormTotal}/${totalReportsAgreed} after saving. ${totalReportsAgreed - projectedFormTotal} report(s) will remain unallocated. Continue?`);
                          if (!ok) return;
                        }
                        editingPayment ? handleUpdatePayment() : handleAddPayment();
                      }}
                    >
                      {editingPayment ? (
                        <>
                          <Pencil className="h-4 w-4 mr-2" />
                          Update Payment
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Record Payment
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {payments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No payments recorded yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reports</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Recorded On</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{format(new Date(payment.payment_date), "MMM dd, yyyy")}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            payment.payment_type === 'deposit' 
                              ? 'bg-blue-100 text-blue-800' 
                              : payment.payment_type === 'final'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {payment.payment_type.charAt(0).toUpperCase() + payment.payment_type.slice(1)}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">R {payment.payment_amount.toLocaleString()}</TableCell>
                        <TableCell>{payment.reports_taken_out || 0}</TableCell>
                        <TableCell>{payment.payment_notes || "-"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(payment.created_at), "MMM dd, yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPayment(payment)}
                              className="text-primary hover:text-primary"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletePaymentId(payment.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <CompanyFooter />
      </div>

      <AlertDialog open={!!deletePaymentId} onOpenChange={() => setDeletePaymentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment transaction? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePayment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
