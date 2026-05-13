import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight, Filter, Users, Calendar, DollarSign, FileText, TrendingUp, AlertCircle, Plus, Loader2, Activity, Pause, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { syncAODPaymentToAppointments, fetchLinkedAssessments } from "@/hooks/usePaymentSync";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";
import {
  AOD_LIFECYCLE_RULES_KEY,
  DEFAULT_AOD_LIFECYCLE_RULES,
  AODLifecycleRules,
  classifyAODLifecycle,
  LifecycleStatus,
} from "@/utils/aodLifecycleRules";
import { AODLifecycleRulesEditor } from "./AODLifecycleRulesEditor";

interface AODRecord {
  id: string;
  referring_attorney_id: string;
  attorney_name: string;
  total_contract_value: number;
  deposit_amount: number;
  payments_made: number;
  outstanding_balance: number;
  contract_start_date: string | null;
  payment_status: string;
  month: string; // Formatted as "MMMM yyyy"
  month_sort: string; // For sorting: "yyyy-MM"
  created_at: string;
  total_reports_agreed: number;
  reports_released: number;
  last_payment_date: string | null;
}

interface AttorneyActivity {
  last_assessment_date: string | null;
  assessment_total_fee: number;
  assessment_total_deposit: number;
  assessment_count: number;
  last_payment_date: string | null;
}

interface AttorneyGroup {
  attorney_id: string;
  attorney_name: string;
  total_aod_amount: number;
  total_outstanding: number;
  total_deposits: number;
  total_paid: number;
  aod_count: number;
  total_reports_agreed: number;
  total_reports_released: number;
  months: MonthGroup[];
  lifecycle_status: LifecycleStatus;
  last_activity_date: string | null;
  days_inactive: number | null;
  assessment_total_fee: number;
  data_in_sync: boolean;
  rules_version: number;
}

interface MonthGroup {
  month: string;
  month_sort: string;
  total_amount: number;
  outstanding: number;
  records: AODRecord[];
}

