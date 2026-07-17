import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, UserCog, ShieldCheck, Loader2, RefreshCw, History } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFunctionPermissions } from '@/hooks/useFunctionPermissions';
import { toast } from 'sonner';
import {
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminPill,
  AdminEmptyState,
  AdminLoadingState,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

interface UserRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
  user_type: string | null;
}

const UserControlTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const {
    getUserFunctionPermissions,
    groupPermissions,
    updateFunctionPermission,
    initializeFunctionPermissions,
    loading: mutating,
  } = useFunctionPermissions();

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['system-control-users'],
    queryFn: async (): Promise<UserRow[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role, user_type')
        .order('first_name', { ascending: true });
      if (error) throw error;
      return (data || []) as UserRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
      return (
        name.includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  const fullName = (u: UserRow) =>
    `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Unnamed user';

  const initials = (u: UserRow) => {
    const a = (u.first_name || u.email || '?').charAt(0);
    const b = (u.last_name || '').charAt(0);
    return (a + b).toUpperCase();
  };

  return (
    <div className="mt-4 space-y-4">
      <AdminCard>
        <AdminCardHeader
          icon={UserCog}
          title="Per-User Function Controls"
          description="Enable or disable specific functions for each user. Changes take effect immediately."
          actions={<AdminPill tone="neutral">{filtered.length} user{filtered.length === 1 ? '' : 's'}</AdminPill>}
        />
        <AdminCardBody>
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by name, email, or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-none border-black/15 pl-8"
            />
          </div>

          {usersLoading ? (
            <AdminLoadingState label="Loading users…" />
          ) : filtered.length === 0 ? (
            <AdminEmptyState icon={UserCog} title="No users found" />
          ) : (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-2">
              <Accordion
                type="single"
                collapsible
                value={openUserId || ''}
                onValueChange={(v) => setOpenUserId(v || null)}
                className="space-y-2"
              >
                {filtered.map((u) => (
                  <AccordionItem
                    key={u.id}
                    value={u.id}
                    className="border border-black/10 px-3"
                  >
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <div className="flex flex-1 items-center gap-3 text-left">
                        <Avatar className="h-9 w-9 rounded-none">
                          <AvatarFallback
                            className="rounded-none text-xs"
                            style={{ backgroundColor: `${BRAND_TEAL}1A`, color: BRAND_TEAL }}
                          >
                            {initials(u)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-black">{fullName(u)}</p>
                          <p className="truncate text-xs text-slate-500">{u.email}</p>
                        </div>
                        <div className="mr-3 hidden shrink-0 items-center gap-1.5 sm:flex">
                          {u.role && (
                            <AdminPill tone="teal" className="capitalize">
                              <ShieldCheck className="h-3 w-3" />
                              {u.role.replace(/_/g, ' ')}
                            </AdminPill>
                          )}
                          {u.user_type && u.user_type !== u.role && (
                            <AdminPill tone="neutral" className="capitalize">
                              {u.user_type.replace(/_/g, ' ')}
                            </AdminPill>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {openUserId === u.id && (
                        <UserPermissionsPanel
                          user={u}
                          getUserFunctionPermissions={getUserFunctionPermissions}
                          groupPermissions={groupPermissions}
                          updateFunctionPermission={updateFunctionPermission}
                          initializeFunctionPermissions={initializeFunctionPermissions}
                          mutating={mutating}
                          onChanged={() => queryClient.invalidateQueries({ queryKey: ['user-fn-perms', u.id] })}
                        />
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </AdminCardBody>
      </AdminCard>
    </div>
  );
};

interface PanelProps {
  user: UserRow;
  getUserFunctionPermissions: (id: string) => Promise<any[]>;
  groupPermissions: (perms: any[]) => any;
  updateFunctionPermission: (
    userId: string,
    cat: string,
    fn: string,
    sub: string | null,
    granted: boolean
  ) => Promise<boolean>;
  initializeFunctionPermissions: (userId: string, userType: string) => Promise<boolean>;
  mutating: boolean;
  onChanged: () => void;
}

type PendingMap = Record<string, boolean>; // key: cat||fn||sub('' if null)
const keyOf = (cat: string, fn: string, sub: string | null) => `${cat}||${fn}||${sub ?? ''}`;

const UserPermissionsPanel: React.FC<PanelProps> = ({
  user,
  getUserFunctionPermissions,
  groupPermissions,
  updateFunctionPermission,
  initializeFunctionPermissions,
  mutating,
  onChanged,
}) => {
  const queryClient = useQueryClient();
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['user-fn-perms', user.id],
    queryFn: () => getUserFunctionPermissions(user.id),
  });

  const grouped = groupPermissions(permissions);
  const categories = Object.keys(grouped);

  // Staged (pending) changes — only persisted on Save
  const [pending, setPending] = useState<PendingMap>({});
  const [saving, setSaving] = useState(false);

  // Reset draft when user/data changes
  React.useEffect(() => {
    setPending({});
  }, [user.id, permissions.length]);

  const currentValue = (cat: string, fn: string, sub: string | null): boolean => {
    const k = keyOf(cat, fn, sub);
    if (k in pending) return pending[k];
    const node = grouped[cat]?.[fn];
    return sub ? !!node?.subFunctions?.[sub] : !!node?.granted;
  };
  const originalValue = (cat: string, fn: string, sub: string | null): boolean => {
    const node = grouped[cat]?.[fn];
    return sub ? !!node?.subFunctions?.[sub] : !!node?.granted;
  };

  const stage = (cat: string, fn: string, sub: string | null, granted: boolean) => {
    const k = keyOf(cat, fn, sub);
    setPending((p) => {
      const next = { ...p };
      if (originalValue(cat, fn, sub) === granted) delete next[k];
      else next[k] = granted;
      return next;
    });
  };

  const setAll = (enable: boolean) => {
    const next: PendingMap = {};
    categories.forEach((cat) => {
      const fns = grouped[cat];
      Object.keys(fns).forEach((fnName) => {
        const fn = fns[fnName];
        if (fn.granted !== enable) next[keyOf(cat, fnName, null)] = enable;
        Object.keys(fn.subFunctions).forEach((sub) => {
          if (fn.subFunctions[sub] !== enable) next[keyOf(cat, fnName, sub)] = enable;
        });
      });
    });
    setPending(next);
  };

  const setCategory = (cat: string, enable: boolean) => {
    setPending((p) => {
      const next = { ...p };
      const fns = grouped[cat];
      Object.keys(fns).forEach((fnName) => {
        const fn = fns[fnName];
        const mk = keyOf(cat, fnName, null);
        if (fn.granted === enable) delete next[mk];
        else next[mk] = enable;
        Object.keys(fn.subFunctions).forEach((sub) => {
          const sk = keyOf(cat, fnName, sub);
          if (fn.subFunctions[sub] === enable) delete next[sk];
          else next[sk] = enable;
        });
      });
      return next;
    });
  };

  const pendingCount = Object.keys(pending).length;

  const handleSave = async () => {
    if (pendingCount === 0) return;
    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const actor = authData?.user;

    const changes = Object.entries(pending).map(([k, granted]) => {
      const [cat, fn, subRaw] = k.split('||');
      return { category: cat, function: fn, sub: subRaw === '' ? null : subRaw, granted };
    });

    const targetLabel = (c: typeof changes[number]) =>
      `${c.category} › ${c.function}${c.sub ? ` › ${c.sub}` : ''}`;
    const userLabel =
      `${(user.first_name || '').trim()} ${(user.last_name || '').trim()}`.trim() ||
      user.email ||
      'this user';

    const loadingId = toast.loading(
      `Saving ${changes.length} permission change${changes.length === 1 ? '' : 's'} for ${userLabel}…`
    );

    const { error: bulkError } = await supabase.rpc(
      'bulk_update_function_permissions' as any,
      { _user_id: user.id, _changes: changes as any }
    );

    // If the atomic bulk update fails, retry row-by-row so we can report
    // exactly which row(s) errored to the admin.
    const failedRows: { change: typeof changes[number]; message: string }[] = [];
    let succeededChanges = changes;

    if (bulkError) {
      succeededChanges = [];
      for (const c of changes) {
        const { error: rowErr } = await supabase
          .from('function_permissions' as any)
          .upsert(
            {
              user_id: user.id,
              function_category: c.category,
              function_name: c.function,
              sub_function: c.sub,
              granted: c.granted,
              user_type: user.user_type || user.role || 'employee',
            } as any,
            { onConflict: 'user_id,function_category,function_name,sub_function' }
          );
        if (rowErr) failedRows.push({ change: c, message: rowErr.message });
        else succeededChanges.push(c);
      }

      if (succeededChanges.length === 0) {
        setSaving(false);
        toast.dismiss(loadingId);
        toast.error('Save failed — no changes were saved', {
          description: `${bulkError.message}${failedRows.length ? `\nFirst row error: ${failedRows[0].message}` : ''}`,
          duration: 8000,
        });
        return;
      }
    }

    // Build audit log entries for whatever did save
    const auditEntries = succeededChanges.map(({ category, function: fn, sub, granted }) => {
      const oldGranted = originalValue(category, fn, sub);
      const target = `${category} › ${fn}${sub ? ` › ${sub}` : ''}`;
      return {
        table_name: 'function_permissions',
        record_id: user.id,
        action_type: 'UPDATE',
        function_area: 'Per-User Function Controls',
        user_id: actor?.id ?? null,
        user_email: actor?.email ?? null,
        old_values: { granted: oldGranted } as any,
        new_values: { granted } as any,
        changed_fields: ['granted'] as any,
        description: `${actor?.email ?? 'Unknown'} ${granted ? 'enabled' : 'disabled'} "${target}" for ${userLabel} (${user.email ?? user.id})`.trim(),
        user_agent: navigator.userAgent,
      };
    });

    if (auditEntries.length > 0) {
      try { await supabase.from('audit_logs').insert(auditEntries as any); }
      catch (e) { console.error('Audit log insert failed', e); }
    }

    // Re-queue any failed rows so the admin can retry them
    const stillPending: Record<string, boolean> = {};
    failedRows.forEach(({ change }) => {
      const key = `${change.category}||${change.function}||${change.sub ?? ''}`;
      stillPending[key] = change.granted;
    });

    setSaving(false);
    setPending(stillPending);
    queryClient.invalidateQueries({ queryKey: ['user-fn-perms', user.id] });
    queryClient.invalidateQueries({ queryKey: ['user-perm-audit', user.id] });
    onChanged();

    toast.dismiss(loadingId);

    const enabledCount = succeededChanges.filter(c => c.granted).length;
    const disabledCount = succeededChanges.length - enabledCount;
    const summary = [
      enabledCount ? `${enabledCount} enabled` : null,
      disabledCount ? `${disabledCount} disabled` : null,
    ].filter(Boolean).join(' · ');

    if (failedRows.length === 0) {
      toast.success(
        `Saved ${succeededChanges.length} change${succeededChanges.length === 1 ? '' : 's'} for ${userLabel}`,
        { description: summary || undefined, duration: 4000 }
      );
    } else {
      const failedList = failedRows.slice(0, 5).map(f => `• ${targetLabel(f.change)} — ${f.message}`).join('\n');
      const more = failedRows.length > 5 ? `\n…and ${failedRows.length - 5} more` : '';
      toast.warning(
        `Saved ${succeededChanges.length}, failed ${failedRows.length} for ${userLabel}`,
        {
          description: `${summary ? summary + '\n' : ''}Failed row${failedRows.length === 1 ? '' : 's'}:\n${failedList}${more}\nFailed rows kept pending so you can retry.`,
          duration: 10000,
        }
      );
    }
  };


  const handleInitialize = async () => {
    const ok = await initializeFunctionPermissions(
      user.id,
      user.user_type || user.role || 'employee'
    );
    if (ok) {
      toast.success('Default permissions initialized');
      queryClient.invalidateQueries({ queryKey: ['user-fn-perms', user.id] });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: BRAND_TEAL }} />
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="space-y-3 py-6 text-center">
        <p className="text-sm text-slate-500">No function permissions configured for this user.</p>
        <Button size="sm" className="rounded-none" onClick={handleInitialize} disabled={mutating}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Initialize default permissions
        </Button>
      </div>
    );
  }

  // Summary counts (using effective/staged values)
  let enabledCount = 0, totalCount = 0;
  categories.forEach((cat) => {
    const fns = grouped[cat];
    Object.keys(fns).forEach((fnName) => {
      const fn = fns[fnName];
      totalCount += 1 + Object.keys(fn.subFunctions).length;
      if (currentValue(cat, fnName, null)) enabledCount += 1;
      Object.keys(fn.subFunctions).forEach((sub) => {
        if (currentValue(cat, fnName, sub)) enabledCount += 1;
      });
    });
  });

  return (
    <div className="space-y-3 pb-2">
      {/* Sticky action bar */}
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 border-b border-black/10 bg-white/95 px-1 py-2 backdrop-blur">
        <AdminPill tone="neutral">{enabledCount}/{totalCount} enabled</AdminPill>
        {pendingCount > 0 && (
          <AdminPill tone="teal">{pendingCount} unsaved change{pendingCount === 1 ? '' : 's'}</AdminPill>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="rounded-none border-black/15 hover:bg-black/5" onClick={() => setAll(true)} disabled={saving || mutating}>
            Enable all
          </Button>
          <Button size="sm" variant="outline" className="rounded-none border-black/15 hover:bg-black/5" onClick={() => setAll(false)} disabled={saving || mutating}>
            Disable all
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-none hover:bg-black/5"
            onClick={() => setPending({})}
            disabled={pendingCount === 0 || saving}
          >
            Reset
          </Button>
          <Button
            size="sm"
            className="rounded-none text-white hover:opacity-90"
            style={{ backgroundColor: BRAND_TEAL }}
            onClick={handleSave}
            disabled={pendingCount === 0 || saving || mutating}
          >
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </div>

      {categories.map((cat) => {
        const fns = grouped[cat];
        return (
          <div key={cat} className="border border-black/10 bg-black/[0.02] p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {cat}
              </h4>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-6 rounded-none px-2 text-[10px] hover:bg-black/5" onClick={() => setCategory(cat, true)} disabled={saving || mutating}>
                  Enable
                </Button>
                <Button size="sm" variant="ghost" className="h-6 rounded-none px-2 text-[10px] hover:bg-black/5" onClick={() => setCategory(cat, false)} disabled={saving || mutating}>
                  Disable
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              {Object.keys(fns).map((fnName) => {
                const fn = fns[fnName];
                const mainVal = currentValue(cat, fnName, null);
                const mainChanged = keyOf(cat, fnName, null) in pending;
                return (
                  <div key={fnName} className="space-y-2">
                    <div
                      className="flex items-center justify-between border bg-white p-2"
                      style={mainChanged ? { borderColor: BRAND_TEAL } : { borderColor: 'rgba(0,0,0,0.1)' }}
                    >
                      <div>
                        <p className="text-sm font-medium text-black">
                          {fnName}
                          {mainChanged && <span className="ml-2 text-[10px]" style={{ color: BRAND_TEAL }}>(pending)</span>}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {Object.keys(fn.subFunctions).length} sub-functions
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <AdminPill tone={mainVal ? 'teal' : 'neutral'}>{mainVal ? 'Enabled' : 'Disabled'}</AdminPill>
                        <Switch
                          checked={mainVal}
                          disabled={saving || mutating}
                          onCheckedChange={(v) => stage(cat, fnName, null, v)}
                        />
                      </div>
                    </div>
                    {Object.keys(fn.subFunctions).length > 0 && (
                      <div className="ml-4 grid grid-cols-1 gap-1.5 md:grid-cols-2">
                        {Object.keys(fn.subFunctions).map((sub) => {
                          const subVal = currentValue(cat, fnName, sub);
                          const subChanged = keyOf(cat, fnName, sub) in pending;
                          return (
                            <div
                              key={sub}
                              className="flex items-center justify-between border bg-white px-2 py-1.5"
                              style={subChanged ? { borderColor: BRAND_TEAL } : { borderColor: 'rgba(0,0,0,0.08)' }}
                            >
                              <span className="text-xs text-slate-700">
                                {sub}
                                {subChanged && <span className="ml-1.5 text-[10px]" style={{ color: BRAND_TEAL }}>(pending)</span>}
                              </span>
                              <Switch
                                checked={subVal}
                                disabled={saving || mutating}
                                onCheckedChange={(v) => stage(cat, fnName, sub, v)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <PermissionAuditHistory userId={user.id} />
    </div>
  );
};

const PermissionAuditHistory: React.FC<{ userId: string }> = ({ userId }) => {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['user-perm-audit', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, created_at, user_email, description, old_values, new_values')
        .eq('table_name', 'function_permissions')
        .eq('record_id', userId)
        .order('created_at', { ascending: false })
        .limit(25);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="border border-black/10 bg-white p-3">
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <History className="h-3.5 w-3.5" />
        Permission Change History
      </h4>
      {isLoading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: BRAND_TEAL }} />
        </div>
      ) : logs.length === 0 ? (
        <p className="py-2 text-xs text-slate-500">No changes recorded yet.</p>
      ) : (
        <ul className="max-h-60 space-y-1.5 overflow-y-auto">
          {logs.map((l: any) => {
            const oldV = (l.old_values as any)?.granted;
            const newV = (l.new_values as any)?.granted;
            return (
              <li
                key={l.id}
                className="flex items-start gap-2 border border-black/10 bg-black/[0.02] p-2 text-[11px]"
              >
                <AdminPill tone={newV ? 'teal' : 'neutral'} className="mt-0.5 shrink-0">
                  {oldV === null || oldV === undefined ? '—' : oldV ? 'ON' : 'OFF'}
                  {' → '}
                  {newV ? 'ON' : 'OFF'}
                </AdminPill>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-black">{l.description}</p>
                  <p className="mt-0.5 text-slate-500">
                    {new Date(l.created_at).toLocaleString('en-ZA', {
                      timeZone: 'Africa/Johannesburg',
                    })}
                    {l.user_email ? ` • by ${l.user_email}` : ''}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default UserControlTab;
