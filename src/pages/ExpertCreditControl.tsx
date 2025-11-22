import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Mail, DollarSign, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import CompanyFooter from "@/components/CompanyFooter";

interface ExpertPaymentData {
  expert_id: string;
  expert_name: string;
  expert_email: string;
  expert_type: string;
  appointments: {
    appointment_id: string;
    appointment_date: string;
    claimant_name: string;
    service_fee: number;
    paid_amount: number;
    balance_due: number;
    payment_status: string;
    last_payment_date?: string;
    payment_history: {
      amount: number;
      date: string;
      recorded_by: string;
    }[];
  }[];
  total_owed: number;
  total_paid: number;
  total_balance: number;
}

const ExpertCreditControl = () => {
  const navigate = useNavigate();
  const [expertsData, setExpertsData] = useState<ExpertPaymentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExpert, setSelectedExpert] = useState<ExpertPaymentData | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    fetchExpertPaymentData();
  }, []);

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
          service_fee,
          payment_status,
          payment_date,
          appointment_date
        `)
        .not('service_fee', 'is', null);

      if (appointmentsError) throw appointmentsError;

      // Fetch experts
      const { data: experts, error: expertsError } = await supabase
        .rpc('get_medical_experts_secure');

      if (expertsError) throw expertsError;

      // Fetch claimants
      const { data: claimants, error: claimantsError } = await supabase
        .from("claimants")
        .select("id, first_name, last_name");

      if (claimantsError) throw claimantsError;

      // Group appointments by expert
      const expertMap = new Map<string, ExpertPaymentData>();

      appointments?.forEach((appointment) => {
        const expert = experts?.find((e: any) => e.id === appointment.expert_id);
        const claimant = claimants?.find((c) => c.id === appointment.claimant_id);

        if (!expert) return;

        const expertKey = appointment.expert_id;
        const serviceFee = Number(appointment.service_fee) || 0;
        const paidAmount = appointment.payment_status === 'paid' ? serviceFee : 0;
        const balanceDue = serviceFee - paidAmount;

        if (!expertMap.has(expertKey)) {
          expertMap.set(expertKey, {
            expert_id: appointment.expert_id,
            expert_name: `${expert.first_name} ${expert.last_name}`,
            expert_email: expert.email_masked || '',
            expert_type: expert.expert_type,
            appointments: [],
            total_owed: 0,
            total_paid: 0,
            total_balance: 0,
          });
        }

        const expertData = expertMap.get(expertKey)!;
        expertData.appointments.push({
          appointment_id: appointment.id,
          appointment_date: appointment.appointment_date,
          claimant_name: claimant ? `${claimant.first_name} ${claimant.last_name}` : 'Unknown',
          service_fee: serviceFee,
          paid_amount: paidAmount,
          balance_due: balanceDue,
          payment_status: appointment.payment_status || 'pending',
          last_payment_date: appointment.payment_date,
          payment_history: [],
        });

        expertData.total_owed += serviceFee;
        expertData.total_paid += paidAmount;
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
    if (!selectedAppointmentId || !paymentAmount || !selectedExpert) {
      toast.error("Please enter payment amount");
      return;
    }

    try {
      const amount = parseFloat(paymentAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error("Invalid payment amount");
        return;
      }

      // Update appointment payment status
      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          payment_status: 'paid',
          payment_date: new Date().toISOString(),
        })
        .eq('id', selectedAppointmentId);

      if (updateError) throw updateError;

      // Log to audit trail
      await supabase.rpc('log_audit_trail', {
        p_table_name: 'appointments',
        p_record_id: selectedAppointmentId,
        p_action_type: 'UPDATE',
        p_function_area: 'expert_payment',
        p_new_values: { payment_amount: amount, payment_date: new Date().toISOString() },
        p_description: `Payment of R${amount} recorded for expert ${selectedExpert.expert_name}`,
      });

      toast.success("Payment recorded successfully");
      setShowPaymentDialog(false);
      setPaymentAmount("");
      setSelectedAppointmentId(null);
      fetchExpertPaymentData();
    } catch (error: any) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment");
    }
  };

  const handleSendStatement = async (expertData: ExpertPaymentData) => {
    try {
      setSendingEmail(true);

      const { error } = await supabase.functions.invoke('send-expert-statement', {
        body: {
          expertId: expertData.expert_id,
          expertName: expertData.expert_name,
          expertEmail: expertData.expert_email,
          appointments: expertData.appointments,
          totalOwed: expertData.total_owed,
          totalPaid: expertData.total_paid,
          totalBalance: expertData.total_balance,
        },
      });

      if (error) throw error;

      toast.success(`Statement sent to ${expertData.expert_name}`);
    } catch (error: any) {
      console.error("Error sending statement:", error);
      toast.error("Failed to send statement email");
    } finally {
      setSendingEmail(false);
    }
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
        <title>Expert Credit Control - Payment Tracking</title>
        <meta 
          name="description" 
          content="Manage and track medical expert payments with timestamps and send payment statements." 
        />
      </Helmet>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <h1 className="text-3xl font-bold text-foreground mb-2">Expert Credit Control</h1>
          <p className="text-muted-foreground">
            Manage and track payments for medical experts per booked appointment
          </p>
        </div>

        <div className="grid gap-6">
          {expertsData.map((expert) => (
            <Card key={expert.expert_id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{expert.expert_name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{expert.expert_type}</p>
                  </div>
                  <Button
                    onClick={() => handleSendStatement(expert)}
                    disabled={sendingEmail}
                    size="sm"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send Statement
                  </Button>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Owed</p>
                    <p className="text-lg font-bold text-foreground">
                      R {expert.total_owed.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Paid</p>
                    <p className="text-lg font-bold text-green-600">
                      R {expert.total_paid.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
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
                      <TableHead>Service Fee</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Payment</TableHead>
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
                          R {appointment.service_fee.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-green-600">
                          R {appointment.paid_amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-destructive">
                          R {appointment.balance_due.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {getPaymentStatusBadge(appointment.payment_status)}
                        </TableCell>
                        <TableCell>
                          {appointment.last_payment_date ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="h-3 w-3" />
                              {format(new Date(appointment.last_payment_date), 'dd MMM yyyy')}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not paid</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {appointment.payment_status !== 'paid' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedExpert(expert);
                                setSelectedAppointmentId(appointment.appointment_id);
                                setPaymentAmount(appointment.balance_due.toString());
                                setShowPaymentDialog(true);
                              }}
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Record Payment
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <CompanyFooter />

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Enter payment amount for {selectedExpert?.expert_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Payment Amount (R)</label>
              <Input
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
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
