import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCog className="h-4 w-4 text-primary" />
            Per-User Function Controls
          </CardTitle>
          <CardDescription className="text-xs">
            Enable or disable specific functions for each user. Changes take effect immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          {usersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No users found.</p>
          ) : (
            <ScrollArea className="h-[60vh] pr-2">
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
                    className="border border-border rounded-lg px-3"
                  >
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3 flex-1 text-left">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {initials(u)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{fullName(u)}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <div className="flex items-center gap-1.5 mr-3">
                          {u.role && (
                            <Badge variant="default" className="text-[10px] capitalize">
                              <ShieldCheck className="h-3 w-3 mr-1" />
                              {u.role.replace(/_/g, ' ')}
                            </Badge>
                          )}
                          {u.user_type && u.user_type !== u.role && (
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {u.user_type.replace(/_/g, ' ')}
                            </Badge>
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
            </ScrollArea>
          )}
        </CardContent>
      </Card>
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
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-6 space-y-3">
        <p className="text-sm text-muted-foreground">No function permissions configured for this user.</p>
        <Button size="sm" onClick={handleInitialize} disabled={mutating}>
          <RefreshCw className="h-3.5 w-3.5 mr-2" />
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
      <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-background/95 backdrop-blur border-b border-border flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          {enabledCount}/{totalCount} enabled
        </Badge>
        {pendingCount > 0 && (
          <Badge variant="default" className="text-[10px]">
            {pendingCount} unsaved change{pendingCount === 1 ? '' : 's'}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setAll(true)} disabled={saving || mutating}>
            Enable all
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAll(false)} disabled={saving || mutating}>
            Disable all
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPending({})}
            disabled={pendingCount === 0 || saving}
          >
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={pendingCount === 0 || saving || mutating}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </div>

      {categories.map((cat) => {
        const fns = grouped[cat];
        return (
          <div key={cat} className="rounded-md border border-border p-3 bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {cat}
              </h4>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setCategory(cat, true)} disabled={saving || mutating}>
                  Enable
                </Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setCategory(cat, false)} disabled={saving || mutating}>
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
                    <div className={`flex items-center justify-between p-2 rounded-md bg-background border ${mainChanged ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border'}`}>
                      <div>
                        <p className="text-sm font-medium">
                          {fnName}
                          {mainChanged && <span className="ml-2 text-[10px] text-primary">(pending)</span>}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {Object.keys(fn.subFunctions).length} sub-functions
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={mainVal ? 'default' : 'secondary'} className="text-[10px]">
                          {mainVal ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Switch
                          checked={mainVal}
                          disabled={saving || mutating}
                          onCheckedChange={(v) => stage(cat, fnName, null, v)}
                        />
                      </div>
                    </div>
                    {Object.keys(fn.subFunctions).length > 0 && (
                      <div className="ml-4 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        {Object.keys(fn.subFunctions).map((sub) => {
                          const subVal = currentValue(cat, fnName, sub);
                          const subChanged = keyOf(cat, fnName, sub) in pending;
                          return (
                            <div
                              key={sub}
                              className={`flex items-center justify-between px-2 py-1.5 rounded border bg-background ${subChanged ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border/60'}`}
                            >
                              <span className="text-xs">
                                {sub}
                                {subChanged && <span className="ml-1.5 text-[10px] text-primary">(pending)</span>}
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
    <div className="rounded-md border border-border p-3 bg-background">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
        <History className="h-3.5 w-3.5" />
        Permission Change History
      </h4>
      {isLoading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No changes recorded yet.</p>
      ) : (
        <ul className="space-y-1.5 max-h-60 overflow-y-auto">
          {logs.map((l: any) => {
            const oldV = (l.old_values as any)?.granted;
            const newV = (l.new_values as any)?.granted;
            return (
              <li
                key={l.id}
                className="text-[11px] flex items-start gap-2 p-2 rounded bg-muted/30 border border-border/50"
              >
                <Badge
                  variant={newV ? 'default' : 'secondary'}
                  className="text-[9px] shrink-0 mt-0.5"
                >
                  {oldV === null || oldV === undefined ? '—' : oldV ? 'ON' : 'OFF'}
                  {' → '}
                  {newV ? 'ON' : 'OFF'}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground break-words">{l.description}</p>
                  <p className="text-muted-foreground mt-0.5">
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
