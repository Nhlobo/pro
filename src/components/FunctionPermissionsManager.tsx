import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Stethoscope,
  MapPin,
  FileText,
  FolderLock,
  DollarSign,
  Calendar,
  BarChart3,
  ShieldCheck,
  HeadsetIcon,
  Settings,
  Mail,
  Save,
  Search,
  CheckCircle2,
  Power,
  Sparkles,
  Eye,
  Wrench,
  Crown,
  UserCog,
  Ban,
  CheckSquare,
  Square,
  ListChecks,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useFunctionPermissions, GroupedPermissions, PREDEFINED_FUNCTIONS } from '@/hooks/useFunctionPermissions';
import { UserProfile, usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';


interface FunctionPermissionsManagerProps {
  user: UserProfile;
  onPermissionChange?: () => void;
}

/**
 * Admin Portal modules are sourced from the single source of truth in
 * `@/config/adminModules` so the IAM allocation UI is always aligned
 * with the actual sidebar — for both new and existing users.
 */
import {
  ADMIN_MODULES as SHARED_ADMIN_MODULES,
  ADMIN_MODULE_GROUP_ORDER,
  type AdminModule,
  type AdminModuleGroup,
} from '@/config/adminModules';

type ModuleDef = AdminModule;

// Account modules with no backing permissions are not allocatable.
const ADMIN_MODULES: ModuleDef[] = SHARED_ADMIN_MODULES.filter(m => m.permissions.length > 0);

const GROUP_ORDER: AdminModuleGroup[] = ADMIN_MODULE_GROUP_ORDER.filter(g =>
  ADMIN_MODULES.some(m => m.group === g),
);

const GROUP_ACCENT: Record<AdminModuleGroup, string> = {
  Core: 'bg-primary/10 text-primary border-primary/20',
  Intelligence: 'bg-secondary text-secondary-foreground border-border',
  Workflow: 'bg-accent text-accent-foreground border-border',
  System: 'bg-muted text-foreground border-border',
  Account: 'bg-muted text-foreground border-border',
};

/**
 * Role-based permission presets — one-click bundles that map a role
 * to a set of Admin Portal modules. Applying a preset enables the listed
 * modules and disables everything else.
 */
type PresetDef = {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  suggestedRole?: 'admin' | 'employee' | 'referring_attorney' | 'user';
  moduleKeys: string[]; // module keys from ADMIN_MODULES; [] + role 'admin' = all
  accent: string;
};

const ROLE_PRESETS: PresetDef[] = [
  {
    key: 'full-admin',
    title: 'Full Administrator',
    description: 'All Admin Portal modules — complete system access',
    icon: Crown,
    suggestedRole: 'admin',
    moduleKeys: ADMIN_MODULES.map(m => m.key),
    accent: 'border-primary/40 bg-primary/5 hover:bg-primary/10',
  },
  {
    key: 'case-manager',
    title: 'Case Manager',
    description: 'Cases, claimants, appointments, reports, documents',
    icon: Briefcase,
    suggestedRole: 'employee',
    moduleKeys: ['operations', 'cases', 'appointments', 'reports', 'documents', 'experts'],
    accent: 'border-border bg-card hover:bg-muted/50',
  },
  {
    key: 'finance-officer',
    title: 'Finance Officer',
    description: 'AOD, payments, debtors, reporting & email queue',
    icon: DollarSign,
    suggestedRole: 'employee',
    moduleKeys: ['operations', 'finance', 'reports', 'analytics', 'email'],
    accent: 'border-border bg-card hover:bg-muted/50',
  },
  {
    key: 'crm-sales',
    title: 'CRM / Sales',
    description: 'Attorney CRM, pitchlog & analytics',
    icon: UserCog,
    suggestedRole: 'employee',
    moduleKeys: ['operations', 'attorney-crm', 'analytics'],
    accent: 'border-border bg-card hover:bg-muted/50',
  },
  {
    key: 'support-agent',
    title: 'Support Agent',
    description: 'Support hub, email history & basic dashboards',
    icon: HeadsetIcon,
    suggestedRole: 'employee',
    moduleKeys: ['operations', 'support', 'email'],
    accent: 'border-border bg-card hover:bg-muted/50',
  },
  {
    key: 'read-only',
    title: 'Read-Only Viewer',
    description: 'Operations dashboard & analytics only',
    icon: Eye,
    suggestedRole: 'user',
    moduleKeys: ['operations', 'analytics'],
    accent: 'border-border bg-card hover:bg-muted/50',
  },
  {
    key: 'ops-tech',
    title: 'Operations / Tech',
    description: 'System control, IAM, analytics & support',
    icon: Wrench,
    suggestedRole: 'admin',
    moduleKeys: ['operations', 'system-control', 'iam', 'analytics', 'support'],
    accent: 'border-border bg-card hover:bg-muted/50',
  },
  {
    key: 'no-access',
    title: 'Revoke All Access',
    description: 'Disable every module (clean slate)',
    icon: Ban,
    suggestedRole: 'user',
    moduleKeys: [],
    accent: 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10',
  },
];

const FunctionPermissionsManager: React.FC<FunctionPermissionsManagerProps> = ({ user, onPermissionChange }) => {
  const {
    getUserFunctionPermissions,
    groupPermissions,
    updateFunctionPermission,
    addSubFunction,
    loading,
  } = useFunctionPermissions();
  const { updateUserRole, isAdmin } = usePermissions();
  

  const [grouped, setGrouped] = useState<GroupedPermissions>({});
  const [selectedRole, setSelectedRole] = useState<string>(user.role || 'user');
  const [hasRoleChange, setHasRoleChange] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [pendingBulk, setPendingBulk] = useState<{ scope: 'all' | 'selected'; enable: boolean } | null>(null);

  /**
   * Staged permission changes — keyed by `${category}||${functionName}||${sub|''}`.
   * Toggling any switch only stages a value; nothing is persisted until "Save".
   */
  type PendingMap = Record<string, boolean>;
  const [pending, setPending] = useState<PendingMap>({});
  const [saving, setSaving] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  /** Build a structured diff of all pending changes for the confirm modal. */
  const pendingChangesList = useMemo(() => {
    return Object.entries(pending)
      .map(([k, to]) => {
        const [category, functionName, subRaw] = k.split('||');
        const sub = subRaw || null;
        const from = storedValue(category, functionName, sub);
        return { key: k, category, functionName, sub, from, to };
      })
      .sort((a, b) =>
        a.category.localeCompare(b.category) ||
        a.functionName.localeCompare(b.functionName) ||
        (a.sub ?? '').localeCompare(b.sub ?? '')
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, grouped]);

  const enableCount = pendingChangesList.filter(c => c.to).length;
  const disableCount = pendingChangesList.length - enableCount;

  const permKey = (category: string, functionName: string, sub: string | null) =>
    `${category}||${functionName}||${sub ?? ''}`;

  useEffect(() => {
    fetchPermissions();
    setSelectedRole(user.role || 'user');
    setHasRoleChange(false);
    setPending({});
  }, [user.id, user.role]);

  const fetchPermissions = async () => {
    const list = await getUserFunctionPermissions(user.id);
    setGrouped(groupPermissions(list));
  };

  /** Stored (persisted) value for a permission row. */
  const storedValue = (category: string, functionName: string, sub: string | null): boolean => {
    if (sub) return grouped[category]?.[functionName]?.subFunctions?.[sub] ?? false;
    return grouped[category]?.[functionName]?.granted ?? false;
  };

  /** Effective value = pending override if any, else stored. */
  const effectiveValue = (category: string, functionName: string, sub: string | null): boolean => {
    const k = permKey(category, functionName, sub);
    if (k in pending) return pending[k];
    return storedValue(category, functionName, sub);
  };

  /** Stage a single permission change (or remove it if it matches the stored value). */
  const stagePerm = (category: string, functionName: string, sub: string | null, value: boolean) => {
    setPending(prev => {
      const next = { ...prev };
      const k = permKey(category, functionName, sub);
      if (storedValue(category, functionName, sub) === value) {
        delete next[k];
      } else {
        next[k] = value;
      }
      return next;
    });
  };

  /** Stage an entire module: main function + every predefined sub-function. */
  const stageModule = (mod: ModuleDef, enable: boolean) => {
    const fns = resolveModuleFunctions(mod);
    setPending(prev => {
      const next = { ...prev };
      for (const f of fns) {
        const mainK = permKey(f.category, f.functionName, null);
        if (storedValue(f.category, f.functionName, null) === enable) delete next[mainK];
        else next[mainK] = enable;

        const subs = PREDEFINED_FUNCTIONS[f.category]?.[f.functionName]?.subFunctions ?? [];
        for (const sub of subs) {
          const k = permKey(f.category, f.functionName, sub);
          if (storedValue(f.category, f.functionName, sub) === enable) delete next[k];
          else next[k] = enable;
        }
      }
      return next;
    });
  };

  const pendingCount = Object.keys(pending).length;

  const resetPending = () => setPending({});

  const savePending = async () => {
    if (pendingCount === 0) return;
    setSaving(true);
    setBusy(true);
    try {
      const entries = Object.entries(pending);
      const changes = entries.map(([k, value]) => {
        const [category, functionName, subRaw] = k.split('||');
        return {
          category,
          function: functionName,
          sub: subRaw ? subRaw : null,
          granted: value,
          user_type: user.user_type || 'employee',
        };
      });

      const { error } = await supabase.rpc('bulk_update_function_permissions' as any, {
        _user_id: user.id,
        _changes: changes as any,
      });

      if (error) {
        toast.error(`Save failed: ${error.message}`);
        return;
      }

      await fetchPermissions();
      setPending({});
      setConfirmSaveOpen(false);
      onPermissionChange?.();
      toast.success(`Saved ${entries.length} permission change${entries.length === 1 ? '' : 's'}`);
    } finally {
      setSaving(false);
      setBusy(false);
    }
  };

  /** Resolve all (category, functionName) pairs that back a module. */
  const resolveModuleFunctions = (mod: ModuleDef): Array<{ category: string; functionName: string }> => {
    const result: Array<{ category: string; functionName: string }> = [];
    mod.permissions.forEach(p => {
      const categoryFns = PREDEFINED_FUNCTIONS[p.category];
      if (!categoryFns) return;
      if (p.functionName) {
        if (categoryFns[p.functionName]) {
          result.push({ category: p.category, functionName: p.functionName });
        }
      } else {
        Object.keys(categoryFns).forEach(fn => result.push({ category: p.category, functionName: fn }));
      }
    });
    return result;
  };

  const isModuleEnabled = (mod: ModuleDef): boolean => {
    const fns = resolveModuleFunctions(mod);
    if (fns.length === 0) return false;
    return fns.every(f => effectiveValue(f.category, f.functionName, null));
  };

  const moduleEnabledCount = (mod: ModuleDef): { granted: number; total: number } => {
    const fns = resolveModuleFunctions(mod);
    const granted = fns.filter(f => effectiveValue(f.category, f.functionName, null)).length;
    return { granted, total: fns.length };
  };

  /** Stage a module change (main + every predefined sub-function). */
  const toggleModule = (mod: ModuleDef, enable: boolean) => {
    if (!isAdmin()) {
      toast.error('Only administrators can change permissions');
      return;
    }
    stageModule(mod, enable);
  };

  /** Stage a single sub-function change. */
  const toggleSubFunction = (
    category: string,
    functionName: string,
    sub: string,
    granted: boolean,
  ) => {
    if (!isAdmin()) {
      toast.error('Only administrators can change permissions');
      return;
    }
    stagePerm(category, functionName, sub, granted);
  };

  const handleRoleChange = (newRole: string) => {
    setSelectedRole(newRole);
    setHasRoleChange(user.role !== newRole);
  };

  const saveRole = async () => {
    if (!isAdmin()) {
      toast.error('Only administrators can change user roles');
      return;
    }
    if (selectedRole === user.role) {
      setHasRoleChange(false);
      return;
    }
    const ok = await updateUserRole(user.id, selectedRole);
    if (ok) {
      toast.success('User role updated');
      setHasRoleChange(false);
      onPermissionChange?.();
    } else {
      toast.error('Failed to update role');
    }
  };

  /** Stage a full preset. User must click Save to persist. */
  const applyPreset = (preset: PresetDef) => {
    if (!isAdmin()) {
      toast.error('Only administrators can apply presets');
      return;
    }
    const enabledKeys = new Set(preset.moduleKeys);
    for (const mod of ADMIN_MODULES) {
      stageModule(mod, enabledKeys.has(mod.key));
    }
    if (preset.suggestedRole && preset.suggestedRole !== user.role) {
      setSelectedRole(preset.suggestedRole);
      setHasRoleChange(true);
    }
    toast.info(`Staged "${preset.title}" — click Save to apply`);
  };

  const enableAllInGroup = (group: ModuleDef['group'], enable: boolean) => {
    if (!isAdmin()) return;
    const mods = ADMIN_MODULES.filter(m => m.group === group);
    for (const m of mods) stageModule(m, enable);
  };


  const setAllModules = (enable: boolean) => {
    if (!isAdmin()) {
      toast.error('Only administrators can change permissions');
      return;
    }
    setPendingBulk({ scope: 'all', enable });
  };

  const applyBulkToSelected = (enable: boolean) => {
    if (!isAdmin()) {
      toast.error('Only administrators can change permissions');
      return;
    }
    if (selectedKeys.size === 0) {
      toast.info('Select at least one module first');
      return;
    }
    setPendingBulk({ scope: 'selected', enable });
  };

  /** Modules targeted by the currently-pending bulk action. */
  const pendingTargetModules: ModuleDef[] = useMemo(() => {
    if (!pendingBulk) return [];
    return pendingBulk.scope === 'all'
      ? ADMIN_MODULES
      : ADMIN_MODULES.filter(m => selectedKeys.has(m.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBulk, selectedKeys]);

  /** Split target modules into ones that will actually change vs. already in target state. */
  const pendingDiff = useMemo(() => {
    if (!pendingBulk) return { changing: [] as ModuleDef[], unchanged: [] as ModuleDef[] };
    const changing: ModuleDef[] = [];
    const unchanged: ModuleDef[] = [];
    for (const m of pendingTargetModules) {
      const { granted, total } = moduleEnabledCount(m);
      const isFullyEnabled = total > 0 && granted === total;
      const isFullyDisabled = granted === 0;
      const matchesTarget = pendingBulk.enable ? isFullyEnabled : isFullyDisabled;
      if (matchesTarget) unchanged.push(m);
      else changing.push(m);
    }
    return { changing, unchanged };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBulk, pendingTargetModules, grouped]);

  const performPendingBulk = async () => {
    if (!pendingBulk) return;
    const { enable } = pendingBulk;
    const mods = pendingDiff.changing;
    if (mods.length === 0) {
      toast.info('No changes to apply');
      return;
    }
    // Stage the bulk change (main + sub-functions); user must Save to persist.
    for (const m of mods) stageModule(m, enable);
    toast.info(
      pendingBulk.scope === 'all'
        ? `Staged ${enable ? 'enable' : 'disable'} for all modules — click Save to apply`
        : `Staged ${enable ? 'enable' : 'disable'} for ${mods.length} module${mods.length === 1 ? '' : 's'} — click Save to apply`,
    );
    setPendingBulk(null);
  };



  const toggleSelectKey = (key: string, checked: boolean) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (checked) next.add(key); else next.delete(key);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedKeys(new Set(filteredModules.map(m => m.key)));
  };

  const clearSelection = () => setSelectedKeys(new Set());

  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ADMIN_MODULES;
    return ADMIN_MODULES.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.group.toLowerCase().includes(q),
    );
  }, [search]);

  const totalEnabled = ADMIN_MODULES.filter(isModuleEnabled).length;

  if (loading && Object.keys(grouped).length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header: identity + role */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border bg-card">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">
            {(user.first_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">
              {user.first_name} {user.last_name}
            </div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          </div>
          <Badge variant="outline" className="ml-2 text-xs">
            {user.user_type === 'referring_attorney' ? 'Attorney' : 'Staff'}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {totalEnabled}/{ADMIN_MODULES.length} modules
          </Badge>
          {isAdmin() && (
            <>
              <Select value={selectedRole} onValueChange={handleRoleChange}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="referring_attorney">Attorney</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant={hasRoleChange ? 'default' : 'outline'}
                disabled={!hasRoleChange}
                onClick={saveRole}
                className="gap-1.5 h-8"
              >
                <Save className="h-3.5 w-3.5" />
                Save Role
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Role-based presets — one-click access bundles */}
      {isAdmin() && (
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold">Role-based Presets</span>
            <span className="text-[11px] text-muted-foreground">
              One-click access bundles — applies modules and (optionally) syncs the user role
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {ROLE_PRESETS.map((preset) => {
              const Icon = preset.icon;
              return (
                <button
                  key={preset.key}
                  type="button"
                  disabled={busy}
                  onClick={() => applyPreset(preset)}
                  className={`text-left rounded-md border p-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${preset.accent}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium truncate">{preset.title}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground line-clamp-2">
                    {preset.description}
                  </div>
                  {preset.suggestedRole && (
                    <Badge variant="outline" className="mt-1 text-[9px] px-1 py-0 h-4">
                      {preset.suggestedRole}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search + global / bulk controls */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search Admin Portal modules..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          {isAdmin() && (
            <>
              <Button
                size="sm"
                variant={bulkMode ? 'default' : 'outline'}
                className="h-9 gap-1.5"
                onClick={() => { setBulkMode(v => !v); clearSelection(); }}
              >
                <ListChecks className="h-4 w-4" />
                {bulkMode ? 'Exit bulk' : 'Bulk select'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1.5"
                disabled={busy}
                onClick={() => setAllModules(true)}
              >
                <Power className="h-4 w-4" />
                Enable all
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1.5 text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => setAllModules(false)}
              >
                <Ban className="h-4 w-4" />
                Disable all
              </Button>
            </>
          )}
        </div>

        {bulkMode && isAdmin() && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-md border bg-muted/40">
            <Badge variant="secondary" className="text-xs">
              {selectedKeys.size} selected
            </Badge>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAllVisible}>
              <CheckSquare className="h-3.5 w-3.5 mr-1" /> Select visible
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearSelection}>
              <Square className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={busy || selectedKeys.size === 0}
                onClick={() => applyBulkToSelected(true)}
              >
                <Power className="h-3.5 w-3.5" /> Enable selected
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs gap-1"
                disabled={busy || selectedKeys.size === 0}
                onClick={() => applyBulkToSelected(false)}
              >
                <Ban className="h-3.5 w-3.5" /> Disable selected
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Pending changes save bar */}
      {isAdmin() && (
        <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-md border ${pendingCount > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-muted/30'}`}>
          <div className="text-xs flex items-center gap-2">
            <Badge variant={pendingCount > 0 ? 'default' : 'secondary'} className="text-xs">
              {pendingCount} pending change{pendingCount === 1 ? '' : 's'}
            </Badge>
            <span className="text-muted-foreground">
              {pendingCount === 0
                ? 'Toggle a switch to stage a change. Nothing is saved until you click Save.'
                : 'Review changes above, then click Save to apply.'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              disabled={pendingCount === 0 || saving}
              onClick={resetPending}
            >
              Reset
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5"
              disabled={pendingCount === 0 || saving}
              onClick={savePending}
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : `Save${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
            </Button>
          </div>
        </div>
      )}

      {/* Module groups — mirrors Admin Portal sidebar */}
      <ScrollArea className="flex-1 border rounded-lg bg-background">

        <div className="p-3 space-y-4">
          {GROUP_ORDER.map(group => {
            const mods = filteredModules.filter(m => m.group === group);
            if (mods.length === 0) return null;
            const groupEnabled = mods.every(isModuleEnabled);
            return (
              <div key={group}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${GROUP_ACCENT[group]}`}>
                      {group}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {mods.filter(isModuleEnabled).length}/{mods.length} enabled
                    </span>
                  </div>
                  {isAdmin() && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      disabled={busy}
                      onClick={() => enableAllInGroup(group, !groupEnabled)}
                    >
                      <Power className="h-3 w-3" />
                      {groupEnabled ? 'Disable all' : 'Enable all'}
                    </Button>
                  )}
                </div>

                <Accordion type="multiple" className="space-y-2">
                  {mods.map(mod => {
                    const Icon = mod.icon;
                    const enabled = isModuleEnabled(mod);
                    const counts = moduleEnabledCount(mod);
                    const fns = resolveModuleFunctions(mod);

                    return (
                      <AccordionItem
                        key={mod.key}
                        value={mod.key}
                        className="border rounded-lg bg-card overflow-hidden"
                      >
                        <div className="flex items-center gap-2 px-3 py-2">
                          {bulkMode && isAdmin() && (
                            <Checkbox
                              checked={selectedKeys.has(mod.key)}
                              onCheckedChange={(v) => toggleSelectKey(mod.key, v === true)}
                              aria-label={`Select ${mod.title}`}
                            />
                          )}
                          <div className={`p-1.5 rounded-md ${enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <AccordionTrigger className="flex-1 hover:no-underline py-0 [&[data-state=open]>svg]:rotate-180">
                            <div className="flex flex-col items-start text-left min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{mod.title}</span>
                                {enabled && (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground truncate">
                                {mod.description}
                              </span>
                            </div>
                          </AccordionTrigger>
                          <div className="flex items-center gap-2 pl-2">
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                              {counts.granted}/{counts.total}
                            </span>
                            <Switch
                              checked={enabled}
                              disabled={busy || !isAdmin()}
                              onCheckedChange={(v) => toggleModule(mod, v)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>

                        <AccordionContent className="px-3 pb-3 pt-0">
                          <div className="space-y-3">
                            {fns.map(({ category, functionName }) => {
                              const def = PREDEFINED_FUNCTIONS[category]?.[functionName];
                              if (!def) return null;
                              const fnGranted = effectiveValue(category, functionName, null);
                              const fnDirty = permKey(category, functionName, null) in pending;
                              return (
                                <div
                                  key={`${category}-${functionName}`}
                                  className="border rounded-md bg-background"
                                >
                                  <div className="flex items-center justify-between px-3 py-2 border-b">
                                    <div className="min-w-0">
                                      <div className="text-xs font-medium flex items-center gap-1.5">
                                        {functionName}
                                        {fnDirty && (
                                          <span className="text-[9px] px-1 py-0 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                            pending
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground truncate">
                                        {category}
                                      </div>
                                    </div>
                                    <Switch
                                      checked={fnGranted}
                                      disabled={busy || !isAdmin()}
                                      onCheckedChange={(v) => {
                                        stagePerm(category, functionName, null, v);
                                        // When turning a function on/off, mirror the change
                                        // across its sub-functions so the UI stays consistent.
                                        for (const sub of def.subFunctions) {
                                          stagePerm(category, functionName, sub, v);
                                        }
                                      }}
                                    />
                                  </div>
                                  {fnGranted && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-2">
                                      {def.subFunctions.map((sub) => {
                                        const subGranted = effectiveValue(category, functionName, sub);
                                        const subDirty = permKey(category, functionName, sub) in pending;
                                        return (
                                          <label
                                            key={sub}
                                            className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                                          >
                                            <span className="truncate flex items-center gap-1.5">
                                              {sub}
                                              {subDirty && (
                                                <span className="text-[9px] px-1 py-0 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                                  pending
                                                </span>
                                              )}
                                            </span>
                                            <Switch
                                              checked={subGranted}
                                              disabled={busy || !isAdmin()}
                                              onCheckedChange={(v) =>
                                                toggleSubFunction(category, functionName, sub, v)
                                              }
                                            />
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            );
          })}

          {filteredModules.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              No modules match "{search}"
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={!!pendingBulk} onOpenChange={(o) => { if (!o) setPendingBulk(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Preview: {pendingBulk?.enable ? 'Enable' : 'Disable'}{' '}
              {pendingBulk?.scope === 'all' ? 'all modules' : `${pendingTargetModules.length} selected module${pendingTargetModules.length === 1 ? '' : 's'}`}
            </DialogTitle>
            <DialogDescription>
              Review the impact on {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'this user'} before applying.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-md border bg-muted/30 p-2">
                <div className="text-muted-foreground">Targeted</div>
                <div className="text-lg font-semibold">{pendingTargetModules.length}</div>
              </div>
              <div className={`rounded-md border p-2 ${pendingBulk?.enable ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                <div className="text-muted-foreground">Will change</div>
                <div className="text-lg font-semibold">{pendingDiff.changing.length}</div>
              </div>
              <div className="rounded-md border bg-muted/30 p-2">
                <div className="text-muted-foreground">Already {pendingBulk?.enable ? 'enabled' : 'disabled'}</div>
                <div className="text-lg font-semibold">{pendingDiff.unchanged.length}</div>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                Modules that will change ({pendingDiff.changing.length})
              </div>
              {pendingDiff.changing.length === 0 ? (
                <div className="text-sm text-muted-foreground italic px-2 py-3 border rounded-md bg-muted/20">
                  No changes — every targeted module is already {pendingBulk?.enable ? 'enabled' : 'disabled'}.
                </div>
              ) : (
                <ul className="divide-y rounded-md border">
                  {pendingDiff.changing.map(m => {
                    const { granted, total } = moduleEnabledCount(m);
                    const Icon = m.icon as React.ComponentType<{ className?: string }>;
                    return (
                      <li key={m.key} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          {Icon ? <Icon className="h-4 w-4 text-muted-foreground shrink-0" /> : null}
                          <div className="min-w-0">
                            <div className="font-medium truncate">{m.title}</div>
                            <div className="text-xs text-muted-foreground truncate">{m.group}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-xs">
                          <Badge variant="outline">{granted}/{total} now</Badge>
                          <span className="text-muted-foreground">→</span>
                          <Badge className={pendingBulk?.enable ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'} variant="outline">
                            {pendingBulk?.enable ? `${total}/${total}` : `0/${total}`}
                          </Badge>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {pendingDiff.unchanged.length > 0 && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  Unchanged ({pendingDiff.unchanged.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pendingDiff.unchanged.map(m => (
                    <Badge key={m.key} variant="secondary" className="text-xs font-normal">
                      {m.title}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingBulk(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={performPendingBulk}
              disabled={busy || pendingDiff.changing.length === 0}
              className={pendingBulk?.enable ? '' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}
            >
              {busy ? 'Staging…' : `Stage ${pendingDiff.changing.length} change${pendingDiff.changing.length === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FunctionPermissionsManager;
