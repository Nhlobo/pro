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
  X,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useFunctionPermissions, GroupedPermissions, PREDEFINED_FUNCTIONS } from '@/hooks/useFunctionPermissions';
import { UserProfile, usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';

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

  useEffect(() => {
    fetchPermissions();
    setSelectedRole(user.role || 'user');
    setHasRoleChange(false);
  }, [user.id, user.role]);

  const fetchPermissions = async () => {
    const list = await getUserFunctionPermissions(user.id);
    setGrouped(groupPermissions(list));
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
    return fns.every(f => grouped[f.category]?.[f.functionName]?.granted);
  };

  const moduleEnabledCount = (mod: ModuleDef): { granted: number; total: number } => {
    const fns = resolveModuleFunctions(mod);
    const granted = fns.filter(f => grouped[f.category]?.[f.functionName]?.granted).length;
    return { granted, total: fns.length };
  };

  const toggleModule = async (mod: ModuleDef, enable: boolean) => {
    setBusy(true);
    try {
      const fns = resolveModuleFunctions(mod);
      for (const f of fns) {
        await updateFunctionPermission(user.id, f.category, f.functionName, null, enable);
      }
      await fetchPermissions();
      onPermissionChange?.();
      toast.success(`${mod.title} ${enable ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error(`Failed to update ${mod.title}`);
    } finally {
      setBusy(false);
    }
  };

  const toggleSubFunction = async (
    category: string,
    functionName: string,
    sub: string,
    granted: boolean,
  ) => {
    const exists = grouped[category]?.[functionName]?.subFunctions?.hasOwnProperty(sub);
    if (!exists) {
      const ok = await addSubFunction(user.id, category, functionName, sub, user.user_type || 'employee');
      if (!ok) {
        toast.error(`Failed to create ${sub}`);
        return;
      }
    }
    const ok = await updateFunctionPermission(user.id, category, functionName, sub, granted);
    if (ok) {
      await fetchPermissions();
      onPermissionChange?.();
    } else {
      toast.error(`Failed to update ${sub}`);
    }
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

  const applyPreset = async (preset: PresetDef) => {
    if (!isAdmin()) {
      toast.error('Only administrators can apply presets');
      return;
    }
    setBusy(true);
    try {
      const enabledKeys = new Set(preset.moduleKeys);
      // Apply to every module: enable if in preset, disable otherwise.
      for (const mod of ADMIN_MODULES) {
        const enable = enabledKeys.has(mod.key);
        const fns = resolveModuleFunctions(mod);
        for (const f of fns) {
          await updateFunctionPermission(user.id, f.category, f.functionName, null, enable);
        }
      }
      // Optionally sync the suggested role
      if (preset.suggestedRole && preset.suggestedRole !== user.role) {
        await updateUserRole(user.id, preset.suggestedRole);
        setSelectedRole(preset.suggestedRole);
        setHasRoleChange(false);
      }
      await fetchPermissions();
      onPermissionChange?.();
      toast.success(`Applied "${preset.title}" preset`);
    } catch {
      toast.error(`Failed to apply ${preset.title}`);
    } finally {
      setBusy(false);
    }
  };

  const enableAllInGroup = async (group: ModuleDef['group'], enable: boolean) => {
    const mods = ADMIN_MODULES.filter(m => m.group === group);
    setBusy(true);
    try {
      for (const m of mods) {
        const fns = resolveModuleFunctions(m);
        for (const f of fns) {
          await updateFunctionPermission(user.id, f.category, f.functionName, null, enable);
        }
      }
      await fetchPermissions();
      onPermissionChange?.();
      toast.success(`${group} modules ${enable ? 'enabled' : 'disabled'}`);
    } finally {
      setBusy(false);
    }
  };

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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search Admin Portal modules..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

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
                              const fnGranted = grouped[category]?.[functionName]?.granted ?? false;
                              return (
                                <div
                                  key={`${category}-${functionName}`}
                                  className="border rounded-md bg-background"
                                >
                                  <div className="flex items-center justify-between px-3 py-2 border-b">
                                    <div className="min-w-0">
                                      <div className="text-xs font-medium">{functionName}</div>
                                      <div className="text-[11px] text-muted-foreground truncate">
                                        {category}
                                      </div>
                                    </div>
                                    <Switch
                                      checked={fnGranted}
                                      disabled={busy || !isAdmin()}
                                      onCheckedChange={(v) =>
                                        updateFunctionPermission(user.id, category, functionName, null, v)
                                          .then((ok) => {
                                            if (ok) {
                                              fetchPermissions();
                                              onPermissionChange?.();
                                            }
                                          })
                                      }
                                    />
                                  </div>
                                  {fnGranted && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-2">
                                      {def.subFunctions.map((sub) => {
                                        const subGranted =
                                          grouped[category]?.[functionName]?.subFunctions?.[sub] ?? false;
                                        return (
                                          <label
                                            key={sub}
                                            className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                                          >
                                            <span className="truncate">{sub}</span>
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
    </div>
  );
};

export default FunctionPermissionsManager;