export const AODGroupedView = () => {
  const { triggerSync } = useAppointmentSync();
  const [aodRecords, setAodRecords] = useState<AODRecord[]>([]);
  const [attorneyActivity, setAttorneyActivity] = useState<Map<string, AttorneyActivity>>(new Map());
  const [loading, setLoading] = useState(true);
  const [hideFullyPaid, setHideFullyPaid] = useState(false);
  const [hideZeroBalance, setHideZeroBalance] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | LifecycleStatus>('all');
  const [expandedAttorneys, setExpandedAttorneys] = useState<string[]>([]);
  const [lifecycleRules, setLifecycleRules] = useState<AODLifecycleRules>(DEFAULT_AOD_LIFECYCLE_RULES);

  // Load lifecycle rules and subscribe to changes
  useEffect(() => {
    const loadRules = async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", AOD_LIFECYCLE_RULES_KEY)
        .maybeSingle();
      if (data?.setting_value) {
        setLifecycleRules({ ...DEFAULT_AOD_LIFECYCLE_RULES, ...(data.setting_value as any) });
      }
    };
    loadRules();

    const channel = supabase
      .channel("aod-lifecycle-rules")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_settings", filter: `setting_key=eq.${AOD_LIFECYCLE_RULES_KEY}` },
        loadRules
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAttorney, setPaymentAttorney] = useState<{ id: string; name: string; aodId: string } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentType, setPaymentType] = useState<'deposit' | 'regular' | 'final'>('regular');
  const [reportsTakenOut, setReportsTakenOut] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentNotes, setPaymentNotes] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [linkedAssessments, setLinkedAssessments] = useState<any[]>([]);

  // Fetch AOD data with payments
  useEffect(() => {
    const fetchAODData = async () => {
      setLoading(true);
      try {
        // Fetch all AOD documents with attorney info
        const { data: aodDocs, error } = await supabase
          .from("aod_documents")
          .select(`
            *,
            referring_attorneys!inner(id, name, is_system_company)
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Filter out system companies
        const filteredDocs = (aodDocs || []).filter(
          (doc: any) => !doc.referring_attorneys?.is_system_company
        );

        // Fetch payments for each document
        const enrichedRecords: AODRecord[] = await Promise.all(
          filteredDocs.map(async (doc: any) => {
            // Get payments for this AOD
            const { data: payments } = await supabase
              .from("aod_payments")
              .select("payment_amount")
              .eq("aod_document_id", doc.id);

            const totalPayments = (payments || []).reduce(
              (sum, p) => sum + (p.payment_amount || 0),
              0
            );
            
            const depositAmount = doc.deposit_amount || 0;
            const totalContractValue = doc.total_contract_value || 0;
            const totalPaid = depositAmount + totalPayments;
            const outstandingBalance = Math.max(0, totalContractValue - totalPaid);

            // Format month from contract_start_date or created_at
            const dateToUse = doc.contract_start_date || doc.created_at;
            const date = new Date(dateToUse);
            const monthFormatted = format(date, "MMMM yyyy");
            const monthSort = format(date, "yyyy-MM");

            return {
              id: doc.id,
              referring_attorney_id: doc.referring_attorney_id,
              attorney_name: doc.referring_attorneys?.name || "Unknown Attorney",
              total_contract_value: totalContractValue,
              deposit_amount: depositAmount,
              payments_made: totalPayments,
              outstanding_balance: outstandingBalance,
              contract_start_date: doc.contract_start_date,
              payment_status: outstandingBalance <= 0 ? "paid" : (doc.payment_status || "pending"),
              month: monthFormatted,
              month_sort: monthSort,
              created_at: doc.created_at,
              total_reports_agreed: doc.total_reports_agreed || 0,
              reports_released: doc.reports_released || 0,
              last_payment_date: doc.last_payment_date || null,
            };
          })
        );

        setAodRecords(enrichedRecords);

        // Fetch per-attorney scheduled assessment activity for lifecycle classification
        const attorneyIds = Array.from(
          new Set(filteredDocs.map((d: any) => d.referring_attorney_id))
        );

        if (attorneyIds.length > 0) {
          const { data: appts } = await supabase
            .from("appointments")
            .select("referring_attorney_id, appointment_date, service_fee, deposit_amount, case_status")
            .in("referring_attorney_id", attorneyIds)
            .is("deleted_at", null)
            .in("case_status", ["scheduled", "assessed"]);

          const activityMap = new Map<string, AttorneyActivity>();
          (appts || []).forEach((a: any) => {
            const cur = activityMap.get(a.referring_attorney_id) || {
              last_assessment_date: null,
              assessment_total_fee: 0,
              assessment_total_deposit: 0,
              assessment_count: 0,
              last_payment_date: null,
            };
            cur.assessment_total_fee += a.service_fee || 0;
            cur.assessment_total_deposit += a.deposit_amount || 0;
            cur.assessment_count += 1;
            if (a.appointment_date) {
              if (!cur.last_assessment_date || a.appointment_date > cur.last_assessment_date) {
                cur.last_assessment_date = a.appointment_date;
              }
            }
            activityMap.set(a.referring_attorney_id, cur);
          });

          filteredDocs.forEach((doc: any) => {
            if (!doc.last_payment_date) return;
            const cur = activityMap.get(doc.referring_attorney_id) || {
              last_assessment_date: null,
              assessment_total_fee: 0,
              assessment_total_deposit: 0,
              assessment_count: 0,
              last_payment_date: null,
            };
            if (!cur.last_payment_date || doc.last_payment_date > cur.last_payment_date) {
              cur.last_payment_date = doc.last_payment_date;
            }
            activityMap.set(doc.referring_attorney_id, cur);
          });

          setAttorneyActivity(activityMap);
        } else {
          setAttorneyActivity(new Map());
        }
      } catch (error) {
        console.error("Error fetching AOD data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAODData();

    // Real-time subscription for updates
    const channel = supabase
      .channel("aod-grouped-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "aod_documents" }, fetchAODData)
      .on("postgres_changes", { event: "*", schema: "public", table: "aod_payments" }, fetchAODData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Deduplicate records: Consolidate all AOD docs per attorney
  // Each AOD doc has its own contract value, deposits, and payments - we sum them all
  const deduplicatedRecords = useMemo(() => {
    const attorneyContracts = new Map<string, AODRecord>();
    
    // Sort by created_at ascending so first record becomes the base
    const sortedRecords = [...aodRecords].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    // Track which AOD doc IDs we've already processed to avoid duplicates
    const processedIds = new Set<string>();
    
    sortedRecords.forEach((record) => {
      // Skip if we've already processed this exact AOD document
      if (processedIds.has(record.id)) return;
      processedIds.add(record.id);
      
      const normalizedName = record.attorney_name.toLowerCase().trim();
      
      if (!attorneyContracts.has(normalizedName)) {
        attorneyContracts.set(normalizedName, { ...record });
      } else {
        const baseContract = attorneyContracts.get(normalizedName)!;
        
        // Sum contract values across all AOD docs (each is a separate agreement)
        baseContract.total_contract_value += record.total_contract_value;
        baseContract.deposit_amount += record.deposit_amount;
        baseContract.payments_made += record.payments_made;
        baseContract.total_reports_agreed += record.total_reports_agreed;
        baseContract.reports_released += record.reports_released;
        
        // Recalculate outstanding balance
        const totalPaid = baseContract.deposit_amount + baseContract.payments_made;
        baseContract.outstanding_balance = Math.max(0, baseContract.total_contract_value - totalPaid);
        baseContract.payment_status = baseContract.outstanding_balance <= 0 ? "paid" : "partial";
      }
    });
    
    return Array.from(attorneyContracts.values());
  }, [aodRecords]);

  // Filter records based on settings
  const filteredRecords = useMemo(() => {
    let records = [...deduplicatedRecords];

    // Apply filters
    if (hideFullyPaid) {
      records = records.filter((r) => r.payment_status !== "paid");
    }
    if (hideZeroBalance) {
      records = records.filter((r) => r.outstanding_balance > 0);
    }
    if (searchTerm) {
      records = records.filter((r) =>
        r.attorney_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return records;
  }, [deduplicatedRecords, hideFullyPaid, hideZeroBalance, searchTerm]);

  // Group by Attorney NAME (not ID) to deduplicate, then by Month
  const groupedData = useMemo((): AttorneyGroup[] => {
    // Use normalized attorney name as key to deduplicate attorneys with different IDs
    const attorneyMap = new Map<string, AttorneyGroup>();

    filteredRecords.forEach((record) => {
      // Normalize attorney name for deduplication (case-insensitive, trimmed)
      const normalizedName = record.attorney_name.toLowerCase().trim();
      
      if (!attorneyMap.has(normalizedName)) {
        attorneyMap.set(normalizedName, {
          attorney_id: record.referring_attorney_id, // Keep first encountered ID
          attorney_name: record.attorney_name,
          total_aod_amount: 0,
          total_outstanding: 0,
          total_deposits: 0,
          total_paid: 0,
          aod_count: 0,
          total_reports_agreed: 0,
          total_reports_released: 0,
          months: [],
          lifecycle_status: 'active',
          last_activity_date: null,
          days_inactive: null,
          assessment_total_fee: 0,
          data_in_sync: true,
          rules_version: lifecycleRules.version,
        });
      }

      const group = attorneyMap.get(normalizedName)!;
      group.total_aod_amount += record.total_contract_value;
      group.total_outstanding += record.outstanding_balance;
      group.total_deposits += record.deposit_amount;
      group.total_paid += record.deposit_amount + record.payments_made;
      group.aod_count += 1;
      group.total_reports_agreed += record.total_reports_agreed;
      group.total_reports_released += record.reports_released;

      // Find or create month group - use record.id to prevent duplicate record entries
      let monthGroup = group.months.find((m) => m.month === record.month);
      if (!monthGroup) {
        monthGroup = {
          month: record.month,
          month_sort: record.month_sort,
          total_amount: 0,
          outstanding: 0,
          records: [],
        };
        group.months.push(monthGroup);
      }

      // Prevent adding duplicate records (same AOD id)
      const existingRecord = monthGroup.records.find((r) => r.id === record.id);
      if (!existingRecord) {
        monthGroup.total_amount += record.total_contract_value;
        monthGroup.outstanding += record.outstanding_balance;
        monthGroup.records.push(record);
      }
    });

    // Sort months within each attorney
    attorneyMap.forEach((group) => {
      group.months.sort((a, b) => b.month_sort.localeCompare(a.month_sort));

      // Lifecycle classification per attorney
      const activity = attorneyActivity.get(group.attorney_id);
      const lastPayment = activity?.last_payment_date || null;
      const lastAssessment = activity?.last_assessment_date || null;
      const lastActivity = [lastPayment, lastAssessment]
        .filter(Boolean)
        .sort()
        .pop() || null;

      group.last_activity_date = lastActivity;
      group.assessment_total_fee = activity?.assessment_total_fee || 0;

      const result = classifyAODLifecycle(
        {
          outstanding_balance: group.total_outstanding,
          total_reports_agreed: group.total_reports_agreed,
          total_reports_released: group.total_reports_released,
          last_activity_date: lastActivity,
          has_assessment: (activity?.assessment_count || 0) > 0,
        },
        lifecycleRules
      );
      group.lifecycle_status = result.status;
      group.days_inactive = result.days_inactive;
      group.rules_version = result.rules_version;

      // Data agreement: AOD contract value should match scheduled assessment fees
      const diff = Math.abs(group.total_aod_amount - group.assessment_total_fee);
      group.data_in_sync =
        group.assessment_total_fee === 0 || diff <= lifecycleRules.rounding_tolerance;
    });

    // Sort attorneys by outstanding balance (highest first)
    return Array.from(attorneyMap.values()).sort(
      (a, b) => b.total_outstanding - a.total_outstanding
    );
  }, [filteredRecords, attorneyActivity, lifecycleRules]);

  // Apply lifecycle status filter
  const visibleGroups = useMemo(() => {
    if (statusFilter === 'all') return groupedData;
    return groupedData.filter((g) => g.lifecycle_status === statusFilter);
  }, [groupedData, statusFilter]);

  // Attorney summaries for the summary cards
  const summaryStats = useMemo(() => {
    const totalDebt = groupedData.reduce((sum, g) => sum + g.total_aod_amount, 0);
    const totalOutstanding = groupedData.reduce((sum, g) => sum + g.total_outstanding, 0);
    const totalPaid = groupedData.reduce((sum, g) => sum + g.total_paid, 0);
    const activeAttorneys = groupedData.length;
    const totalAODs = groupedData.reduce((sum, g) => sum + g.aod_count, 0);
    const activeCount = groupedData.filter((g) => g.lifecycle_status === 'active').length;
    const dormantCount = groupedData.filter((g) => g.lifecycle_status === 'dormant').length;
    const closedCount = groupedData.filter((g) => g.lifecycle_status === 'closed').length;
    const outOfSyncCount = groupedData.filter((g) => !g.data_in_sync).length;

    return {
      totalDebt,
      totalOutstanding,
      totalPaid,
      activeAttorneys,
      totalAODs,
      activeCount,
      dormantCount,
      closedCount,
      outOfSyncCount,
    };
  }, [groupedData]);

  // Open payment dialog for an attorney
  const handleOpenPaymentDialog = async (attorney: AttorneyGroup) => {
    // Find the first (most recent) AOD record for this attorney from raw records
    const attorneyAods = aodRecords.filter(r => 
      r.attorney_name.toLowerCase().trim() === attorney.attorney_name.toLowerCase().trim()
    );
    const latestAod = attorneyAods.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

    if (!latestAod) {
      toast.error("No AOD document found for this attorney");
      return;
    }

    setPaymentAttorney({ id: attorney.attorney_id, name: attorney.attorney_name, aodId: latestAod.id });
    setPaymentAmount("");
    setPaymentType('regular');
    setReportsTakenOut("");
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setPaymentNotes("");
    setPaymentDialogOpen(true);

    // Fetch linked assessments
    const assessments = await fetchLinkedAssessments(attorney.attorney_id);
    setLinkedAssessments(assessments);
  };

  const handleRecordPayment = async () => {
    if (!paymentAttorney || !paymentAmount || !paymentDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    const amount = parseFloat(paymentAmount);
    const reports = parseInt(reportsTakenOut) || 0;

    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    if (paymentType !== 'deposit' && reports <= 0) {
      toast.error("Regular/Final payments require specifying reports taken out");
      return;
    }

    try {
      setSubmittingPayment(true);

      // Insert payment record
      const { error } = await supabase
        .from("aod_payments")
        .insert({
          aod_document_id: paymentAttorney.aodId,
          payment_amount: amount,
          payment_type: paymentType,
          payment_date: paymentDate,
          reports_taken_out: reports,
          payment_notes: paymentNotes || null,
        });

      if (error) throw error;

      // Sync to scheduled assessments
      const syncResults = await syncAODPaymentToAppointments(
        paymentAttorney.aodId,
        paymentAttorney.id,
        amount,
        reports,
        paymentType,
        paymentDate
      );

      // Update AOD document payment status
      const { data: allPayments } = await supabase
        .from("aod_payments")
        .select("payment_amount")
        .eq("aod_document_id", paymentAttorney.aodId);

      const totalPaid = (allPayments || []).reduce((sum, p) => sum + p.payment_amount, 0);
      
      // Get the AOD contract value
      const { data: aodDoc } = await supabase
        .from("aod_documents")
        .select("total_contract_value, deposit_amount")
        .eq("id", paymentAttorney.aodId)
        .single();

      if (aodDoc) {
        const contractValue = aodDoc.total_contract_value || 0;
        const totalWithDeposit = (aodDoc.deposit_amount || 0) + totalPaid;
        let newStatus = 'pending';
        if (totalWithDeposit >= contractValue && contractValue > 0) {
          newStatus = 'paid';
        } else if (totalWithDeposit > 0) {
          newStatus = 'partial';
        }

        await supabase
          .from("aod_documents")
          .update({
            payment_status: newStatus,
            last_payment_date: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", paymentAttorney.aodId);
      }

      if (paymentType !== 'deposit' && syncResults.appointmentsSynced > 0) {
        toast.success(`Payment R${amount.toLocaleString()} recorded: ${syncResults.appointmentsSynced} assessment(s) updated`);
      } else if (paymentType === 'deposit') {
        toast.success(`Deposit R${amount.toLocaleString()} recorded. Allocate to specific appointments from Scheduled Assessments.`);
      } else {
        toast.success("Payment recorded successfully");
      }

      setPaymentDialogOpen(false);
      triggerSync();
    } catch (error: any) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getStatusBadge = (status: string, outstanding: number) => {
    if (outstanding <= 0 || status === "paid") {
      return <Badge className="bg-green-500/20 text-green-700 border-green-500/30">Paid</Badge>;
    }
    if (status === "overdue") {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    return <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30">Active</Badge>;
  };

  const getLifecycleBadge = (status: LifecycleStatus) => {
    if (status === 'closed') {
      return (
        <Badge className="bg-green-500/20 text-green-700 border-green-500/30 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Closed
        </Badge>
      );
    }
    if (status === 'dormant') {
      return (
        <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30 gap-1">
          <Pause className="h-3 w-3" /> Dormant
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30 gap-1">
        <Activity className="h-3 w-3" /> Active
      </Badge>
    );
  };

  const toggleAttorneyExpansion = (attorneyId: string) => {
    setExpandedAttorneys((prev) =>
      prev.includes(attorneyId)
        ? prev.filter((id) => id !== attorneyId)
        : [...prev, attorneyId]
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total AOD Value</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(summaryStats.totalDebt)}</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-600">Outstanding Balance</span>
            </div>
            <p className="text-2xl font-bold text-red-700">{formatCurrency(summaryStats.totalOutstanding)}</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600">Total Paid</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{formatCurrency(summaryStats.totalPaid)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Attorneys with AOD</span>
            </div>
            <p className="text-2xl font-bold">{summaryStats.activeAttorneys}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total AOD Records</span>
            </div>
            <p className="text-2xl font-bold">{summaryStats.totalAODs}</p>
          </CardContent>
        </Card>
      </div>

      {/* Lifecycle status cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card
          className={`cursor-pointer transition-colors ${statusFilter === 'active' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-blue-200 bg-blue-50/40'}`}
          onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-700">Active Agreements</span>
            </div>
            <p className="text-2xl font-bold text-blue-700">{summaryStats.activeCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Debt outstanding · reports & payments ongoing</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${statusFilter === 'dormant' ? 'border-amber-500 ring-1 ring-amber-500' : 'border-amber-200 bg-amber-50/40'}`}
          onClick={() => setStatusFilter(statusFilter === 'dormant' ? 'all' : 'dormant')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Pause className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-700">Dormant Agreements</span>
            </div>
            <p className="text-2xl font-bold text-amber-700">{summaryStats.dormantCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Assessment done · no payments / reports for {lifecycleRules.dormancy_days}+ days</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${statusFilter === 'closed' ? 'border-green-500 ring-1 ring-green-500' : 'border-green-200 bg-green-50/40'}`}
          onClick={() => setStatusFilter(statusFilter === 'closed' ? 'all' : 'closed')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700">Closed Agreements</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{summaryStats.closedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Fully paid · all reports released</p>
          </CardContent>
        </Card>

        <Card className={summaryStats.outOfSyncCount > 0 ? 'border-red-300 bg-red-50/40' : 'border-muted'}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${summaryStats.outOfSyncCount > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
              <span className={`text-sm ${summaryStats.outOfSyncCount > 0 ? 'text-red-700' : 'text-muted-foreground'}`}>
                Data Mismatches
              </span>
            </div>
            <p className={`text-2xl font-bold ${summaryStats.outOfSyncCount > 0 ? 'text-red-700' : ''}`}>
              {summaryStats.outOfSyncCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">AOD totals don't match scheduled assessment fees</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>

            <div className="flex items-center gap-1">
              {(['all', 'active', 'dormant', 'closed'] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === s ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(s)}
                  className="capitalize"
                >
                  {s}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="hide-paid"
                checked={hideFullyPaid}
                onCheckedChange={setHideFullyPaid}
              />
              <Label htmlFor="hide-paid" className="text-sm">Hide Fully Paid</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="hide-zero"
                checked={hideZeroBalance}
                onCheckedChange={setHideZeroBalance}
              />
              <Label htmlFor="hide-zero" className="text-sm">Hide Zero Balance</Label>
            </div>

            <div className="flex-1 max-w-xs">
              <Input
                placeholder="Search attorney..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandedAttorneys(visibleGroups.map((g) => g.attorney_id))}
            >
              Expand All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandedAttorneys([])}
            >
              Collapse All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grouped AOD Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            AOD – Grouped by Referring Attorney
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {visibleGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No AOD records found matching the filters
              </div>
            ) : (
              <div className="space-y-4">
                {visibleGroups.map((attorney) => (
                  <div key={attorney.attorney_id} className="border rounded-lg overflow-hidden">
                    {/* Attorney Header Row */}
                    <div
                      className="flex items-center justify-between p-4 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
                      onClick={() => toggleAttorneyExpansion(attorney.attorney_id)}
                    >
                      <div className="flex items-center gap-3">
                        {expandedAttorneys.includes(attorney.attorney_id) ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{attorney.attorney_name}</h3>
                            {getLifecycleBadge(attorney.lifecycle_status)}
                            {!attorney.data_in_sync && (
                              <Badge
                                variant="outline"
                                className="gap-1 border-red-300 text-red-700"
                                title={`AOD total ${formatCurrency(attorney.total_aod_amount)} vs scheduled assessment fees ${formatCurrency(attorney.assessment_total_fee)}`}
                              >
                                <AlertTriangle className="h-3 w-3" /> Data mismatch
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {attorney.aod_count} AOD record{attorney.aod_count !== 1 ? "s" : ""} • {attorney.months.length} month{attorney.months.length !== 1 ? "s" : ""}
                            {" • "}Reports {attorney.total_reports_released}/{attorney.total_reports_agreed}
                            {attorney.last_activity_date && (
                              <> • Last activity {format(new Date(attorney.last_activity_date), "dd MMM yyyy")}{attorney.days_inactive !== null && ` (${attorney.days_inactive}d ago)`}</>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPaymentDialog(attorney);
                          }}
                        >
                          <DollarSign className="h-4 w-4" />
                          Record Payment
                        </Button>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Debt</p>
                          <p className="font-semibold">{formatCurrency(attorney.total_aod_amount)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Paid</p>
                          <p className="font-semibold text-green-600">{formatCurrency(attorney.total_paid)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Outstanding</p>
                          <p className="font-bold text-red-600">{formatCurrency(attorney.total_outstanding)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Monthly Breakdown */}
                    {expandedAttorneys.includes(attorney.attorney_id) && (
                      <div className="border-t">
                        {attorney.months.map((monthGroup) => (
                          <div key={monthGroup.month} className="border-b last:border-b-0">
                            {/* Month Header */}
                            <div className="flex items-center justify-between px-6 py-3 bg-muted/30">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{monthGroup.month}</span>
                                <Badge variant="outline" className="ml-2">
                                  {monthGroup.records.length} record{monthGroup.records.length !== 1 ? "s" : ""}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span>Total: {formatCurrency(monthGroup.total_amount)}</span>
                                <span className="text-red-600 font-medium">
                                  Outstanding: {formatCurrency(monthGroup.outstanding)}
                                </span>
                              </div>
                            </div>

                            {/* Individual Records Table */}
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/10">
                                  <TableHead className="w-[120px]">Date</TableHead>
                                  <TableHead>Contract Value</TableHead>
                                  <TableHead>Deposit</TableHead>
                                  <TableHead>Payments</TableHead>
                                  <TableHead>Outstanding</TableHead>
                                  <TableHead>Reports</TableHead>
                                  <TableHead>Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {monthGroup.records.map((record) => (
                                  <TableRow key={record.id}>
                                    <TableCell className="font-medium">
                                      {record.contract_start_date
                                        ? format(new Date(record.contract_start_date), "dd MMM yyyy")
                                        : format(new Date(record.created_at), "dd MMM yyyy")}
                                    </TableCell>
                                    <TableCell>{formatCurrency(record.total_contract_value)}</TableCell>
                                    <TableCell>{formatCurrency(record.deposit_amount)}</TableCell>
                                    <TableCell className="text-green-600">
                                      {formatCurrency(record.payments_made)}
                                    </TableCell>
                                    <TableCell className="font-semibold text-red-600">
                                      {formatCurrency(record.outstanding_balance)}
                                    </TableCell>
                                    <TableCell>
                                      {record.reports_released}/{record.total_reports_agreed}
                                    </TableCell>
                                    <TableCell>
                                      {getStatusBadge(record.payment_status, record.outstanding_balance)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Record Payment – {paymentAttorney?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Amount (R)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Type</Label>
                <Select value={paymentType} onValueChange={(v: any) => setPaymentType(v)}>
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
            </div>

            {paymentType !== 'deposit' && (
              <div className="space-y-2">
                <Label>Reports Taken Out</Label>
                <Input
                  type="number"
                  placeholder="Number of reports"
                  value={reportsTakenOut}
                  onChange={(e) => setReportsTakenOut(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Payment will be allocated to the oldest pending assessments
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Payment reference or notes..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Linked Assessments Preview */}
            {linkedAssessments.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Linked Assessments ({linkedAssessments.length})</Label>
                <ScrollArea className="h-[150px] border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Claimant</TableHead>
                        <TableHead className="text-xs">Fee</TableHead>
                        <TableHead className="text-xs">Paid</TableHead>
                        <TableHead className="text-xs">Balance</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linkedAssessments.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs">{a.claimantName}</TableCell>
                          <TableCell className="text-xs">{formatCurrency(a.serviceFee)}</TableCell>
                          <TableCell className="text-xs">{formatCurrency(a.depositAmount)}</TableCell>
                          <TableCell className="text-xs font-medium text-destructive">
                            {formatCurrency(a.balance)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {a.paymentStatus}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRecordPayment} disabled={submittingPayment}>
                {submittingPayment && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Record Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
