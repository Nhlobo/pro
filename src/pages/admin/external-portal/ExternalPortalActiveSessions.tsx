import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import ExternalPortalManagementLayout from './ExternalPortalManagementLayout';
import { useExternalPortalSessions, useRevokeExternalPortalSession } from '@/hooks/externalPortal/useExternalPortalSessions';
import { AdminCard, AdminCardHeader, AdminCardBody, AdminEmptyState, AdminLoadingState, AdminPill } from '@/components/admin/ui/AdminUI';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Radio, LogOut } from 'lucide-react';
import { PORTAL_TYPE_LABEL } from '@/types/externalPortal';
import { formatDateTimeShort } from '@/utils/dateTime';

const ExternalPortalActiveSessions: React.FC = () => {
  const [activeOnly, setActiveOnly] = useState(true);
  const { data: sessions, isLoading } = useExternalPortalSessions(activeOnly);
  const revokeSession = useRevokeExternalPortalSession();

  return (
    <ExternalPortalManagementLayout>
      <Helmet><title>External Portal Management — Active Sessions</title></Helmet>

      <AdminCard className="mt-4">
        <AdminCardHeader
          title="Sessions"
          description="Live and historical external portal sessions."
          icon={Radio}
          actions={
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500">Active only</Label>
              <Switch checked={activeOnly} onCheckedChange={setActiveOnly} />
            </div>
          }
        />
        <AdminCardBody className="p-0">
          {isLoading ? (
            <AdminLoadingState label="Loading sessions…" />
          ) : !sessions || sessions.length === 0 ? (
            <AdminEmptyState icon={Radio} title={activeOnly ? 'No active sessions' : 'No sessions yet'} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Portal</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => {
                    const isRevoked = !!s.revoked_at;
                    const isExpired = !isRevoked && new Date(s.expires_at).getTime() <= Date.now();
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <p className="font-medium">{s.account_full_name}</p>
                          <p className="text-xs text-slate-500">{s.account_email}</p>
                        </TableCell>
                        <TableCell>{PORTAL_TYPE_LABEL[s.account_portal_type as 'attorney' | 'expert'] || s.account_portal_type}</TableCell>
                        <TableCell className="text-slate-500">{s.ip_address || '—'}</TableCell>
                        <TableCell className="text-slate-500">{formatDateTimeShort(s.last_seen_at)}</TableCell>
                        <TableCell className="text-slate-500">{formatDateTimeShort(s.expires_at)}</TableCell>
                        <TableCell>
                          <AdminPill tone={isRevoked ? 'destructive' : isExpired ? 'warning' : 'success'}>
                            {isRevoked ? 'Revoked' : isExpired ? 'Expired' : 'Active'}
                          </AdminPill>
                        </TableCell>
                        <TableCell>
                          {!isRevoked && !isExpired && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 rounded-none px-2 text-destructive hover:text-destructive"
                              onClick={() => revokeSession.mutate(s.id)}
                            >
                              <LogOut className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </AdminCardBody>
      </AdminCard>
    </ExternalPortalManagementLayout>
  );
};

export default ExternalPortalActiveSessions;
