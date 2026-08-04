import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import ExternalPortalManagementLayout from './ExternalPortalManagementLayout';
import { supabase } from '@/integrations/supabase/client';
import { AdminCard, AdminCardHeader, AdminCardBody, AdminEmptyState, AdminLoadingState, AdminPill } from '@/components/admin/ui/AdminUI';
import { ScrollText } from 'lucide-react';
import { formatDateTimeShort } from '@/utils/dateTime';
import type { ExternalPortalAuditLogEntry } from '@/types/externalPortal';

const ACTION_LABEL: Record<string, string> = {
  account_created: 'Account created',
  status_changed: 'Status changed',
  permanently_deleted: 'Permanently deleted',
  auto_expired: 'Auto-expired (all cases closed)',
};

function useAuditLogs() {
  return useQuery({
    queryKey: ['external-portal', 'audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('external_portal_audit_logs' as any)
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as ExternalPortalAuditLogEntry[];
    },
    staleTime: 30_000,
  });
}

const ExternalPortalAuditLogs: React.FC = () => {
  const { data: logs, isLoading } = useAuditLogs();

  return (
    <ExternalPortalManagementLayout>
      <Helmet><title>External Portal Management — Audit Logs</title></Helmet>

      <AdminCard className="mt-4">
        <AdminCardHeader
          title="Audit Logs"
          description="Every account and lifecycle action taken in this module — most recent 200 events."
          icon={ScrollText}
        />
        <AdminCardBody className="p-0">
          {isLoading ? (
            <AdminLoadingState label="Loading audit logs…" />
          ) : !logs || logs.length === 0 ? (
            <AdminEmptyState icon={ScrollText} title="No audit events yet" />
          ) : (
            <div className="divide-y divide-black/5">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-black">{ACTION_LABEL[log.action] || log.action}</p>
                    {Object.keys(log.details || {}).length > 0 && (
                      <p className="mt-0.5 truncate text-xs text-slate-500">{JSON.stringify(log.details)}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <AdminPill tone="neutral">{log.actor_type}</AdminPill>
                    <span className="whitespace-nowrap text-xs text-slate-500">{formatDateTimeShort(log.occurred_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminCardBody>
      </AdminCard>
    </ExternalPortalManagementLayout>
  );
};

export default ExternalPortalAuditLogs;
