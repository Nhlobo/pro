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
import { Loader2, AlertTriangle, Building2, Users, FileText } from "lucide-react";

interface DuplicateAttorney {
  duplicate_group: number;
  attorney_id: string;
  name: string;
  contact_person: string | null;
  province: string | null;
  code: string | null;
  claimant_count: number;
  appointment_count: number;
  created_at: string;
}

interface MergeAttorneyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMergeComplete: () => void;
}

export default function MergeAttorneyDialog({
  open,
  onOpenChange,
  onMergeComplete,
}: MergeAttorneyDialogProps) {
  const [duplicates, setDuplicates] = useState<DuplicateAttorney[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [selectedPrimary, setSelectedPrimary] = useState<Record<number, string>>({});
  const [confirmMerge, setConfirmMerge] = useState<{ group: number; primary: string; duplicates: DuplicateAttorney[] } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchDuplicates();
    }
  }, [open]);

  const fetchDuplicates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('find_duplicate_referring_attorneys');
      if (error) throw error;

      setDuplicates(data || []);

      // Auto-select attorney with most linked data as primary
      const grouped = (data || []).reduce((acc: Record<number, DuplicateAttorney[]>, att: DuplicateAttorney) => {
        if (!acc[att.duplicate_group]) acc[att.duplicate_group] = [];
        acc[att.duplicate_group].push(att);
        return acc;
      }, {});

      const defaults: Record<number, string> = {};
      Object.entries(grouped).forEach(([group, attorneys]) => {
        const sorted = [...attorneys].sort((a, b) =>
          (b.claimant_count + b.appointment_count) - (a.claimant_count + a.appointment_count)
        );
        defaults[Number(group)] = sorted[0].attorney_id;
      });
      setSelectedPrimary(defaults);
    } catch (error) {
      console.error('Error fetching duplicates:', error);
      toast({
        title: "Error",
        description: "Failed to fetch duplicate attorneys.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const groupedDuplicates = duplicates.reduce((acc: Record<number, DuplicateAttorney[]>, att) => {
    if (!acc[att.duplicate_group]) acc[att.duplicate_group] = [];
    acc[att.duplicate_group].push(att);
    return acc;
  }, {});

  const handleMergeGroup = (group: number) => {
    const attorneys = groupedDuplicates[group];
    const primaryId = selectedPrimary[group];
    if (!primaryId) {
      toast({ title: "Select Primary", description: "Please select which attorney to keep.", variant: "destructive" });
      return;
    }
    setConfirmMerge({ group, primary: primaryId, duplicates: attorneys });
  };

  const executeMerge = async () => {
    if (!confirmMerge) return;
    setMerging(true);
    try {
      const { primary, duplicates: attorneys } = confirmMerge;
      const duplicatesToMerge = attorneys.filter(a => a.attorney_id !== primary);

      let totalMerged = { claimants: 0, appointments: 0, aod_docs: 0, documents: 0 };

      for (const dup of duplicatesToMerge) {
        const { data, error } = await supabase.rpc('merge_and_delete_duplicate_attorney', {
          p_duplicate_attorney_id: dup.attorney_id,
          p_primary_attorney_id: primary,
        });
        if (error) throw error;
        const result = data as any;
        if (!result.success) throw new Error(result.error || 'Merge failed');

        totalMerged.claimants += result.claimants_merged || 0;
        totalMerged.appointments += result.appointments_merged || 0;
        totalMerged.aod_docs += result.aod_docs_merged || 0;
        totalMerged.documents += result.documents_merged || 0;
      }

      toast({
        title: "Merge Successful",
        description: `Merged ${duplicatesToMerge.length} duplicate(s). Transferred ${totalMerged.claimants} claimants, ${totalMerged.appointments} appointments, ${totalMerged.documents} documents.`,
      });

      setConfirmMerge(null);
      fetchDuplicates();
      onMergeComplete();
    } catch (error) {
      console.error('Error merging attorneys:', error);
      toast({ title: "Merge Failed", description: "There was an error merging the duplicate attorneys.", variant: "destructive" });
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
              <Building2 className="h-5 w-5" />
              Merge Duplicate Referring Attorneys
            </DialogTitle>
            <DialogDescription>
              Review and merge duplicate referring attorneys. All linked data (claimants, appointments, documents) will be transferred to the primary record.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : Object.keys(groupedDuplicates).length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No Duplicates Found</p>
              <p className="text-muted-foreground">All referring attorneys have unique names.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <Badge variant="outline" className="text-sm">
                {Object.keys(groupedDuplicates).length} duplicate group(s) found
              </Badge>
              {Object.entries(groupedDuplicates).map(([group, attorneys]) => (
                <Card key={group} className="border-destructive/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      {attorneys[0].name}
                      <Badge variant="destructive">{attorneys.length} records</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Select the primary attorney to keep. All linked data from duplicates will be merged into this record.
                    </p>

                    <RadioGroup
                      value={selectedPrimary[Number(group)] || ""}
                      onValueChange={(value) => setSelectedPrimary(prev => ({ ...prev, [Number(group)]: value }))}
                    >
                      {attorneys.map((att) => (
                        <div
                          key={att.attorney_id}
                          className={`flex items-center space-x-3 p-3 rounded-lg border ${
                            selectedPrimary[Number(group)] === att.attorney_id
                              ? "border-primary bg-primary/5"
                              : "border-border"
                          }`}
                        >
                          <RadioGroupItem value={att.attorney_id} id={att.attorney_id} />
                          <Label htmlFor={att.attorney_id} className="flex-1 cursor-pointer">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium">{att.name}</span>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {att.contact_person && <Badge variant="outline">{att.contact_person}</Badge>}
                                  {att.province && <Badge variant="secondary">{att.province}</Badge>}
                                  {att.code && <Badge variant="outline" className="text-[10px]">Code: {att.code}</Badge>}
                                </div>
                              </div>
                              <div className="text-right text-sm">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Users className="h-3 w-3" />
                                  {att.claimant_count} claimants
                                </div>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <FileText className="h-3 w-3" />
                                  {att.appointment_count} appointments
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Added: {new Date(att.created_at).toLocaleDateString()}
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
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
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
                <li>Transfer all claimants, appointments, AOD documents, and files to the primary attorney</li>
                <li>Permanently delete {confirmMerge?.duplicates.filter(a => a.attorney_id !== confirmMerge.primary).length} duplicate record(s)</li>
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
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Merging...</>
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
