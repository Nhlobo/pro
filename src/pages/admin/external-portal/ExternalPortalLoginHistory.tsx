import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import ExternalPortalManagementLayout from './ExternalPortalManagementLayout';
import { supabase } from '@/integrations/supabase/client';
import { AdminCard, AdminCardHeader, AdminCardBody, AdminEmptyState, AdminLoadingState, AdminPill } from '@/components/admin/ui/AdminUI';
import { History } from 'lucide-react';
import { formatDateTimeShort } from '@/utils/dateTime';
import type { ExternalPortalLoginHistoryEntry } from '@/types/externalPortal';

function useLoginHistory() {
  return useQuery({
    queryKey: ['external-portal', 'login-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('external_portal_login_history' as any)
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as ExternalPortalLoginHistoryEntry[];
    },
    staleTime: 30_000,
  });
}

const ExternalPortalLoginHistory: React.FC = () => {
  const { data: history, isLoading } = useLoginHistory();

  return (
    <ExternalPortalManagementLayout>
      <Helmet><title>External Portal Management — Login History</title></Helmet>

      <AdminCard className="mt-4">
        <AdminCardHeader
          title="Login History"
          description="Registration, OTP and login events for external portal users."
          icon={History}
        />
        <AdminCardBody className="p-0">
          {isLoading ? (
            <AdminLoadingState label="Loading…" />
          ) : !history || history.length === 0 ? (
            <AdminEmptyState
              icon={History}
              title="No login events yet"
              description="This fills in once authentication (Phase 2) is live and external users start signing in."
            />
          ) : (
            <div className="divide-y divide-black/5">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-black">{h.event_type}</p>
                    <p className="truncate text-xs text-slate-500">{h.email_attempted || '—'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <AdminPill tone={h.success ? 'success' : 'destructive'}>{h.success ? 'Success' : 'Failed'}</AdminPill>
                    <span className="whitespace-nowrap text-xs text-slate-500">{formatDateTimeShort(h.occurred_at)}</span>
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

export default ExternalPortalLoginHistory;
