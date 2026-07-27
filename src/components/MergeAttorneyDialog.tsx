import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, Building2, Users, FileText } from "lucide-react";
import { BRAND_TEAL, AdminEmptyState, AdminLoadingState } from "@/components/admin/ui/AdminUI";

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
  // Which group is showing its inline "are you sure" step — replaces the old
  // separate AlertDialog popup with an in-panel confirmation instead, so the
  // whole merge flow stays inside the one sliding sheet.
  const [confirmingGroup, setConfirmingGroup] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchDuplicates();
    } else {
      // Reset confirmation state when the sheet closes so it doesn't
      // reappear mid-warning the next time it's opened.
      setConfirmingGroup(null);
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
    if (!selectedPrimary[group]) {
      toast({ title: "Select Primary", description: "Please select which attorney to keep.", variant: "destructive" });
      return;
    }
    setConfirmingGroup(group);
  };

  const executeMerge = async (group: number) => {
    const primary = selectedPrimary[group];
    const attorneys = groupedDuplicates[group];
    if (!primary || !attorneys) return;

    setMerging(true);
    try {
      const duplicatesToMerge = attorneys.filter((a) => a.attorney_id !== primary);

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

      setConfirmingGroup(null);
      fetchDuplicates();
      onMergeComplete();
    } catch (error) {
      console.error('Error merging attorneys:', error);
      toast({ title: "Merge Failed", description: "There was an error merging the duplicate attorneys.", variant: "destructive" });
    } finally {
      setMerging(false);
    }
  };

  const groupCount = Object.keys(groupedDuplicates).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-2xl"
      >
        <SheetHeader className="space-y-1 border-b border-black/10 px-4 py-4 text-left sm:px-6">
          <SheetTitle className="flex items-center gap-2 text-black">
            <Building2 className="h-4 w-4" style={{ color: BRAND_TEAL }} />
            Merge Duplicate Referring Attorneys
          </SheetTitle>
          <SheetDescription className="text-xs text-slate-500">
            Review and merge duplicate referring attorneys. All linked data (claimants, appointments, documents) will be transferred to the primary record.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-4 py-4 sm:px-6">
          {loading ? (
            <AdminLoadingState label="Checking for duplicates…" />
          ) : groupCount === 0 ? (
            <AdminEmptyState
              icon={Building2}
              title="No Duplicates Found"
              description="All referring attorneys have unique names."
            />
          ) : (
            <div className="space-y-4">
              <Badge variant="outline" className="rounded-none border-black/15 text-xs">
                {groupCount} duplicate group{groupCount === 1 ? '' : 's'} found
              </Badge>

              {Object.entries(groupedDuplicates).map(([groupStr, attorneys]) => {
                const group = Number(groupStr);
                const isConfirming = confirmingGroup === group;
                const primaryId = selectedPrimary[group];
                const toRemove = attorneys.filter((a) => a.attorney_id !== primaryId);

                return (
                  <Card key={group} className="rounded-none border-destructive/40 shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-sm sm:text-base">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                        <span className="min-w-0 truncate">{attorneys[0].name}</span>
                        <Badge variant="destructive" className="shrink-0 rounded-none">{attorneys.length} records</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {isConfirming ? (
                        // Inline confirmation — replaces the old popup dialog so the
                        // person never leaves the sliding panel to confirm.
                        <div className="space-y-3 border border-destructive/40 bg-destructive/5 p-3 sm:p-4">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                            <div className="space-y-1.5 text-sm">
                              <p className="font-medium text-black">This will:</p>
                              <ul className="list-disc space-y-1 pl-4 text-xs text-slate-600 sm:text-sm">
                                <li>Transfer all claimants, appointments, AOD documents, and files to the primary attorney</li>
                                <li>Permanently delete {toRemove.length} duplicate record{toRemove.length === 1 ? '' : 's'}</li>
                              </ul>
                              <p className="text-xs font-medium text-destructive sm:text-sm">This action cannot be undone.</p>
                            </div>
                          </div>
                          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-none border-black/15"
                              disabled={merging}
                              onClick={() => setConfirmingGroup(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="rounded-none"
                              disabled={merging}
                              onClick={() => executeMerge(group)}
                            >
                              {merging ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Merging…</>
                              ) : (
                                "Confirm Merge & Delete"
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-slate-500 sm:text-sm">
                            Select the primary attorney to keep. All linked data from duplicates will be merged into this record.
                          </p>

                          <RadioGroup
                            value={primaryId || ""}
                            onValueChange={(value) => setSelectedPrimary((prev) => ({ ...prev, [group]: value }))}
                          >
                            {attorneys.map((att) => (
                              <div
                                key={att.attorney_id}
                                className={`flex items-start gap-3 border p-3 ${
                                  primaryId === att.attorney_id
                                    ? "border-black bg-black/[0.03]"
                                    : "border-black/10"
                                }`}
                              >
                                <RadioGroupItem value={att.attorney_id} id={att.attorney_id} className="mt-0.5 shrink-0" />
                                <Label htmlFor={att.attorney_id} className="min-w-0 flex-1 cursor-pointer">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                      <span className="block truncate font-medium">{att.name}</span>
                                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                        {att.contact_person && <Badge variant="outline" className="rounded-none border-black/15">{att.contact_person}</Badge>}
                                        {att.province && <Badge variant="secondary" className="rounded-none">{att.province}</Badge>}
                                        {att.code && <Badge variant="outline" className="rounded-none border-black/15 text-[10px]">Code: {att.code}</Badge>}
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 flex-row gap-3 text-xs text-muted-foreground sm:flex-col sm:items-end sm:gap-0.5 sm:text-sm">
                                      <div className="flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        {att.claimant_count} claimants
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <FileText className="h-3 w-3" />
                                        {att.appointment_count} appointments
                                      </div>
                                      <div className="text-[11px] text-muted-foreground sm:text-xs">
                                        Added: {new Date(att.created_at).toLocaleDateString()}
                                      </div>
                                    </div>
                                  </div>
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>

                          <Button
                            onClick={() => handleMergeGroup(group)}
                            variant="destructive"
                            size="sm"
                            className="w-full rounded-none sm:w-auto"
                            disabled={!primaryId}
                          >
                            Merge & Delete Duplicates
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <SheetFooter className="gap-2 border-t border-black/10 px-4 py-4 sm:px-6 sm:justify-end">
          <Button variant="outline" className="w-full rounded-none border-black/15 sm:w-auto" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
