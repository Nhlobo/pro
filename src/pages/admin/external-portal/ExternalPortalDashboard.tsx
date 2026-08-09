import React from 'react';
import { Helmet } from 'react-helmet-async';
import ExternalPortalManagementLayout from './ExternalPortalManagementLayout';
import { useExternalPortalAccounts } from '@/hooks/externalPortal/useExternalPortalAccounts';
import { AdminCard, AdminCardHeader, AdminCardBody, AdminStatCard, AdminLoadingState, AdminPill } from '@/components/admin/ui/AdminUI';
import { Users, Scale, Stethoscope, PauseCircle, XCircle, FolderOpen } from 'lucide-react';
import { PORTAL_TYPE_LABEL, ACCOUNT_STATUS_TONE, ACCOUNT_STATUS_LABEL } from '@/types/externalPortal';
import { formatDateTimeShort } from '@/utils/dateTime';

const ExternalPortalDashboard: React.FC = () => {
  const { data: accounts, isLoading } = useExternalPortalAccounts(false);

  const total = accounts?.length || 0;
  const attorneys = accounts?.filter((a) => a.portal_type === 'attorney').length || 0;
  const experts = accounts?.filter((a) => a.portal_type === 'expert').length || 0;
  const active = accounts?.filter((a) => a.status === 'active').length || 0;
  const paused = accounts?.filter((a) => a.status === 'paused').length || 0;
  const expired = accounts?.filter((a) => a.status === 'expired').length || 0;
  const bridged = accounts?.filter((a) => a.is_bridged).length || 0;

  const recent = [...(accounts || [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  return (
    <ExternalPortalManagementLayout>
      <Helmet><title>External Portal Management — Dashboard</title></Helmet>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mt-4">
        <AdminStatCard label="Total Accounts" value={total} icon={Users} loading={isLoading} />
        <AdminStatCard label="Referring Attorneys" value={attorneys} icon={Scale} loading={isLoading} />
        <AdminStatCard label="Medical Experts" value={experts} icon={Stethoscope} loading={isLoading} />
        <AdminStatCard label="Signed In" value={bridged} icon={FolderOpen} loading={isLoading} />
        <AdminStatCard label="Active" value={active} icon={Users} loading={isLoading} />
        <AdminStatCard label="Paused" value={paused} icon={PauseCircle} loading={isLoading} />
        <AdminStatCard label="Expired" value={expired} icon={XCircle} loading={isLoading} />
      </div>

      <AdminCard className="mt-4">
        <AdminCardHeader title="Recently Created Accounts" />
        <AdminCardBody className="p-0">
          {isLoading ? (
            <AdminLoadingState label="Loading accounts…" />
          ) : recent.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No external portal accounts yet.</p>
          ) : (
            <div className="divide-y divide-black/5">
              {recent.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-black">{a.full_name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {PORTAL_TYPE_LABEL[a.portal_type]} · {a.email} · Created {formatDateTimeShort(a.created_at)}
                    </p>
                  </div>
                  <AdminPill tone={ACCOUNT_STATUS_TONE[a.status]}>{ACCOUNT_STATUS_LABEL[a.status]}</AdminPill>
                </div>
              ))}
            </div>
          )}
        </AdminCardBody>
      </AdminCard>
    </ExternalPortalManagementLayout>
  );
};

export default ExternalPortalDashboard;
