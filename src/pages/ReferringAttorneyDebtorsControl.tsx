import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, DollarSign, Clock, Search, Download, Filter, TrendingUp, Users, FileText, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import CompanyFooter from "@/components/CompanyFooter";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface AttorneyAppointment {
  appointment_id: string;
  appointment_date: string;
  claimant_name: string;
  claimant_auto_id: string;
  expert_name: string;
  expert_type: string;
  matter_type: string;
  service_fee: number;
  deposit_amount: number;
  balance_due: number;
  payment_status: string;
  case_status: string;
  report_status: string;
}

interface AODData {
  id: string;
  total_contract_value: number;
  payments_made: number;
  deposit_amount: number;
  balance: number;
  payment_status: string;
  agreement_type: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
  total_reports_agreed: number;
  reports_released: number;
}

interface ShortTermData {
  id: string;
  total_contract_value: number;
  deposit_amount: number;
  payments_made: number;
  balance: number;
  payment_status: string;
  contract_start_date: string;
  contract_end_date: string;
  total_reports_agreed: number;
  reports_completed: number;
}

interface AttorneyDebtorData {
  attorney_id: string;
  attorney_name: string;
  contact_person: string;
  email: string;
  appointments: AttorneyAppointment[];
  aod_documents: AODData[];
  short_term_agreements: ShortTermData[];
  total_service_fees: number;
  total_deposits: number;
  total_aod_value: number;
  total_aod_payments: number;
  total_short_term_value: number;
  total_short_term_payments: number;
  total_owed: number;
  total_paid: number;
  total_balance: number;
}

