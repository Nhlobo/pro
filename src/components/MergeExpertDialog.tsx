import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, Users, Calendar, FileText } from "lucide-react";

interface DuplicateExpert {
  duplicate_group: number;
  expert_id: string;
  first_name: string;
  last_name: string;
  expert_type: string;
  province: string;
  status: string;
  appointment_count: number;
  created_at: string;
}

interface MergeExpertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMergeComplete: () => void;
}

export default function MergeExpertDialog({
  open,
  onOpenChange,
  onMergeComplete,
}: MergeExpertDialogProps) {
  const [duplicates, setDuplicates] = useState<DuplicateExpert[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [selectedPrimary, setSelectedPrimary] = useState<Record<number, string>>({});
  const [confirmMerge, setConfirmMerge] = useState<{group: number; primary: string; duplicates: DuplicateExpert[]} | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchDuplicates();
    }
  }, [open]);

  const fetchDuplicates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('find_duplicate_experts');
      
      if (error) throw error;
      
      setDuplicates(data || []);
      
      // Auto-select the expert with most appointments as primary for each group
      const grouped = (data || []).reduce((acc: Record<number, DuplicateExpert[]>, exp: DuplicateExpert) => {
        if (!acc[exp.duplicate_group]) acc[exp.duplicate_group] = [];
        acc[exp.duplicate_group].push(exp);
        return acc;
      }, {});
      
      const defaults: Record<number, string> = {};
      Object.entries(grouped).forEach(([group, experts]) => {
        const sorted = [...experts].sort((a, b) => b.appointment_count - a.appointment_count);
        defaults[Number(group)] = sorted[0].expert_id;
      });
      setSelectedPrimary(defaults);
      
    } catch (error) {
      console.error('Error fetching duplicates:', error);
      toast({
        title: "Error",
        description: "Failed to fetch duplicate experts.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const groupedDuplicates = duplicates.reduce((acc: Record<number, DuplicateExpert[]>, exp) => {
    if (!acc[exp.duplicate_group]) acc[exp.duplicate_group] = [];
    acc[exp.duplicate_group].push(exp);
    return acc;
  }, {});

  const handleMergeGroup = (group: number) => {
    const experts = groupedDuplicates[group];
    const primaryId = selectedPrimary[group];
    if (!primaryId) {
      toast({
        title: "Select Primary Expert",
        description: "Please select which expert to keep as the primary record.",
        variant: "destructive",
      });
      return;
    }
    setConfirmMerge({ group, primary: primaryId, duplicates: experts });
  };

  const executeMerge = async () => {
    if (!confirmMerge) return;
    
    setMerging(true);
    try {
      const { primary, duplicates: experts } = confirmMerge;
      const duplicatesToMerge = experts.filter(e => e.expert_id !== primary);
      
      let totalMerged = {
        appointments: 0,
        reports: 0,
        payments: 0,
        documents: 0,
      };
      
      for (const dup of duplicatesToMerge) {
        const { data, error } = await supabase.rpc('merge_and_delete_duplicate_expert', {
          p_duplicate_expert_id: dup.expert_id,
          p_primary_expert_id: primary,
        });
        
        if (error) throw error;
        
        const result = data as any;
        if (!result.success) {
          throw new Error(result.error || 'Merge failed');
        }
        
        totalMerged.appointments += result.appointments_merged || 0;
        totalMerged.reports += result.expert_reports_merged || 0;
        totalMerged.payments += result.expert_payments_merged || 0;
        totalMerged.documents += result.documents_merged || 0;
      }
      
      toast({
        title: "Merge Successful",
        description: `Merged ${duplicatesToMerge.length} duplicate(s). Transferred ${totalMerged.appointments} appointments, ${totalMerged.reports} reports, ${totalMerged.payments} payments, ${totalMerged.documents} documents.`,
      });
      
      setConfirmMerge(null);
      fetchDuplicates();
      onMergeComplete();
      
    } catch (error) {
      console.error('Error merging experts:', error);
      toast({
        title: "Merge Failed",
        description: "There was an error merging the duplicate experts.",
        variant: "destructive",
      });
    } finally {
      setMerging(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Manage Duplicate Experts
            </DialogTitle>
            <DialogDescription>
              Review and merge duplicate medical experts. Data from duplicates will be transferred to the primary expert before deletion.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : Object.keys(groupedDuplicates).length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No Duplicates Found</p>
              <p className="text-muted-foreground">All medical experts have unique names.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedDuplicates).map(([group, experts]) => (
                <Card key={group} className="border-destructive/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Duplicate Group: Dr. {experts[0].first_name} {experts[0].last_name}
                      <Badge variant="destructive">{experts.length} records</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Select the primary expert to keep. All appointments, reports, and payments from duplicates will be merged into this record.
                    </p>
                    
                    <RadioGroup
                      value={selectedPrimary[Number(group)] || ""}
                      onValueChange={(value) => setSelectedPrimary(prev => ({...prev, [Number(group)]: value}))}
                    >
                      {experts.map((expert) => (
                        <div
                          key={expert.expert_id}
                          className={`flex items-center space-x-3 p-3 rounded-lg border ${
                            selectedPrimary[Number(group)] === expert.expert_id
                              ? "border-primary bg-primary/5"
                              : "border-border"
                          }`}
                        >
                          <RadioGroupItem value={expert.expert_id} id={expert.expert_id} />
                          <Label htmlFor={expert.expert_id} className="flex-1 cursor-pointer">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium">
                                  Dr. {expert.first_name} {expert.last_name}
                                </span>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline">{expert.expert_type}</Badge>
                                  <Badge variant="secondary">{expert.province}</Badge>
                                  {expert.status === 'inactive' && (
                                    <Badge variant="destructive">Inactive</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-right text-sm">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {expert.appointment_count} appointments
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Added: {new Date(expert.created_at).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                    
                    <Button
                      onClick={() => handleMergeGroup(Number(group))}
                      variant="destructive"
                      size="sm"
                      disabled={!selectedPrimary[Number(group)]}
                    >
                      Merge & Delete Duplicates
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmMerge} onOpenChange={() => setConfirmMerge(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Merge & Delete
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Transfer all appointments, reports, payments, and documents to the primary expert</li>
                <li>Permanently delete {confirmMerge?.duplicates.filter(e => e.expert_id !== confirmMerge.primary).length} duplicate record(s)</li>
              </ul>
              <p className="font-medium text-destructive">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeMerge}
              disabled={merging}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {merging ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Merging...
                </>
              ) : (
                "Confirm Merge & Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
