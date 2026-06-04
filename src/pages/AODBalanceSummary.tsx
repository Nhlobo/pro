import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, TrendingUp, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CompanyFooter from "@/components/CompanyFooter";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";

import { RandSign } from "@/components/icons/RandSign";
interface AODBalance {
  id: string;
  file_name: string;
  contract_description: string;
  total_contract_value: number;
  deposit_amount: number;
  total_paid: number;
  outstanding_balance: number;
  payment_status: string;
  total_reports_agreed: number;
  reports_taken_out: number;
  contract_start_date: string;
  contract_end_date: string;
  last_payment_date: string | null;
  attorney_name: string;
  assessment_count: number;
  claimant_details: string;
}

const AODBalanceSummary = () => {
  const [balances, setBalances] = useState<AODBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalOwed: 0,
    totalContracts: 0,
    totalReportsAgreed: 0,
    reportsTakenOut: 0,
  });
  const { toast } = useToast();
  const { lastUpdate } = useAppointmentSync();

  useEffect(() => {
    fetchBalanceData();
  }, [lastUpdate]);

  const fetchBalanceData = async () => {
    try {
      setLoading(true);

      // Get current user's referring attorney ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("referring_attorney_id")
        .eq("id", user.id)
        .single();

      if (!profile?.referring_attorney_id) {
        throw new Error("No referring attorney associated with your account");
      }

      // Fetch AOD documents with attorney info
      const { data: aodDocs, error: aodError } = await supabase
        .from("aod_documents")
        .select(`
          *,
          referring_attorneys!inner(name, contact_person)
        `)
        .eq("referring_attorney_id", profile.referring_attorney_id)
        .order("created_at", { ascending: false });

      if (aodError) throw aodError;

      // Fetch payments and related data for each AOD document
      const balanceData: AODBalance[] = [];
      let totalOwed = 0;
      let totalReportsAgreed = 0;
      let reportsTakenOut = 0;

      for (const doc of aodDocs || []) {
        const { data: payments } = await supabase
          .from("aod_payments")
          .select("payment_amount")
          .eq("aod_document_id", doc.id);

        // Extract appointment ID from notes (format: "APPOINTMENT:{id}")
        const appointmentMatch = doc.notes?.match(/APPOINTMENT:([a-f0-9-]+)/i);
        const specificAppointmentId = appointmentMatch ? appointmentMatch[1] : null;

        // Count ONLY the specific linked appointment (individual transaction)
        let claimantSummary = "No scheduled appointment linked";
        let assessmentCount = 0;

        if (specificAppointmentId) {
          // Get the specific linked appointment details
          const { data: appointment } = await supabase
            .from("appointments")
            .select(`
              id,
              appointment_date,
              case_status,
              claimants!inner(auto_id, first_name, last_name)
            `)
            .eq("id", specificAppointmentId)
            .in("case_status", ["scheduled", "assessed"])
            .is("deleted_at", null)
            .single();

          if (appointment) {
            const claimant = appointment.claimants;
            claimantSummary = `${claimant.auto_id} - ${claimant.first_name} ${claimant.last_name}`;
            assessmentCount = 1; // Only 1 assessment per AOD (individual transaction)
          }
        }

        const totalPaid = payments?.reduce((sum, p) => sum + Number(p.payment_amount || 0), 0) || 0;
        const outstandingBalance = Number(doc.total_contract_value || 0) - Number(doc.deposit_amount || 0) - totalPaid;

        balanceData.push({
          id: doc.id,
          file_name: doc.file_name,
          contract_description: doc.contract_description || "N/A",
          total_contract_value: Number(doc.total_contract_value || 0),
          deposit_amount: Number(doc.deposit_amount || 0),
          total_paid: totalPaid,
          outstanding_balance: outstandingBalance,
          payment_status: doc.payment_status || "pending",
          total_reports_agreed: doc.total_reports_agreed || 0,
          reports_taken_out: doc.payments_made || 0,
          contract_start_date: doc.contract_start_date || "N/A",
          contract_end_date: doc.contract_end_date || "N/A",
          last_payment_date: doc.last_payment_date,
          attorney_name: (doc as any).referring_attorneys?.name || "Unknown",
          assessment_count: assessmentCount,
          claimant_details: claimantSummary,
        });

        totalOwed += outstandingBalance;
        totalReportsAgreed += doc.total_reports_agreed || 0;
        reportsTakenOut += doc.payments_made || 0;
      }

      setBalances(balanceData);
      setSummary({
        totalOwed,
        totalContracts: balanceData.length,
        totalReportsAgreed,
        reportsTakenOut,
      });
    } catch (error: any) {
      console.error("Error fetching balance data:", error);
      toast({
        title: "Error Loading Data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      paid: { variant: "default", label: "Paid" },
      pending: { variant: "secondary", label: "Pending" },
      overdue: { variant: "destructive", label: "Overdue" },
    };

    const config = statusMap[status.toLowerCase()] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <>
      <Helmet>
        <title>AOD Balance Summary - Medico-Legal Management</title>
        <meta name="description" content="View your AOD balance and payment summary" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/aod-management">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to AOD Management
                </Button>
              </Link>
              <h1 className="text-3xl font-bold text-foreground">AOD Balance Summary</h1>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
                <RandSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">R{summary.totalOwed.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Amount owed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Contracts</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalContracts}</div>
                <p className="text-xs text-muted-foreground">AOD agreements</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reports Agreed</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalReportsAgreed}</div>
                <p className="text-xs text-muted-foreground">Total reports</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reports Taken</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.reportsTakenOut}</div>
                <p className="text-xs text-muted-foreground">Completed reports</p>
              </CardContent>
            </Card>
          </div>

          {/* Balance Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>AOD Contracts</CardTitle>
              <CardDescription>
                Detailed breakdown of your AOD agreements and outstanding balances
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-muted-foreground">Loading balance data...</div>
              ) : balances.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No AOD contracts found for your account
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Attorney & Contract</TableHead>
                        <TableHead>Linked Assessment & Claimant</TableHead>
                        <TableHead className="text-right">Total Value</TableHead>
                        <TableHead className="text-right">Deposit</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Reports</TableHead>
                        <TableHead>Contract Period</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balances.map((balance) => (
                        <TableRow key={balance.id}>
                          <TableCell className="font-medium">
                            <div className="space-y-1">
                              <div className="font-semibold text-foreground">{balance.attorney_name}</div>
                              <div className="text-sm">{balance.contract_description}</div>
                              <div className="text-xs text-muted-foreground">{balance.file_name}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-primary">
                                {balance.assessment_count === 1 ? "1 Assessment" : "No Assessment"}
                              </div>
                              <div className="text-xs text-muted-foreground max-w-[200px] truncate" title={balance.claimant_details}>
                                {balance.claimant_details}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">R{balance.total_contract_value.toFixed(2)}</TableCell>
                          <TableCell className="text-right">R{balance.deposit_amount.toFixed(2)}</TableCell>
                          <TableCell className="text-right">R{balance.total_paid.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            R{balance.outstanding_balance.toFixed(2)}
                          </TableCell>
                          <TableCell>{getStatusBadge(balance.payment_status)}</TableCell>
                          <TableCell className="text-center">
                            {balance.reports_taken_out} / {balance.total_reports_agreed}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{balance.contract_start_date}</div>
                              <div className="text-muted-foreground">to {balance.contract_end_date}</div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <CompanyFooter />
      </div>
    </>
  );
};

export default AODBalanceSummary;
