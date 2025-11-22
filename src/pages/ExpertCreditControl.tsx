import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Mail, DollarSign, Clock, Search, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import CompanyFooter from "@/components/CompanyFooter";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ExpertStatementPreviewDialog } from "@/components/ExpertStatementPreviewDialog";

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
      amount: number;
      date: string;
      recorded_by: string;
    }[];
  }[];
  total_owed: number;
  total_deposit: number;
  total_balance: number;
}

const ExpertCreditControl = () => {
  const navigate = useNavigate();
  const [expertsData, setExpertsData] = useState<ExpertPaymentData[]>([]);
  const [filteredExperts, setFilteredExperts] = useState<ExpertPaymentData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [selectedExpertId, setSelectedExpertId] = useState<string | null>(null);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [selectedExpertForEmail, setSelectedExpertForEmail] = useState<ExpertPaymentData | null>(null);

  useEffect(() => {
    fetchExpertPaymentData();
  }, []);

  useEffect(() => {
    // Filter experts based on search query
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

      // Fetch appointments with expert and claimant details
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

      // Fetch experts with their fee structure
      const { data: experts, error: expertsError } = await supabase
        .rpc('get_medical_experts_secure');

      if (expertsError) throw expertsError;

      // Fetch claimants
      const { data: claimants, error: claimantsError } = await supabase
        .from("claimants")
        .select("id, first_name, last_name");

      if (claimantsError) throw claimantsError;

      // Fetch expert payments
      const { data: expertPayments, error: paymentsError } = await supabase
        .from("expert_payments")
        .select("*")
        .order("payment_date", { ascending: false });

      if (paymentsError) throw paymentsError;

      // Group appointments by expert
      const expertMap = new Map<string, ExpertPaymentData>();

      appointments?.forEach((appointment) => {
        const expert = experts?.find((e: any) => e.id === appointment.expert_id);
        const claimant = claimants?.find((c) => c.id === appointment.claimant_id);

        if (!expert) return;

        const expertKey = appointment.expert_id;
        
        // Calculate what is owed to the expert
        const consultationFee = Number(expert.consultation_fees) || 0;
        const courtFeeAmount = Number(expert.court_fees) || 0;
        
        // Determine if court fees were used (could be stored in matter_type or a dedicated field)
        // For now, we'll assume court fees are used for certain matter types
        const courtFeeUsed = appointment.matter_type?.toLowerCase().includes('court') || false;
        
        const totalDue = consultationFee + (courtFeeUsed ? courtFeeAmount : 0);
        
        // Calculate total paid from expert_payments table
        const appointmentPayments = expertPayments?.filter((p: any) => p.appointment_id === appointment.id) || [];
        const depositPaid = appointmentPayments.reduce((sum: number, p: any) => sum + Number(p.payment_amount), 0);
        const balanceDue = totalDue - depositPaid;
        
        // Get payment history
        const paymentHistory = appointmentPayments.map((p: any) => ({
          amount: Number(p.payment_amount),
          date: p.payment_date,
          recorded_by: p.recorded_by,
          notes: p.payment_notes
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

      setExpertsData(Array.from(expertMap.values()));
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

      // Insert payment into expert_payments table
      const { error: insertError } = await supabase
        .from("expert_payments")
        .insert({
          appointment_id: selectedAppointmentId,
          expert_id: selectedExpertId,
          payment_amount: amount,
          payment_date: new Date().toISOString(),
          payment_notes: paymentNotes || null,
          recorded_by: user.id,
        });

      if (insertError) throw insertError;

      // Log to audit trail
      await supabase.rpc('log_audit_trail', {
        p_table_name: 'expert_payments',
        p_record_id: selectedAppointmentId,
        p_action_type: 'INSERT',
        p_function_area: 'expert_payment',
        p_new_values: { 
          payment_amount: amount,
          payment_date: new Date().toISOString(),
          payment_notes: paymentNotes,
        },
        p_description: `Payment of R${amount} recorded for expert ${selectedExpertId}`,
      });

      toast.success("Payment recorded successfully");
      setShowPaymentDialog(false);
      setPaymentAmount("");
      setPaymentNotes("");
      setSelectedAppointmentId(null);
      setSelectedExpertId(null);
      fetchExpertPaymentData();
    } catch (error: any) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment: " + error.message);
    }
  };

  const handleDownloadPDF = (expertData: ExpertPaymentData) => {
    try {
      const doc = new jsPDF();
      
      // Add header
      doc.setFontSize(20);
      doc.text('Expert Payment Statement', 14, 20);
      
      doc.setFontSize(12);
      doc.text('Expert: ' + expertData.expert_name, 14, 30);
      doc.text('Expert Type: ' + expertData.expert_type, 14, 37);
      doc.text('Statement Date: ' + format(new Date(), 'dd MMM yyyy'), 14, 44);
      
      // Add summary section
      doc.setFontSize(10);
      doc.text('Summary', 14, 55);
      doc.text('Total Owed: R ' + expertData.total_owed.toLocaleString('en-ZA', { minimumFractionDigits: 2 }), 14, 62);
      doc.text('Deposit Received: R ' + expertData.total_deposit.toLocaleString('en-ZA', { minimumFractionDigits: 2 }), 14, 69);
      doc.text('Balance Due: R ' + expertData.total_balance.toLocaleString('en-ZA', { minimumFractionDigits: 2 }), 14, 76);
      
      // Create table data
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
      
      // Add table
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
      
      // Save the PDF
      const fileName = 'Expert_Statement_' + expertData.expert_name.replace(/\s+/g, '_') + '_' + format(new Date(), 'yyyyMMdd') + '.pdf';
      doc.save(fileName);
      
      toast.success('PDF statement downloaded successfully');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF statement');
    }
  };

  const handleSendStatement = async (toEmail: string, ccEmails: string, subject: string, message: string, pdfBase64: string) => {
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
          appointments: selectedExpertForEmail.appointments,
          totalOwed: selectedExpertForEmail.total_owed,
          totalDeposit: selectedExpertForEmail.total_deposit,
          totalBalance: selectedExpertForEmail.total_balance,
        },
      });

      if (error) throw error;

      toast.success('Statement sent to ' + selectedExpertForEmail.expert_name);
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

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      paid: "default",
      pending: "secondary",
      overdue: "destructive",
    };

    return (
      <Badge variant={variants[status] || "secondary"}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading expert payment data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Expert Credit Control - Track Expert Payments</title>
        <meta 
          name="description" 
          content="Track amounts owed to medical experts - Total Due, Deposit Received, and Balance Due for each appointment." 
        />
      </Helmet>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <h1 className="text-3xl font-bold text-foreground mb-2">Expert Credit Control</h1>
          <p className="text-muted-foreground">
            Track what is owed to medical experts per booked appointment - Total Due, Deposit Received, and Balance Due
          </p>

          {/* Search Bar */}
          <div className="mt-6 max-w-md relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search expert by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10"
            />
          </div>
        </div>

        <div className="grid gap-6">
          {filteredExperts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  {searchQuery ? `No experts found matching "${searchQuery}"` : 'No expert payment data available'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredExperts.map((expert) => (
            <Card key={expert.expert_id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{expert.expert_name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{expert.expert_type}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleDownloadPDF(expert)}
                      size="sm"
                      variant="outline"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                  <Button
                    onClick={() => handleOpenEmailPreview(expert)}
                    disabled={sendingEmail}
                    size="sm"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send Statement
                  </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4 mb-3">
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Consultation Fee</p>
                    <p className="text-sm font-semibold text-foreground">
                      R {expert.consultation_fees.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Court Fee (if applicable)</p>
                    <p className="text-sm font-semibold text-foreground">
                      R {expert.court_fees.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Owed to Expert</p>
                    <p className="text-lg font-bold text-foreground">
                      R {expert.total_owed.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Deposit Received</p>
                    <p className="text-lg font-bold text-blue-600">
                      R {expert.total_deposit.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Balance Due</p>
                    <p className="text-lg font-bold text-destructive">
                      R {expert.total_balance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Claimant</TableHead>
                      <TableHead>Consultation Fee</TableHead>
                      <TableHead>Court Fee</TableHead>
                      <TableHead>Total Due</TableHead>
                      <TableHead>Deposit</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Update</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expert.appointments.map((appointment) => (
                      <TableRow key={appointment.appointment_id}>
                        <TableCell>
                          {format(new Date(appointment.appointment_date), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>{appointment.claimant_name}</TableCell>
                        <TableCell>
                          R {appointment.consultation_fee.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {appointment.court_fee_used ? (
                            <span className="text-foreground">
                              R {appointment.court_fee_amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold">
                          R {appointment.total_due.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-blue-600">
                          R {appointment.deposit_paid.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-destructive">
                          R {appointment.balance_due.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {getPaymentStatusBadge(appointment.payment_status)}
                        </TableCell>
                        <TableCell>
                          {appointment.payment_updated_at ? (
                            <div className="flex flex-col gap-1 text-xs">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(appointment.payment_updated_at), 'dd MMM yyyy')}
                              </div>
                              <span className="text-muted-foreground">
                                {format(new Date(appointment.payment_updated_at), 'HH:mm')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedAppointmentId(appointment.appointment_id);
                              setSelectedExpertId(expert.expert_id);
                              setPaymentAmount("");
                              setPaymentNotes("");
                              setShowPaymentDialog(true);
                            }}
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Record Payment
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
          )}
        </div>
      </main>

      <CompanyFooter />

      {/* Email Preview Dialog */}
      <ExpertStatementPreviewDialog
        open={showEmailPreview}
        onOpenChange={setShowEmailPreview}
        expertData={selectedExpertForEmail}
        onSend={handleSendStatement}
      />

      {/* Record Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Expert Payment</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
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
              />
            </div>

            <div className="text-xs text-muted-foreground">
              Payment will be recorded with current timestamp: {format(new Date(), 'dd MMM yyyy HH:mm')}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowPaymentDialog(false);
                setPaymentAmount("");
                setPaymentNotes("");
                setSelectedAppointmentId(null);
                setSelectedExpertId(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleRecordPayment}>
              Record Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpertCreditControl;
