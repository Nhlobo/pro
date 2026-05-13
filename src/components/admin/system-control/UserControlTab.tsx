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
import { Search, UserCog, ShieldCheck, Loader2, RefreshCw } from 'lucide-react';
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

  const handleToggle = async (
    cat: string,
    fn: string,
    sub: string | null,
    granted: boolean
  ) => {
    const prev = grouped[cat]?.[fn];
    const oldGranted = sub ? prev?.subFunctions?.[sub] : prev?.granted;

    const ok = await updateFunctionPermission(user.id, cat, fn, sub, granted);
    if (ok) {
      toast.success('Permission updated');
      queryClient.invalidateQueries({ queryKey: ['user-fn-perms', user.id] });
      queryClient.invalidateQueries({ queryKey: ['user-perm-audit', user.id] });
      onChanged();

      try {
        const { data: authData } = await supabase.auth.getUser();
        const actor = authData?.user;
        const target = `${cat} › ${fn}${sub ? ` › ${sub}` : ''}`;
        await supabase.from('audit_logs').insert({
          table_name: 'function_permissions',
          record_id: user.id,
          action_type: 'UPDATE',
          function_area: 'Per-User Function Controls',
          user_id: actor?.id ?? null,
          user_email: actor?.email ?? null,
          old_values: { granted: oldGranted ?? null } as any,
          new_values: { granted } as any,
          changed_fields: ['granted'] as any,
          description: `${actor?.email ?? 'Unknown'} ${granted ? 'enabled' : 'disabled'} "${target}" for ${(user.first_name || '') + ' ' + (user.last_name || '')} (${user.email ?? user.id})`.trim(),
          user_agent: navigator.userAgent,
        } as any);
      } catch (e) {
        console.error('Audit log insert failed', e);
      }
    } else {
      toast.error('Failed to update permission');
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

  return (
    <div className="space-y-3 pb-2">
      {categories.map((cat) => {
        const fns = grouped[cat];
        return (
          <div key={cat} className="rounded-md border border-border p-3 bg-muted/20">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {cat}
            </h4>
            <div className="space-y-3">
              {Object.keys(fns).map((fnName) => {
                const fn = fns[fnName];
                return (
                  <div key={fnName} className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded-md bg-background border border-border">
                      <div>
                        <p className="text-sm font-medium">{fnName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {Object.keys(fn.subFunctions).length} sub-functions
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={fn.granted ? 'default' : 'secondary'} className="text-[10px]">
                          {fn.granted ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Switch
                          checked={fn.granted}
                          disabled={mutating}
                          onCheckedChange={(v) => handleToggle(cat, fnName, null, v)}
                        />
                      </div>
                    </div>
                    {Object.keys(fn.subFunctions).length > 0 && (
                      <div className="ml-4 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        {Object.keys(fn.subFunctions).map((sub) => (
                          <div
                            key={sub}
                            className="flex items-center justify-between px-2 py-1.5 rounded border border-border/60 bg-background"
                          >
                            <span className="text-xs">{sub}</span>
                            <Switch
                              checked={fn.subFunctions[sub]}
                              disabled={mutating}
                              onCheckedChange={(v) => handleToggle(cat, fnName, sub, v)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UserControlTab;