const ReferringAttorneyDebtorsControl = () => {
  const navigate = useNavigate();
  const [attorneysData, setAttorneysData] = useState<AttorneyDebtorData[]>([]);
  const [filteredAttorneys, setFilteredAttorneys] = useState<AttorneyDebtorData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "owing" | "paid">("all");
  const [loading, setLoading] = useState(true);
  const [expandedAttorney, setExpandedAttorney] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    fetchDebtorsData();
  }, []);

  useEffect(() => {
    let filtered = attorneysData;

    if (searchQuery.trim()) {
      filtered = filtered.filter(a =>
        a.attorney_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.contact_person.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter === "owing") {
      filtered = filtered.filter(a => a.total_balance > 0);
    } else if (statusFilter === "paid") {
      filtered = filtered.filter(a => a.total_balance <= 0);
    }

    setFilteredAttorneys(filtered);
  }, [searchQuery, statusFilter, attorneysData]);

  const fetchDebtorsData = async () => {
    try {
      setLoading(true);

      // Fetch all referring attorneys (exclude system companies)
      const { data: attorneys, error: attError } = await supabase
        .from("referring_attorneys")
        .select("id, name, contact_person, email, is_system_company")
        .order("name");

      if (attError) throw attError;

      const validAttorneys = (attorneys || []).filter(a => !a.is_system_company);

      // Fetch appointments with claimant and expert data
      const { data: appointments, error: aptError } = await supabase
        .from("appointments")
        .select(`
          id, appointment_date, case_status, service_fee, payment_status,
          deposit_amount, matter_type, referring_attorney_id,
          claimants!inner (first_name, last_name, auto_id),
          medical_experts!inner (first_name, last_name, expert_type)
        `)
        .is("deleted_at", null);

      if (aptError) throw aptError;

      // Fetch expert reports for report status
      const { data: reports, error: repError } = await supabase
        .from("expert_reports")
        .select("appointment_id, report_status");

      if (repError) throw repError;

      // Fetch AOD documents
      const { data: aodDocs, error: aodError } = await supabase
        .from("aod_documents")
        .select("*");

      if (aodError) throw aodError;

      // Fetch short-term agreements
      const { data: shortTerms, error: stError } = await supabase
        .from("short_term_agreements")
        .select("*");

      if (stError) throw stError;

      // Build attorney data map
      const attorneyMap = new Map<string, AttorneyDebtorData>();

      validAttorneys.forEach(att => {
        attorneyMap.set(att.id, {
          attorney_id: att.id,
          attorney_name: att.name,
          contact_person: att.contact_person || "",
          email: att.email || "",
          appointments: [],
          aod_documents: [],
          short_term_agreements: [],
          total_service_fees: 0,
          total_deposits: 0,
          total_aod_value: 0,
          total_aod_payments: 0,
          total_short_term_value: 0,
          total_short_term_payments: 0,
          total_owed: 0,
          total_paid: 0,
          total_balance: 0,
        });
      });

      // Process appointments
      appointments?.forEach(apt => {
        const attorney = attorneyMap.get(apt.referring_attorney_id);
        if (!attorney) return;

        const claimant = Array.isArray(apt.claimants) ? apt.claimants[0] : apt.claimants;
        const expert = Array.isArray(apt.medical_experts) ? apt.medical_experts[0] : apt.medical_experts;
        const report = reports?.find(r => r.appointment_id === apt.id);
        const serviceFee = Number(apt.service_fee || 0);
        const deposit = Number(apt.deposit_amount || 0);
        const balance = Math.max(0, serviceFee - deposit);

        attorney.appointments.push({
          appointment_id: apt.id,
          appointment_date: apt.appointment_date,
          claimant_name: claimant ? `${claimant.first_name} ${claimant.last_name}` : "Unknown",
          claimant_auto_id: claimant?.auto_id || "N/A",
          expert_name: expert ? `${expert.first_name} ${expert.last_name}` : "Unknown",
          expert_type: expert?.expert_type || "Unknown",
          matter_type: apt.matter_type || "N/A",
          service_fee: serviceFee,
          deposit_amount: deposit,
          balance_due: balance,
          payment_status: apt.payment_status || "pending",
          case_status: apt.case_status || "scheduled",
          report_status: report?.report_status || "not_received",
        });

        attorney.total_service_fees += serviceFee;
        attorney.total_deposits += deposit;
      });

      // Consolidate AOD documents per attorney (one consolidated contract per attorney)
      const aodByAttorney = new Map<string, typeof aodDocs>();
      aodDocs?.forEach(doc => {
        if (!aodByAttorney.has(doc.referring_attorney_id)) {
          aodByAttorney.set(doc.referring_attorney_id, []);
        }
        aodByAttorney.get(doc.referring_attorney_id)!.push(doc);
      });

      aodByAttorney.forEach((docs, attorneyId) => {
        const attorney = attorneyMap.get(attorneyId);
        if (!attorney) return;

        // Consolidate: use highest contract value, sum all payments/deposits/reports
        const maxContractValue = Math.max(...docs.map(d => Number(d.total_contract_value || 0)));
        const totalPaymentsMade = docs.reduce((s, d) => s + Number(d.payments_made || 0), 0);
        const totalDepositAmt = docs.reduce((s, d) => s + Number(d.deposit_amount || 0), 0);
        const totalReportsAgreed = Math.max(...docs.map(d => Number(d.total_reports_agreed || 0)));
        const totalReportsReleased = docs.reduce((s, d) => s + Number(d.reports_released || 0), 0);
        const aodBalance = Math.max(0, maxContractValue - totalPaymentsMade - totalDepositAmt);

        // Determine consolidated status
        const latestDoc = docs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
        const consolidatedStatus = aodBalance <= 0 ? "paid" : (totalPaymentsMade + totalDepositAmt > 0 ? "partial" : (latestDoc.payment_status || "pending"));

        // Find earliest start and latest end dates
        const startDates = docs.map(d => d.contract_start_date).filter(Boolean) as string[];
        const endDates = docs.map(d => d.contract_end_date).filter(Boolean) as string[];

        attorney.aod_documents.push({
          id: latestDoc.id,
          total_contract_value: maxContractValue,
          payments_made: totalPaymentsMade,
          deposit_amount: totalDepositAmt,
          balance: aodBalance,
          payment_status: consolidatedStatus,
          agreement_type: latestDoc.agreement_type || "Standard",
          contract_start_date: startDates.length > 0 ? startDates.sort()[0] : null,
          contract_end_date: endDates.length > 0 ? endDates.sort().reverse()[0] : null,
          total_reports_agreed: totalReportsAgreed,
          reports_released: totalReportsReleased,
        });

        attorney.total_aod_value += maxContractValue;
        attorney.total_aod_payments += totalPaymentsMade + totalDepositAmt;
      });

      // Consolidate short-term agreements per attorney (one consolidated contract per attorney)
      const stByAttorney = new Map<string, typeof shortTerms>();
      shortTerms?.forEach(st => {
        if (!stByAttorney.has(st.referring_attorney_id)) {
          stByAttorney.set(st.referring_attorney_id, []);
        }
        stByAttorney.get(st.referring_attorney_id)!.push(st);
      });

      stByAttorney.forEach((sts, attorneyId) => {
        const attorney = attorneyMap.get(attorneyId);
        if (!attorney) return;

        // Consolidate: use highest contract value, sum all payments/deposits
        const maxContractValue = Math.max(...sts.map(s => Number(s.total_contract_value || 0)));
        const totalDepositAmt = sts.reduce((s, st) => s + Number(st.deposit_amount || 0), 0);
        const totalPaymentsMade = sts.reduce((s, st) => s + Number(st.payments_made || 0), 0);
        const totalReportsAgreed = Math.max(...sts.map(s => Number(s.total_reports_agreed || 0)));
        const totalReportsCompleted = sts.reduce((s, st) => s + Number(st.reports_completed || 0), 0);
        const stBalance = Math.max(0, maxContractValue - totalPaymentsMade - totalDepositAmt);

        const latestSt = sts.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
        const consolidatedStatus = stBalance <= 0 ? "paid" : (totalPaymentsMade + totalDepositAmt > 0 ? "partial" : (latestSt.payment_status || "pending"));

        const startDates = sts.map(s => s.contract_start_date).filter(Boolean) as string[];
        const endDates = sts.map(s => s.contract_end_date).filter(Boolean) as string[];

        attorney.short_term_agreements.push({
          id: latestSt.id,
          total_contract_value: maxContractValue,
          deposit_amount: totalDepositAmt,
          payments_made: totalPaymentsMade,
          balance: stBalance,
          payment_status: consolidatedStatus,
          contract_start_date: startDates.length > 0 ? startDates.sort()[0] : "",
          contract_end_date: endDates.length > 0 ? endDates.sort().reverse()[0] : "",
          total_reports_agreed: totalReportsAgreed,
          reports_completed: totalReportsCompleted,
        });

        attorney.total_short_term_value += maxContractValue;
        attorney.total_short_term_payments += totalPaymentsMade + totalDepositAmt;
      });

      // Calculate totals
      attorneyMap.forEach(attorney => {
        attorney.total_owed = attorney.total_service_fees + attorney.total_aod_value + attorney.total_short_term_value;
        attorney.total_paid = attorney.total_deposits + attorney.total_aod_payments + attorney.total_short_term_payments;
        attorney.total_balance = Math.max(0, attorney.total_owed - attorney.total_paid);
      });

      // Filter out attorneys with no data
      const sortedData = Array.from(attorneyMap.values())
        .filter(a => a.appointments.length > 0 || a.aod_documents.length > 0 || a.short_term_agreements.length > 0)
        .sort((a, b) => b.total_balance - a.total_balance);

      setAttorneysData(sortedData);
    } catch (error: any) {
      console.error("Error fetching debtors data:", error);
      toast.error("Failed to load debtors control data");
    } finally {
      setLoading(false);
    }
  };

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalOwed = attorneysData.reduce((sum, a) => sum + a.total_owed, 0);
    const totalPaid = attorneysData.reduce((sum, a) => sum + a.total_paid, 0);
    const totalBalance = attorneysData.reduce((sum, a) => sum + a.total_balance, 0);
    const owingCount = attorneysData.filter(a => a.total_balance > 0).length;
    return { totalOwed, totalPaid, totalBalance, owingCount, totalAttorneys: attorneysData.length };
  }, [attorneysData]);

  const chartData = useMemo(() => [
    { name: "Total Invoiced", value: summaryStats.totalOwed, color: "hsl(var(--primary))" },
    { name: "Total Paid", value: summaryStats.totalPaid, color: "hsl(var(--chart-2))" },
    { name: "Outstanding", value: summaryStats.totalBalance, color: "hsl(var(--destructive))" },
  ], [summaryStats]);

  const formatCurrency = (amount: number) =>
    `R ${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;

  const getPaymentBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      paid: "default", partial: "secondary", pending: "outline", overdue: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const handleDownloadPDF = (attorney: AttorneyDebtorData) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Debtors Control Statement", 14, 20);
    doc.setFontSize(11);
    doc.text(`Attorney: ${attorney.attorney_name}`, 14, 30);
    doc.text(`Contact: ${attorney.contact_person}`, 14, 37);
    doc.text(`Date: ${format(new Date(), "dd MMM yyyy")}`, 14, 44);

    doc.setFontSize(10);
    doc.text(`Total Invoiced: ${formatCurrency(attorney.total_owed)}`, 14, 55);
    doc.text(`Total Paid: ${formatCurrency(attorney.total_paid)}`, 14, 62);
    doc.text(`Balance Outstanding: ${formatCurrency(attorney.total_balance)}`, 14, 69);

    // Appointments table
    if (attorney.appointments.length > 0) {
      doc.setFontSize(12);
      doc.text("Scheduled Assessments", 14, 82);
      autoTable(doc, {
        startY: 87,
        head: [["Date", "Claimant", "Expert", "Fee", "Deposit", "Balance", "Status"]],
        body: attorney.appointments.map(a => [
          format(new Date(a.appointment_date), "dd MMM yyyy"),
          a.claimant_name, a.expert_type,
          formatCurrency(a.service_fee), formatCurrency(a.deposit_amount),
          formatCurrency(a.balance_due), a.payment_status,
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [41, 128, 185] },
      });
    }

    // AOD table
    if (attorney.aod_documents.length > 0) {
      const y = (doc as any).lastAutoTable?.finalY || 90;
      doc.setFontSize(12);
      doc.text("AOD Agreements", 14, y + 12);
      autoTable(doc, {
        startY: y + 17,
        head: [["Type", "Contract Value", "Payments", "Balance", "Reports", "Released", "Status"]],
        body: attorney.aod_documents.map(a => [
          a.agreement_type, formatCurrency(a.total_contract_value),
          formatCurrency(a.payments_made + a.deposit_amount), formatCurrency(a.balance),
          a.total_reports_agreed.toString(), a.reports_released.toString(), a.payment_status,
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [39, 174, 96] },
      });
    }

    // Short-term table
    if (attorney.short_term_agreements.length > 0) {
      const y = (doc as any).lastAutoTable?.finalY || 90;
      doc.setFontSize(12);
      doc.text("Short-Term Agreements", 14, y + 12);
      autoTable(doc, {
        startY: y + 17,
        head: [["Period", "Contract Value", "Payments", "Balance", "Reports", "Completed", "Status"]],
        body: attorney.short_term_agreements.map(a => [
          `${format(new Date(a.contract_start_date), "MMM yy")} - ${format(new Date(a.contract_end_date), "MMM yy")}`,
          formatCurrency(a.total_contract_value),
          formatCurrency(a.payments_made + a.deposit_amount), formatCurrency(a.balance),
          a.total_reports_agreed.toString(), a.reports_completed.toString(), a.payment_status,
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [142, 68, 173] },
      });
    }

    doc.save(`Debtors_Statement_${attorney.attorney_name.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`);
    toast.success("PDF downloaded successfully");
  };

  const handleDownloadFullReport = () => {
    const doc = new jsPDF("landscape");
    doc.setFontSize(18);
    doc.text("Debtors Control - Full Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, 14, 28);
    doc.text(`Total Attorneys: ${summaryStats.totalAttorneys} | Owing: ${summaryStats.owingCount} | Outstanding: ${formatCurrency(summaryStats.totalBalance)}`, 14, 35);

    autoTable(doc, {
      startY: 42,
      head: [["Attorney", "Assessments", "AOD Value", "Short-Term Value", "Total Invoiced", "Total Paid", "Balance"]],
      body: filteredAttorneys.map(a => [
        a.attorney_name,
        formatCurrency(a.total_service_fees),
        formatCurrency(a.total_aod_value),
        formatCurrency(a.total_short_term_value),
        formatCurrency(a.total_owed),
        formatCurrency(a.total_paid),
        formatCurrency(a.total_balance),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      foot: [[
        "TOTALS", formatCurrency(summaryStats.totalOwed - attorneysData.reduce((s, a) => s + a.total_aod_value + a.total_short_term_value, 0)),
        formatCurrency(attorneysData.reduce((s, a) => s + a.total_aod_value, 0)),
        formatCurrency(attorneysData.reduce((s, a) => s + a.total_short_term_value, 0)),
        formatCurrency(summaryStats.totalOwed),
        formatCurrency(summaryStats.totalPaid),
        formatCurrency(summaryStats.totalBalance),
      ]],
      showFoot: "lastPage",
    });

    doc.save(`Debtors_Control_Full_Report_${format(new Date(), "yyyyMMdd")}.pdf`);
    toast.success("Full report downloaded");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading debtors control data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Debtors Control - Referring Attorney Debts</title>
        <meta name="description" content="Manage referring attorney debts linked to scheduled assessments, AOD agreements, and short-term payments." />
      </Helmet>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Debtors Control</h1>
              <p className="text-muted-foreground">
                Manage referring attorney debts — linked to Scheduled Assessments, AOD Agreements & Short-Term Agreements
              </p>
            </div>
            <Button onClick={handleDownloadFullReport} className="gap-2">
              <Download className="h-4 w-4" /> Download Full Report
            </Button>
          </div>

          {/* Search and Filter */}
          <div className="mt-6 flex flex-wrap gap-4 items-center">
            <div className="max-w-md relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search attorney by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Attorneys</SelectItem>
                  <SelectItem value="owing">With Outstanding Balance</SelectItem>
                  <SelectItem value="paid">Fully Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card className="bg-gradient-card border-border/50 shadow-soft">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><Users className="h-4 w-4" />Total Attorneys</div>
              <p className="text-2xl font-bold mt-1">{summaryStats.totalAttorneys}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50 shadow-soft">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><AlertTriangle className="h-4 w-4" />Owing</div>
              <p className="text-2xl font-bold mt-1 text-destructive">{summaryStats.owingCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50 shadow-soft">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><DollarSign className="h-4 w-4" />Total Invoiced</div>
              <p className="text-2xl font-bold mt-1">{formatCurrency(summaryStats.totalOwed)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50 shadow-soft">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><DollarSign className="h-4 w-4" />Total Paid</div>
              <p className="text-2xl font-bold mt-1 text-primary">{formatCurrency(summaryStats.totalPaid)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50 shadow-soft">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><AlertTriangle className="h-4 w-4" />Outstanding</div>
              <p className="text-2xl font-bold mt-1 text-destructive">{formatCurrency(summaryStats.totalBalance)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Financial Overview</CardTitle>
            <CardDescription>Total invoiced vs paid vs outstanding across all referring attorneys</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Attorney Cards */}
        <div className="grid gap-6">
          {filteredAttorneys.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  {searchQuery ? `No attorneys found matching "${searchQuery}"` : "No debtor data available"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredAttorneys.map((attorney) => (
              <Card key={attorney.attorney_id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{attorney.attorney_name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{attorney.contact_person} {attorney.email && `• ${attorney.email}`}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleDownloadPDF(attorney)} size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-2" /> PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedAttorney(expandedAttorney === attorney.attorney_id ? null : attorney.attorney_id)}
                      >
                        {expandedAttorney === attorney.attorney_id ? "Collapse" : "Expand"} Details
                      </Button>
                    </div>
                  </div>

                  {/* Summary row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">Total Invoiced</p>
                      <p className="text-lg font-bold text-foreground">{formatCurrency(attorney.total_owed)}</p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">Total Paid</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(attorney.total_paid)}</p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">Balance Outstanding</p>
                      <p className={`text-lg font-bold ${attorney.total_balance > 0 ? "text-destructive" : "text-primary"}`}>
                        {formatCurrency(attorney.total_balance)}
                      </p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">Sources</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {attorney.appointments.length > 0 && <Badge variant="outline" className="text-xs">Assessments: {attorney.appointments.length}</Badge>}
                        {attorney.aod_documents.length > 0 && <Badge variant="outline" className="text-xs">AOD: {attorney.aod_documents.length}</Badge>}
                        {attorney.short_term_agreements.length > 0 && <Badge variant="outline" className="text-xs">Short-Term: {attorney.short_term_agreements.length}</Badge>}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                {expandedAttorney === attorney.attorney_id && (
                  <CardContent className="space-y-6">
                    {/* Scheduled Assessments - grouped by claimant */}
                    {attorney.appointments.length > 0 && (() => {
                      // Group appointments by claimant name
                      const claimantGroups = new Map<string, AttorneyAppointment[]>();
                      attorney.appointments.forEach(apt => {
                        const key = apt.claimant_name;
                        if (!claimantGroups.has(key)) claimantGroups.set(key, []);
                        claimantGroups.get(key)!.push(apt);
                      });
                      const grouped = Array.from(claimantGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]));

                      return (
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <FileText className="h-4 w-4" /> Scheduled Assessments — {grouped.length} Claimant{grouped.length !== 1 ? "s" : ""}, {attorney.appointments.length} Assessment{attorney.appointments.length !== 1 ? "s" : ""}
                        </h4>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Claimant</TableHead>
                                <TableHead>Assessments</TableHead>
                                <TableHead>Date(s)</TableHead>
                                <TableHead>Expert(s)</TableHead>
                                <TableHead>Total Fee</TableHead>
                                <TableHead>Total Deposit</TableHead>
                                <TableHead>Balance</TableHead>
                                <TableHead>Payment</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {grouped.map(([claimantName, apts]) => {
                                const totalFee = apts.reduce((s, a) => s + a.service_fee, 0);
                                const totalDep = apts.reduce((s, a) => s + a.deposit_amount, 0);
                                const totalBal = apts.reduce((s, a) => s + a.balance_due, 0);
                                const allPaid = apts.every(a => a.payment_status === "paid");
                                const somePaid = apts.some(a => a.payment_status === "paid");

                                return (
                                  <TableRow key={claimantName}>
                                    <TableCell>
                                      <div className="font-medium">{claimantName}</div>
                                      <div className="text-xs text-muted-foreground">{apts[0].claimant_auto_id}</div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{apts.length}</Badge>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {apts.map(a => format(new Date(a.appointment_date), "dd MMM yyyy")).join(", ")}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {apts.map(a => a.expert_type).join(", ")}
                                    </TableCell>
                                    <TableCell className="font-medium">{formatCurrency(totalFee)}</TableCell>
                                    <TableCell className="text-primary">{formatCurrency(totalDep)}</TableCell>
                                    <TableCell className={totalBal > 0 ? "text-destructive font-semibold" : "text-primary"}>
                                      {formatCurrency(totalBal)}
                                    </TableCell>
                                    <TableCell>{getPaymentBadge(allPaid ? "paid" : somePaid ? "partial" : "pending")}</TableCell>
                                  </TableRow>
                                );
                              })}
                              <TableRow className="bg-muted/30 font-semibold">
                                <TableCell>Assessment Totals</TableCell>
                                <TableCell><Badge variant="outline">{attorney.appointments.length}</Badge></TableCell>
                                <TableCell colSpan={2} />
                                <TableCell>{formatCurrency(attorney.total_service_fees)}</TableCell>
                                <TableCell className="text-primary">{formatCurrency(attorney.total_deposits)}</TableCell>
                                <TableCell className="text-destructive">{formatCurrency(Math.max(0, attorney.total_service_fees - attorney.total_deposits))}</TableCell>
                                <TableCell />
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                      );
                    })()}

                    {/* AOD Agreements */}
                    {attorney.aod_documents.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <FileText className="h-4 w-4" /> AOD Agreements ({attorney.aod_documents.length})
                        </h4>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Type</TableHead>
                                <TableHead>Period</TableHead>
                                <TableHead>Contract Value</TableHead>
                                <TableHead>Payments + Deposits</TableHead>
                                <TableHead>Balance</TableHead>
                                <TableHead>Reports Agreed</TableHead>
                                <TableHead>Released</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {attorney.aod_documents.map(aod => (
                                <TableRow key={aod.id}>
                                  <TableCell>{aod.agreement_type}</TableCell>
                                  <TableCell className="text-sm">
                                    {aod.contract_start_date ? format(new Date(aod.contract_start_date), "MMM yy") : "—"}
                                    {aod.contract_end_date ? ` - ${format(new Date(aod.contract_end_date), "MMM yy")}` : ""}
                                  </TableCell>
                                  <TableCell className="font-medium">{formatCurrency(aod.total_contract_value)}</TableCell>
                                  <TableCell className="text-primary">{formatCurrency(aod.payments_made + aod.deposit_amount)}</TableCell>
                                  <TableCell className={aod.balance > 0 ? "text-destructive font-semibold" : "text-primary"}>
                                    {formatCurrency(aod.balance)}
                                  </TableCell>
                                  <TableCell>{aod.total_reports_agreed}</TableCell>
                                  <TableCell>{aod.reports_released}</TableCell>
                                  <TableCell>{getPaymentBadge(aod.payment_status)}</TableCell>
                                </TableRow>
                              ))}
                              <TableRow className="bg-muted/30 font-semibold">
                                <TableCell colSpan={2}>AOD Totals</TableCell>
                                <TableCell>{formatCurrency(attorney.total_aod_value)}</TableCell>
                                <TableCell className="text-primary">{formatCurrency(attorney.total_aod_payments)}</TableCell>
                                <TableCell className="text-destructive">{formatCurrency(Math.max(0, attorney.total_aod_value - attorney.total_aod_payments))}</TableCell>
                                <TableCell colSpan={3} />
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* Short-Term Agreements */}
                    {attorney.short_term_agreements.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Clock className="h-4 w-4" /> Short-Term Agreements ({attorney.short_term_agreements.length})
                        </h4>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Period</TableHead>
                                <TableHead>Contract Value</TableHead>
                                <TableHead>Payments + Deposits</TableHead>
                                <TableHead>Balance</TableHead>
                                <TableHead>Reports Agreed</TableHead>
                                <TableHead>Completed</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {attorney.short_term_agreements.map(st => (
                                <TableRow key={st.id}>
                                  <TableCell className="text-sm">
                                    {format(new Date(st.contract_start_date), "MMM yy")} - {format(new Date(st.contract_end_date), "MMM yy")}
                                  </TableCell>
                                  <TableCell className="font-medium">{formatCurrency(st.total_contract_value)}</TableCell>
                                  <TableCell className="text-primary">{formatCurrency(st.payments_made + st.deposit_amount)}</TableCell>
                                  <TableCell className={st.balance > 0 ? "text-destructive font-semibold" : "text-primary"}>
                                    {formatCurrency(st.balance)}
                                  </TableCell>
                                  <TableCell>{st.total_reports_agreed}</TableCell>
                                  <TableCell>{st.reports_completed}</TableCell>
                                  <TableCell>{getPaymentBadge(st.payment_status)}</TableCell>
                                </TableRow>
                              ))}
                              <TableRow className="bg-muted/30 font-semibold">
                                <TableCell>Short-Term Totals</TableCell>
                                <TableCell>{formatCurrency(attorney.total_short_term_value)}</TableCell>
                                <TableCell className="text-primary">{formatCurrency(attorney.total_short_term_payments)}</TableCell>
                                <TableCell className="text-destructive">{formatCurrency(Math.max(0, attorney.total_short_term_value - attorney.total_short_term_payments))}</TableCell>
                                <TableCell colSpan={3} />
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>
      </main>
      <CompanyFooter />
    </div>
  );
};

export default ReferringAttorneyDebtorsControl;
