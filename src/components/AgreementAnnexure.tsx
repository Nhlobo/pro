import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Unlock,
  Lock,
  FileCheck
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { RandSign } from "@/components/icons/RandSign";
interface AnnexurePhase {
  id: string;
  phase_name: string;
  phase_order: number;
  payment_stage: string;
  payment_percentage: number;
  payment_amount: number;
  deliverables: string[];
  is_paid: boolean;
  paid_at?: string;
  deliverables_released: boolean;
  released_at?: string;
}

interface AgreementAnnexureProps {
  agreementId: string;
  agreementType: "aod" | "short_term";
  totalValue: number;
  onUpdate?: () => void;
}

const DEFAULT_PHASES = [
  { phase_name: "Booking Confirmation", phase_order: 1, payment_stage: "Deposit", payment_percentage: 50, deliverables: ["Appointment confirmation", "Initial documentation"] },
  { phase_name: "Assessment Conducted", phase_order: 2, payment_stage: "First Payment", payment_percentage: 25, deliverables: ["Assessment completion certificate", "Preliminary findings"] },
  { phase_name: "Draft Report Release", phase_order: 3, payment_stage: "Second Payment", payment_percentage: 15, deliverables: ["Draft report for review", "Supporting documentation"] },
  { phase_name: "Final Report & Clarifications", phase_order: 4, payment_stage: "Final Payment", payment_percentage: 10, deliverables: ["Final report", "Clarifications", "Joint minutes", "Affidavits"] },
];

export const AgreementAnnexure = ({ 
  agreementId, 
  agreementType, 
  totalValue,
  onUpdate 
}: AgreementAnnexureProps) => {
  const [phases, setPhases] = useState<AnnexurePhase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnnexures();
  }, [agreementId]);

  const fetchAnnexures = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("agreement_annexures")
        .select("*")
        .eq("agreement_id", agreementId)
        .eq("agreement_type", agreementType)
        .order("phase_order", { ascending: true });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setPhases(data as AnnexurePhase[]);
      } else {
        // Create default phases if none exist
        await createDefaultPhases();
      }
    } catch (error: any) {
      console.error("Error fetching annexures:", error);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultPhases = async () => {
    try {
      const phasesToCreate = DEFAULT_PHASES.map(phase => ({
        agreement_id: agreementId,
        agreement_type: agreementType,
        phase_name: phase.phase_name,
        phase_order: phase.phase_order,
        payment_stage: phase.payment_stage,
        payment_percentage: phase.payment_percentage,
        payment_amount: (totalValue * phase.payment_percentage) / 100,
        deliverables: phase.deliverables,
        is_paid: false,
        deliverables_released: false,
      }));

      const { data, error } = await supabase
        .from("agreement_annexures")
        .insert(phasesToCreate)
        .select();

      if (error) throw error;
      
      setPhases(data as AnnexurePhase[]);
    } catch (error: any) {
      console.error("Error creating default phases:", error);
    }
  };

  const handlePaymentUpdate = async (phaseId: string, isPaid: boolean) => {
    try {
      const { error } = await supabase
        .from("agreement_annexures")
        .update({ 
          is_paid: isPaid,
          paid_at: isPaid ? new Date().toISOString() : null 
        })
        .eq("id", phaseId);
      
      if (error) throw error;
      
      // Check if deliverables should be released
      if (isPaid) {
        await supabase
          .from("agreement_annexures")
          .update({ 
            deliverables_released: true,
            released_at: new Date().toISOString() 
          })
          .eq("id", phaseId);
      }
      
      toast.success(isPaid ? "Payment recorded" : "Payment unmarked");
      fetchAnnexures();
      onUpdate?.();
    } catch (error: any) {
      console.error("Error updating payment:", error);
      toast.error("Failed to update payment status");
    }
  };

  const handleDeliverableRelease = async (phaseId: string, released: boolean) => {
    const phase = phases.find(p => p.id === phaseId);
    if (!phase?.is_paid && released) {
      toast.error("Payment must be received before releasing deliverables");
      return;
    }

    try {
      const { error } = await supabase
        .from("agreement_annexures")
        .update({ 
          deliverables_released: released,
          released_at: released ? new Date().toISOString() : null 
        })
        .eq("id", phaseId);
      
      if (error) throw error;
      
      toast.success(released ? "Deliverables released" : "Deliverables locked");
      fetchAnnexures();
      onUpdate?.();
    } catch (error: any) {
      console.error("Error updating deliverable status:", error);
      toast.error("Failed to update deliverable status");
    }
  };

  const totalPaid = phases.filter(p => p.is_paid).reduce((sum, p) => sum + p.payment_amount, 0);
  const progressPercentage = totalValue > 0 ? (totalPaid / totalValue) * 100 : 0;
  const phasesCompleted = phases.filter(p => p.is_paid && p.deliverables_released).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Annexure A: Payment & Report Release Schedule
            </CardTitle>
            <CardDescription>
              Reports released based on payment milestones
            </CardDescription>
          </div>
          <Badge variant={phasesCompleted === phases.length ? "default" : "secondary"}>
            {phasesCompleted}/{phases.length} Phases Complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Overview */}
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span>Payment Progress</span>
            <span className="font-medium">
              R {totalPaid.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} / 
              R {totalValue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {progressPercentage.toFixed(0)}% of total contract value received
          </p>
        </div>

        {/* Phases Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">#</TableHead>
              <TableHead>Phase</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Deliverables</TableHead>
              <TableHead className="text-center">Paid</TableHead>
              <TableHead className="text-center">Released</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {phases.map((phase) => (
              <TableRow key={phase.id}>
                <TableCell className="font-medium">{phase.phase_order}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{phase.phase_name}</p>
                    <p className="text-xs text-muted-foreground">{phase.payment_stage}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <RandSign className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      R {phase.payment_amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({phase.payment_percentage}%)
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {phase.deliverables.slice(0, 2).map((d, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {d}
                      </Badge>
                    ))}
                    {phase.deliverables.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{phase.deliverables.length - 2} more
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={phase.is_paid}
                    onCheckedChange={(checked) => handlePaymentUpdate(phase.id, checked as boolean)}
                  />
                  {phase.is_paid && (
                    <CheckCircle className="h-4 w-4 text-green-500 inline ml-1" />
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {phase.is_paid ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeliverableRelease(phase.id, !phase.deliverables_released)}
                    >
                      {phase.deliverables_released ? (
                        <Unlock className="h-4 w-4 text-green-500" />
                      ) : (
                        <Lock className="h-4 w-4 text-amber-500" />
                      )}
                    </Button>
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground mx-auto" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Legend */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span>Payment Received</span>
          </div>
          <div className="flex items-center gap-1">
            <Unlock className="h-3 w-3 text-green-500" />
            <span>Deliverables Released</span>
          </div>
          <div className="flex items-center gap-1">
            <Lock className="h-3 w-3 text-amber-500" />
            <span>Awaiting Release</span>
          </div>
          <div className="flex items-center gap-1">
            <Lock className="h-3 w-3 text-muted-foreground" />
            <span>Payment Required</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
