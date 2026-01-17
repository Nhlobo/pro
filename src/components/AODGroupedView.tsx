import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { ChevronDown, ChevronRight, Filter, Users, Calendar, DollarSign, FileText, TrendingUp, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

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
}

interface AttorneyGroup {
  attorney_id: string;
  attorney_name: string;
  total_aod_amount: number;
  total_outstanding: number;
  total_deposits: number;
  total_paid: number;
  aod_count: number;
  months: MonthGroup[];
}

interface MonthGroup {
  month: string;
  month_sort: string;
  total_amount: number;
  outstanding: number;
  records: AODRecord[];
}

interface AttorneySummary {
  id: string;
  name: string;
  total_debt: number;
  total_outstanding: number;
  active_aods: number;
}

export const AODGroupedView = () => {
  const [aodRecords, setAodRecords] = useState<AODRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideFullyPaid, setHideFullyPaid] = useState(true);
  const [hideZeroBalance, setHideZeroBalance] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedAttorneys, setExpandedAttorneys] = useState<string[]>([]);

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
            };
          })
        );

        setAodRecords(enrichedRecords);
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

  // Deduplicate records: ONE contract per attorney
  // All deposits/payments from ALL AOD records for the same attorney are aggregated into a single contract
  const deduplicatedRecords = useMemo(() => {
    const attorneyContracts = new Map<string, AODRecord>();
    
    // Sort by created_at ascending to ensure the first (original) record is kept as base
    const sortedRecords = [...aodRecords].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    sortedRecords.forEach((record) => {
      // Use ONLY attorney name as key - one consolidated contract per attorney
      const normalizedName = record.attorney_name.toLowerCase().trim();
      
      if (!attorneyContracts.has(normalizedName)) {
        // First record for this attorney becomes the base contract
        attorneyContracts.set(normalizedName, { ...record });
      } else {
        // Aggregate all subsequent records into the base contract
        const baseContract = attorneyContracts.get(normalizedName)!;
        
        // Use the HIGHEST contract value as the single contract value
        // (This represents the actual agreed contract amount)
        if (record.total_contract_value > baseContract.total_contract_value) {
          baseContract.total_contract_value = record.total_contract_value;
          baseContract.total_reports_agreed = record.total_reports_agreed;
        }
        
        // Aggregate ALL deposits from all AOD records
        baseContract.deposit_amount += record.deposit_amount;
        
        // Aggregate ALL payments from all AOD records
        baseContract.payments_made += record.payments_made;
        
        // Aggregate report releases
        baseContract.reports_released += record.reports_released;
        
        // Recalculate outstanding balance: Single Contract Value - (All Deposits + All Payments)
        const totalPaid = baseContract.deposit_amount + baseContract.payments_made;
        baseContract.outstanding_balance = Math.max(0, baseContract.total_contract_value - totalPaid);
        
        // Update payment status based on new outstanding balance
        baseContract.payment_status = baseContract.outstanding_balance <= 0 ? "paid" : baseContract.payment_status;
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
          months: [],
        });
      }

      const group = attorneyMap.get(normalizedName)!;
      group.total_aod_amount += record.total_contract_value;
      group.total_outstanding += record.outstanding_balance;
      group.total_deposits += record.deposit_amount;
      group.total_paid += record.deposit_amount + record.payments_made;
      group.aod_count += 1;

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
    });

    // Sort attorneys by outstanding balance (highest first)
    return Array.from(attorneyMap.values()).sort(
      (a, b) => b.total_outstanding - a.total_outstanding
    );
  }, [filteredRecords]);

  // Attorney summaries for the summary cards
  const summaryStats = useMemo(() => {
    const totalDebt = groupedData.reduce((sum, g) => sum + g.total_aod_amount, 0);
    const totalOutstanding = groupedData.reduce((sum, g) => sum + g.total_outstanding, 0);
    const totalPaid = groupedData.reduce((sum, g) => sum + g.total_paid, 0);
    const activeAttorneys = groupedData.length;
    const totalAODs = groupedData.reduce((sum, g) => sum + g.aod_count, 0);

    return { totalDebt, totalOutstanding, totalPaid, activeAttorneys, totalAODs };
  }, [groupedData]);

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
              <span className="text-sm text-muted-foreground">Active Attorneys</span>
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

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
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
              onClick={() => setExpandedAttorneys(groupedData.map((g) => g.attorney_id))}
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
            {groupedData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No AOD records found matching the filters
              </div>
            ) : (
              <div className="space-y-4">
                {groupedData.map((attorney) => (
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
                          <h3 className="font-semibold text-lg">{attorney.attorney_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {attorney.aod_count} AOD record{attorney.aod_count !== 1 ? "s" : ""} • {attorney.months.length} month{attorney.months.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-right">
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
    </div>
  );
};
