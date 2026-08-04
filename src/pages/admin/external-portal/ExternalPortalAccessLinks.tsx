import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import ExternalPortalManagementLayout from './ExternalPortalManagementLayout';
import { useExternalPortalAccounts } from '@/hooks/externalPortal/useExternalPortalAccounts';
import {
  useExternalPortalAccessLinks,
  useGenerateExternalPortalLink,
  useRevokeExternalPortalLink,
} from '@/hooks/externalPortal/useExternalPortalAccessLinks';
import { AdminCard, AdminCardHeader, AdminCardBody, AdminEmptyState, AdminLoadingState, AdminPill } from '@/components/admin/ui/AdminUI';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link2, Copy, Ban } from 'lucide-react';
import { PORTAL_TYPE_LABEL } from '@/types/externalPortal';
import { formatDateTimeShort } from '@/utils/dateTime';
import { toast } from 'sonner';

const LINK_STATUS_TONE: Record<string, 'success' | 'neutral' | 'warning' | 'destructive'> = {
  pending: 'success',
  used: 'neutral',
  expired: 'warning',
  revoked: 'destructive',
};

const ExternalPortalAccessLinks: React.FC = () => {
  const { data: accounts } = useExternalPortalAccounts(false);
  const { data: links, isLoading } = useExternalPortalAccessLinks();
  const generateLink = useGenerateExternalPortalLink();
  const revokeLink = useRevokeExternalPortalLink();

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const activeAccounts = (accounts || []).filter((a) => a.status === 'active');

  const handleGenerate = async () => {
    if (!selectedAccountId) {
      toast.error('Choose a portal account first');
      return;
    }
    await generateLink.mutateAsync(selectedAccountId);
    setSelectedAccountId('');
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy — copy it manually from your email client');
    }
  };

  return (
    <ExternalPortalManagementLayout>
      <Helmet><title>External Portal Management — Access Links</title></Helmet>

      <AdminCard className="mt-4">
        <AdminCardHeader title="Generate an Access Link" description="Emails a one-time registration link to the account's address." icon={Link2} />
        <AdminCardBody>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="rounded-none border-black/15 sm:max-w-sm">
                <SelectValue placeholder="Select a portal account" />
              </SelectTrigger>
              <SelectContent>
                {activeAccounts.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500">No active accounts — create one under Portal Accounts first.</div>
                ) : (
                  activeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name} — {PORTAL_TYPE_LABEL[a.portal_type]} ({a.email})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              className="rounded-none bg-black text-white hover:bg-black/85"
              disabled={generateLink.isPending}
              onClick={handleGenerate}
            >
              {generateLink.isPending ? 'Generating…' : 'Generate & Email Link'}
            </Button>
          </div>
          {generateLink.data && (
            <div className="mt-3 flex items-center gap-2 border border-black/10 bg-slate-50 px-3 py-2 text-xs">
              <span className="truncate">{generateLink.data.link_url}</span>
              <Button size="sm" variant="ghost" className="h-6 shrink-0 rounded-none px-2" onClick={() => handleCopy(generateLink.data!.link_url)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </AdminCardBody>
      </AdminCard>

      <AdminCard className="mt-4">
        <AdminCardHeader title="Access Links" description="Most recent 200 links across both portal types." icon={Link2} />
        <AdminCardBody className="p-0">
          {isLoading ? (
            <AdminLoadingState label="Loading access links…" />
          ) : !links || links.length === 0 ? (
            <AdminEmptyState icon={Link2} title="No access links yet" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Portal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <p className="font-medium">{l.account_full_name}</p>
                        <p className="text-xs text-slate-500">{l.account_email}</p>
                      </TableCell>
                      <TableCell>{PORTAL_TYPE_LABEL[l.account_portal_type as 'attorney' | 'expert'] || l.account_portal_type}</TableCell>
                      <TableCell><AdminPill tone={LINK_STATUS_TONE[l.status]}>{l.status}</AdminPill></TableCell>
                      <TableCell className="text-slate-500">{formatDateTimeShort(l.expires_at)}</TableCell>
                      <TableCell className="text-slate-500">{formatDateTimeShort(l.created_at)}</TableCell>
                      <TableCell>
                        {l.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 rounded-none px-2 text-destructive hover:text-destructive"
                            onClick={() => revokeLink.mutate({ linkId: l.id })}
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </AdminCardBody>
      </AdminCard>
    </ExternalPortalManagementLayout>
  );
};

export default ExternalPortalAccessLinks;
