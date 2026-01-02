import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  AlertTriangle, Ban, Bell, Calendar, Send, 
  Clock, FileWarning, Loader2, CheckCircle
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface DefaultAgreement {
  id: string;
  agreement_type: string;
  referring_attorney_id: string;
  attorney_name?: string;
  total_contract_value: number;
  deposit_amount: number;
  payment_status: string;
  document_status: string;
  default_status: string | null;
  services_suspended: boolean;
  next_payment_date: string | null;
  days_overdue?: number;
  default_notice_count: number;
}

interface AgreementDefaultMonitorProps {
  lawFirmId?: string;
  onAction?: () => void;
}

export const AgreementDefaultMonitor = ({ lawFirmId, onAction }: AgreementDefaultMonitorProps) => {
  const [agreements, setAgreements] = useState<DefaultAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [selectedAgreement, setSelectedAgreement] = useState<DefaultAgreement | null>(null);
  const [escalationDialogOpen, setEscalationDialogOpen] = useState(false);
  const [escalationNotes, setEscalationNotes] = useState("");

  useEffect(() => {
    fetchDefaultAgreements();
  }, [lawFirmId]);

  const fetchDefaultAgreements = async () => {
    try {
      setLoading(true);
      
      // Fetch AOD documents with default status
      const { data: aodData, error: aodError } = await supabase
        .from("aod_documents")
        .select(`
          id,
          referring_attorney_id,
          total_contract_value,
          deposit_amount,
          payment_status,
          document_status,
          default_status,
          services_suspended,
          next_payment_date,
          default_notice_count
        `)
        .or("default_status.eq.overdue,default_status.eq.in_default,payment_status.eq.overdue");

      // Fetch short-term agreements with default status
      const { data: stData, error: stError } = await supabase
        .from("short_term_agreements")
        .select(`
          id,
          referring_attorney_id,
          total_contract_value,
          deposit_amount,
          payment_status,
          document_status,
          default_status,
          services_suspended,
          next_payment_date,
          default_notice_count
        `)
        .or("default_status.eq.overdue,default_status.eq.in_default,payment_status.eq.overdue");

      if (aodError) throw aodError;
      if (stError) throw stError;

      // Combine and enrich with attorney names
      const allAgreements: DefaultAgreement[] = [];
      
      const processAgreements = async (data: any[], type: string) => {
        if (!data) return;
        
        for (const agreement of data) {
          // Fetch attorney name
          const { data: attorney } = await supabase
            .from("referring_attorneys")
            .select("name")
            .eq("id", agreement.referring_attorney_id)
            .single();

          // Calculate days overdue
          let daysOverdue = 0;
          if (agreement.next_payment_date) {
            daysOverdue = differenceInDays(new Date(), new Date(agreement.next_payment_date));
          }

          if (daysOverdue > 0 || agreement.default_status) {
            allAgreements.push({
              ...agreement,
              agreement_type: type,
              attorney_name: attorney?.name || "Unknown",
              days_overdue: daysOverdue > 0 ? daysOverdue : undefined,
            });
          }
        }
      };

      await processAgreements(aodData, "aod");
      await processAgreements(stData, "short_term");

      // Sort by days overdue (most overdue first)
      allAgreements.sort((a, b) => (b.days_overdue || 0) - (a.days_overdue || 0));
      
      setAgreements(allAgreements);
    } catch (error: any) {
      console.error("Error fetching default agreements:", error);
      toast.error("Failed to load default agreements");
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotice = async (agreement: DefaultAgreement) => {
    try {
      setSending(agreement.id);
      
      const table = agreement.agreement_type === "aod" ? "aod_documents" : "short_term_agreements";
      
      // Update notice count
      const { error } = await supabase
        .from(table)
        .update({ 
          default_notice_sent_at: new Date().toISOString(),
          default_notice_count: (agreement.default_notice_count || 0) + 1
        })
        .eq("id", agreement.id);
      
      if (error) throw error;
      
      // Log the action
      await supabase.from("audit_logs").insert({
        action_type: "DEFAULT_NOTICE_SENT",
        table_name: table,
        record_id: agreement.id,
        function_area: "Agreement Default Management",
        description: `Default notice #${(agreement.default_notice_count || 0) + 1} sent for ${agreement.attorney_name}`,
        new_values: { notice_count: (agreement.default_notice_count || 0) + 1 }
      });
      
      toast.success("Default notice sent");
      fetchDefaultAgreements();
      onAction?.();
    } catch (error: any) {
      console.error("Error sending notice:", error);
      toast.error("Failed to send notice");
    } finally {
      setSending(null);
    }
  };

  const handleSuspendServices = async (agreement: DefaultAgreement, suspend: boolean) => {
    try {
      const table = agreement.agreement_type === "aod" ? "aod_documents" : "short_term_agreements";
      
      const { error } = await supabase
        .from(table)
        .update({ services_suspended: suspend })
        .eq("id", agreement.id);
      
      if (error) throw error;
      
      toast.success(suspend ? "Services suspended" : "Services resumed");
      fetchDefaultAgreements();
      onAction?.();
    } catch (error: any) {
      console.error("Error updating suspension:", error);
      toast.error("Failed to update service status");
    }
  };

  const handleEscalation = async () => {
    if (!selectedAgreement) return;
    
    try {
      const table = selectedAgreement.agreement_type === "aod" ? "aod_documents" : "short_term_agreements";
      
      const { error } = await supabase
        .from(table)
        .update({ 
          legal_escalation_notes: escalationNotes,
          default_status: "escalated"
        })
        .eq("id", selectedAgreement.id);
      
      if (error) throw error;
      
      // Log escalation
      await supabase.from("audit_logs").insert({
        action_type: "LEGAL_ESCALATION",
        table_name: table,
        record_id: selectedAgreement.id,
        function_area: "Agreement Default Management",
        description: `Legal escalation initiated for ${selectedAgreement.attorney_name}`,
        new_values: { escalation_notes: escalationNotes }
      });
      
      toast.success("Legal escalation recorded");
      setEscalationDialogOpen(false);
      setSelectedAgreement(null);
      setEscalationNotes("");
      fetchDefaultAgreements();
      onAction?.();
    } catch (error: any) {
      console.error("Error recording escalation:", error);
      toast.error("Failed to record escalation");
    }
  };

  const getStatusBadge = (agreement: DefaultAgreement) => {
    if (agreement.services_suspended) {
      return <Badge variant="destructive">Services Suspended</Badge>;
    }
    if (agreement.default_status === "in_default") {
      return <Badge className="bg-red-100 text-red-800">In Default</Badge>;
    }
    if (agreement.default_status === "escalated") {
      return <Badge className="bg-purple-100 text-purple-800">Legal Escalation</Badge>;
    }
    if (agreement.default_status === "overdue" || (agreement.days_overdue && agreement.days_overdue > 0)) {
      return <Badge className="bg-amber-100 text-amber-800">Overdue</Badge>;
    }
    return <Badge variant="secondary">Monitoring</Badge>;
  };

  const overdueCount = agreements.filter(a => a.days_overdue && a.days_overdue > 0).length;
  const inDefaultCount = agreements.filter(a => a.default_status === "in_default").length;
  const suspendedCount = agreements.filter(a => a.services_suspended).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Default & Termination Monitor
            </CardTitle>
            <CardDescription>
              Track overdue payments and manage defaults
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {overdueCount > 0 && (
              <Badge variant="outline" className="bg-amber-50">
                <Clock className="h-3 w-3 mr-1" />
                {overdueCount} Overdue
              </Badge>
            )}
            {inDefaultCount > 0 && (
              <Badge variant="outline" className="bg-red-50">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {inDefaultCount} In Default
              </Badge>
            )}
            {suspendedCount > 0 && (
              <Badge variant="outline" className="bg-gray-100">
                <Ban className="h-3 w-3 mr-1" />
                {suspendedCount} Suspended
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : agreements.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
            <p className="text-muted-foreground">No defaults or overdue payments</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Attorney</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Days Overdue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notices</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agreements.map((agreement) => (
                <TableRow key={`${agreement.agreement_type}-${agreement.id}`}>
                  <TableCell className="font-medium">{agreement.attorney_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {agreement.agreement_type === "aod" ? "Long-Term AOD" : "Short-Term"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    R {((agreement.total_contract_value || 0) - (agreement.deposit_amount || 0)).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    {agreement.days_overdue && agreement.days_overdue > 0 ? (
                      <span className={`font-medium ${agreement.days_overdue > 30 ? 'text-red-600' : 'text-amber-600'}`}>
                        {agreement.days_overdue} days
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(agreement)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      <Bell className="h-3 w-3 mr-1" />
                      {agreement.default_notice_count || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendNotice(agreement)}
                        disabled={sending === agreement.id}
                      >
                        {sending === agreement.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant={agreement.services_suspended ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSuspendServices(agreement, !agreement.services_suspended)}
                      >
                        <Ban className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedAgreement(agreement);
                          setEscalationDialogOpen(true);
                        }}
                      >
                        <FileWarning className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Escalation Dialog */}
        <Dialog open={escalationDialogOpen} onOpenChange={setEscalationDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileWarning className="h-5 w-5 text-red-500" />
                Legal Escalation
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Record legal escalation notes for {selectedAgreement?.attorney_name}
              </p>
              <div>
                <Label htmlFor="escalationNotes">Escalation Notes</Label>
                <Textarea
                  id="escalationNotes"
                  placeholder="Enter details about the legal escalation..."
                  className="mt-2"
                  value={escalationNotes}
                  onChange={(e) => setEscalationNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEscalationDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleEscalation}>
                Record Escalation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
