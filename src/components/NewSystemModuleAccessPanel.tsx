import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';

interface ModuleRow {
  module_key: string;
  title: string;
  description: string | null;
  group_name: string | null;
}

interface DefaultRow {
  module_key: string;
  is_eligible: boolean;
  is_default_on: boolean;
}

interface OverrideRow {
  module_key: string;
  granted: boolean;
}

interface PendingState {
  pendingCount: number;
  saving: boolean;
  save: () => Promise<boolean>;
  reset: () => void;
}

interface Props {
  userId: string;
  onPendingStateChange: (s: PendingState) => void;
}

/**
 * Replaces the old category/function-based FunctionPermissionsManager.
 * One row per module, matching the sidebar exactly (same 22 keys, same
 * titles, same grouping) -- no categories, no sub-functions, no jargon,
 * and no toggle that appears to grant something the backend will still
 * deny: a module not eligible for this person's role simply isn't shown
 * as a live toggle at all.
 */
const NewSystemModuleAccessPanel: React.FC<Props> = ({ userId, onPendingStateChange }) => {
  const [loading, setLoading] = useState(true);
  const [roleKey, setRoleKey] = useState<string | null>(null);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [defaults, setDefaults] = useState<DefaultRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  // module_key -> desired granted state, only present while it differs
  // from the effective (override-or-default) value at load time.
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: assignment }, { data: moduleRows }] = await Promise.all([
      supabase.from('access_role_assignments').select('role_key').eq('user_id', userId).maybeSingle(),
      supabase.from('access_modules').select('module_key, title, description, group_name').order('group_name'),
    ]);

    setRoleKey(assignment?.role_key ?? null);
    setModules(moduleRows ?? []);

    if (assignment?.role_key) {
      const [{ data: defaultRows }, { data: overrideRows }] = await Promise.all([
        supabase.from('role_module_defaults').select('module_key, is_eligible, is_default_on').eq('role_key', assignment.role_key),
        supabase.from('user_module_overrides').select('module_key, granted').eq('user_id', userId),
      ]);
      setDefaults(defaultRows ?? []);
      setOverrides(overrideRows ?? []);
    } else {
      setDefaults([]);
      setOverrides([]);
    }
    setPending({});
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const defaultsByKey = useMemo(() => new Map(defaults.map((d) => [d.module_key, d])), [defaults]);
  const overridesByKey = useMemo(() => new Map(overrides.map((o) => [o.module_key, o.granted])), [overrides]);

  const effective = (moduleKey: string): { eligible: boolean; granted: boolean; isOverride: boolean } => {
    const d = defaultsByKey.get(moduleKey);
    if (!d || !d.is_eligible) return { eligible: false, granted: false, isOverride: false };
    if (moduleKey in pending) return { eligible: true, granted: pending[moduleKey], isOverride: pending[moduleKey] !== d.is_default_on };
    const override = overridesByKey.get(moduleKey);
    if (override !== undefined) return { eligible: true, granted: override, isOverride: override !== d.is_default_on };
    return { eligible: true, granted: d.is_default_on, isOverride: false };
  };

  const toggle = (moduleKey: string, next: boolean) => {
    setPending((prev) => {
      const updated = { ...prev, [moduleKey]: next };
      // If flipping back to exactly the role default, drop it from
      // pending entirely -- no point staging a no-op change.
      const d = defaultsByKey.get(moduleKey);
      if (d && next === d.is_default_on && overridesByKey.get(moduleKey) === undefined) {
        delete updated[moduleKey];
      }
      return updated;
    });
  };

  const save = async (): Promise<boolean> => {
    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const adminId = authData.user?.id;
      for (const [moduleKey, granted] of Object.entries(pending)) {
        const d = defaultsByKey.get(moduleKey);
        const matchesDefault = d && granted === d.is_default_on;
        const hadOverride = overridesByKey.has(moduleKey);

        if (matchesDefault) {
          if (hadOverride) {
            await supabase.from('user_module_overrides').delete().eq('user_id', userId).eq('module_key', moduleKey);
          }
          continue;
        }

        await supabase.from('user_module_overrides').upsert(
          { user_id: userId, module_key: moduleKey, granted, granted_by: adminId },
          { onConflict: 'user_id,module_key' }
        );
      }
      await load();
      return true;
    } catch (err) {
      console.error('Error saving module overrides:', err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const reset = () => setPending({});

  useEffect(() => {
    onPendingStateChange({ pendingCount: Object.keys(pending).length, saving, save, reset });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, saving, roleKey]);

  if (loading) {
    return <p className="text-xs text-slate-400">Loading module access…</p>;
  }

  if (!roleKey) {
    return (
      <div className="flex items-start gap-2 border border-dashed border-black/15 bg-black/[0.02] p-3 text-xs text-slate-500">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          This person has no new-system role assigned yet. Set their System Role on the left first —
          module access options will appear here once they do.
        </span>
      </div>
    );
  }

  const grouped = modules.reduce<Record<string, ModuleRow[]>>((acc, m) => {
    const g = m.group_name ?? 'Other';
    (acc[g] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([group, mods]) => (
        <div key={group}>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group}</p>
          <div className="divide-y divide-black/5 border border-black/10">
            {mods.map((m) => {
              const { eligible, granted, isOverride } = effective(m.module_key);
              return (
                <div key={m.module_key} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <Label className={`text-sm ${eligible ? 'text-black' : 'text-slate-400'}`}>{m.title}</Label>
                    {m.description && (
                      <p className="truncate text-[11px] text-slate-400">{m.description}</p>
                    )}
                    {!eligible && (
                      <p className="text-[11px] text-slate-400">Not available for this role</p>
                    )}
                    {eligible && isOverride && (
                      <p className="text-[11px] font-medium" style={{ color: '#0ea5e9' }}>
                        Individual override (role default is {granted ? 'off' : 'on'})
                      </p>
                    )}
                  </div>
                  {eligible ? (
                    <Switch checked={granted} onCheckedChange={(v) => toggle(m.module_key, v)} />
                  ) : (
                    <Switch checked={false} disabled />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default NewSystemModuleAccessPanel;
