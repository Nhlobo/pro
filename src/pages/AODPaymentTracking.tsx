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
import { ArrowLeft, Plus, DollarSign, FileText, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import CompanyFooter from "@/components/CompanyFooter";
import { format } from "date-fns";

interface AODDocument {
  id: string;
  file_name: string;
  attorney_id: string;
  total_contract_value: number | null;
  deposit_amount: number | null;
  payments_made: number;
  contract_description: string | null;
  total_reports_agreed: number | null;
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

export default function AODPaymentTracking() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<AODDocument | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentType, setPaymentType] = useState<'deposit' | 'regular' | 'final'>('regular');
  const [reportsTakenOut, setReportsTakenOut] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentNotes, setPaymentNotes] = useState("");

  useEffect(() => {
    fetchDocumentAndPayments();
  }, [documentId]);

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

    try {
      const { error } = await supabase
        .from("aod_payments")
        .insert({
          aod_document_id: documentId,
          payment_amount: amount,
          payment_type: paymentType,
          payment_date: paymentDate,
          reports_taken_out: reports,
          payment_notes: paymentNotes || null,
        });

      if (error) throw error;

      toast.success("Payment recorded successfully");
      
      // Reset form
      setPaymentAmount("");
      setPaymentType('regular');
      setReportsTakenOut("");
      setPaymentNotes("");
      setShowAddPayment(false);
      
      // Refresh data
      fetchDocumentAndPayments();
    } catch (error: any) {
      console.error("Error adding payment:", error);
      toast.error("Failed to record payment");
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

      toast.success("Payment updated successfully");
      
      // Reset form
      setPaymentAmount("");
      setPaymentType('regular');
      setReportsTakenOut("");
      setPaymentNotes("");
      setShowAddPayment(false);
      setEditingPayment(null);
      
      // Refresh data
      fetchDocumentAndPayments();
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
      const { error } = await supabase
        .from("aod_payments")
        .delete()
        .eq("id", deletePaymentId);

      if (error) throw error;

      toast.success("Payment deleted successfully");
      setDeletePaymentId(null);
      
      // Refresh data
      fetchDocumentAndPayments();
    } catch (error: any) {
      console.error("Error deleting payment:", error);
      toast.error("Failed to delete payment");
    }
  };

  // Include initial deposit from contract plus any deposit payments
  const initialDeposit = document?.deposit_amount || 0;
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
              </CardContent>
            </Card>
          </div>

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
                      <Label htmlFor="reports">Reports Taken Out</Label>
                      <Input
                        id="reports"
                        type="number"
                        value={reportsTakenOut}
                        onChange={(e) => setReportsTakenOut(e.target.value)}
                        placeholder="0"
                      />
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
                  <div className="flex gap-2">
                    <Button onClick={editingPayment ? handleUpdatePayment : handleAddPayment}>
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
