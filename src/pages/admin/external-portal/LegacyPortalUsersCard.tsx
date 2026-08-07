import React, { useMemo, useState } from 'react';
import {
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminSearchInput,
  AdminPill,
  AdminEmptyState,
  AdminLoadingState,
} from '@/components/admin/ui/AdminUI';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCog, PauseCircle, PlayCircle } from 'lucide-react';
import { formatDateTimeShort } from '@/utils/dateTime';
import {
  useLegacyPortalUsers,
  useSetLegacyPortalUserActive,
} from '@/hooks/externalPortal/useLegacyPortalUsers';

/**
 * Shows the people who already have sign-in accounts on the OLD Attorney /
 * Expert portals (Supabase auth users in `profiles`). Read + activate/
 * deactivate only — no backend or schema change.
 */
const LegacyPortalUsersCard: React.FC = () => {
  const { data: users, isLoading } = useLegacyPortalUsers();
  const setActive = useSetLegacyPortalUserActive();

  const [search, setSearch] = useState('');
  const [portalFilter, setPortalFilter] = useState<'all' | 'attorney' | 'expert'>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users || []).filter((u) => {
      if (portalFilter !== 'all' && u.portal !== portalFilter) return false;
      if (!q) return true;
      const name = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
      return name.includes(q) || (u.email || '').toLowerCase().includes(q);
    });
  }, [users, portalFilter, search]);

  return (
    <AdminCard className="mt-4">
      <AdminCardHeader
        title="Old Portal Users (Sign-in Accounts)"
        description="People who sign in to the Attorney and Expert portals with their own credentials."
        icon={UserCog}
      />
      <AdminCardBody className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <AdminSearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or email…"
            className="sm:max-w-xs"
          />
          <Select value={portalFilter} onValueChange={(v) => setPortalFilter(v as any)}>
            <SelectTrigger className="rounded-none border-black/15 sm:w-48">
              <SelectValue placeholder="Portal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All portals</SelectItem>
              <SelectItem value="attorney">Attorney Portal</SelectItem>
              <SelectItem value="expert">Expert Portal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <AdminLoadingState label="Loading old portal users…" />
        ) : filtered.length === 0 ? (
          <AdminEmptyState
            icon={UserCog}
            title="No old portal users found"
            description="Attorney or expert sign-in accounts will appear here once they exist."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Portal</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sign-in</TableHead>
                  <TableHead className="w-28 text-right">Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {`${u.first_name || ''} ${u.last_name || ''}`.trim() || '—'}
                    </TableCell>
                    <TableCell>{u.portal === 'expert' ? 'Medical Expert' : 'Referring Attorney'}</TableCell>
                    <TableCell className="break-all text-slate-600">{u.email || '—'}</TableCell>
                    <TableCell>
                      <AdminPill tone={u.is_active ? 'success' : 'destructive'}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </AdminPill>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {u.last_login_at ? formatDateTimeShort(u.last_login_at) : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-none border-black/15"
                        disabled={setActive.isPending}
                        onClick={() => setActive.mutate({ userId: u.id, active: !u.is_active })}
                      >
                        {u.is_active ? (
                          <>
                            <PauseCircle className="mr-1.5 h-4 w-4" /> Deactivate
                          </>
                        ) : (
                          <>
                            <PlayCircle className="mr-1.5 h-4 w-4" /> Activate
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AdminCardBody>
    </AdminCard>
  );
};

export default LegacyPortalUsersCard;
