import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Settings2, History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AOD_LIFECYCLE_RULES_KEY,
  DEFAULT_AOD_LIFECYCLE_RULES,
  AODLifecycleRules,
} from "@/utils/aodLifecycleRules";

interface Props {
  /** Called after rules are saved or loaded so callers can refresh classifications. */
  onChange?: (rules: AODLifecycleRules) => void;
}

export const AODLifecycleRulesEditor = ({ onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<AODLifecycleRules>(DEFAULT_AOD_LIFECYCLE_RULES);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const loadRules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_value, updated_at")
        .eq("setting_key", AOD_LIFECYCLE_RULES_KEY)
        .maybeSingle();

      if (error) throw error;

      if (data?.setting_value) {
        const merged = { ...DEFAULT_AOD_LIFECYCLE_RULES, ...(data.setting_value as any) };
        setRules(merged);
        setUpdatedAt(data.updated_at as string);
      } else {
        setRules(DEFAULT_AOD_LIFECYCLE_RULES);
        setUpdatedAt(null);
      }
    } catch (e: any) {
      toast.error("Failed to load lifecycle rules: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadRules();
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Bump version on every successful save so each classification can be traced.
      const next: AODLifecycleRules = {
        ...rules,
        version: (rules.version || 1) + 1,
      };

      const { error } = await supabase
        .from("system_settings")
        .upsert(
          {
            setting_key: AOD_LIFECYCLE_RULES_KEY,
            category: "aod",
            setting_value: next as any,
            description: "Rules used to classify AOD agreements as Active, Dormant, or Closed",
            updated_by: user?.id ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "setting_key" }
        );

      if (error) throw error;

      toast.success(`Lifecycle rules saved (v${next.version})`);
      setRules(next);
      onChange?.(next);
      setOpen(false);
    } catch (e: any) {
      toast.error("Failed to save lifecycle rules: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setRules({ ...DEFAULT_AOD_LIFECYCLE_RULES, version: rules.version });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Lifecycle Rules
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            AOD Lifecycle Classification Rules
          </DialogTitle>
          <DialogDescription>
            Configure how Active, Dormant, and Closed are determined. Saving bumps the
            rule version so every classification can be traced back to the rules in force.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3 bg-muted/30">
              <div className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4 text-muted-foreground" />
                <span>Current rule version</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">v{rules.version}</div>
                {updatedAt && (
                  <div className="text-xs text-muted-foreground">
                    Updated {new Date(updatedAt).toLocaleString("en-ZA")}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dormancy-days">Dormancy window (days)</Label>
                <Input
                  id="dormancy-days"
                  type="number"
                  min={1}
                  value={rules.dormancy_days}
                  onChange={(e) =>
                    setRules({ ...rules, dormancy_days: Math.max(1, parseInt(e.target.value) || 0) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  No payments and no reports for this many days → Dormant.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rounding">Rounding tolerance (R)</Label>
                <Input
                  id="rounding"
                  type="number"
                  step="0.01"
                  min={0}
                  value={rules.rounding_tolerance}
                  onChange={(e) =>
                    setRules({ ...rules, rounding_tolerance: Math.max(0, parseFloat(e.target.value) || 0) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Difference between AOD total and assessment fees ≤ this is treated as in-sync.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paid-threshold">Fully-paid threshold (R)</Label>
                <Input
                  id="paid-threshold"
                  type="number"
                  step="0.01"
                  min={0}
                  value={rules.fully_paid_threshold}
                  onChange={(e) =>
                    setRules({ ...rules, fully_paid_threshold: Math.max(0, parseFloat(e.target.value) || 0) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Outstanding balance ≤ this counts as fully paid.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="min-reports">Min. reports for Closed</Label>
                <Input
                  id="min-reports"
                  type="number"
                  min={0}
                  value={rules.min_reports_for_closed}
                  onChange={(e) =>
                    setRules({ ...rules, min_reports_for_closed: Math.max(0, parseInt(e.target.value) || 0) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  At least this many reports must have been released to qualify as Closed.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="require-all" className="text-sm font-medium">
                  Require ALL agreed reports for Closed
                </Label>
                <p className="text-xs text-muted-foreground">
                  When on, an AOD only closes once reports released ≥ reports agreed.
                </p>
              </div>
              <Switch
                id="require-all"
                checked={rules.require_all_reports_for_closed}
                onCheckedChange={(v) =>
                  setRules({ ...rules, require_all_reports_for_closed: v })
                }
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleResetDefaults} disabled={saving || loading}>
            Reset to defaults
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save & bump version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
