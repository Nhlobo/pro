import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import ExternalPortalManagementLayout from './ExternalPortalManagementLayout';
import { useExternalPortalAccounts } from '@/hooks/externalPortal/useExternalPortalAccounts';
import {
  useExternalPortalAccessLinks,
  useGenerateExternalPortalLink,
  useRevokeExternalPortalLink,
} from '@/hooks/externalPortal/useExternalPortalAccessLinks';
import { useBulkGenerateExternalPortalLinks } from '@/hooks/externalPortal/useBulkGenerateExternalPortalLinks';
import { AdminCard, AdminCardHeader, AdminCardBody, AdminEmptyState, AdminLoadingState, AdminPill } from '@/components/admin/ui/AdminUI';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link2, Copy, Ban, Send, Loader2, CheckCircle2, XCircle } from 'lucide-react';
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
  const bulkGenerate = useBulkGenerateExternalPortalLinks();

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const activeAccounts = (accounts || []).filter((a) => a.status === 'active');

  // Accounts that are active, have never completed registration, and
  // don't already have a pending link — i.e. accounts genuinely
  // "waiting" on their first activation email. Someone who already has
  // a live pending link isn't stuck; re-sending to them belongs to the
  // per-account flow above (or Revoke + Generate), not the bulk sweep.
  const awaitingActivation = activeAccounts.filter((a) => !a.registered_at && !a.active_access_link);

  const handleBulkSend = async () => {
    if (awaitingActivation.length === 0) return;
    await bulkGenerate.run(
      awaitingActivation.map((a) => ({
        id: a.id,
        full_name: a.full_name,
        email: a.email,
        portal_type: a.portal_type,
      }))
    );
  };

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
        <AdminCardHeader
          title="Bulk Activation"
          description="Send the one-time activation email to every active account still waiting on it — same link, same email, just for everyone at once."
          icon={Send}
        />
        <AdminCardBody className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              {awaitingActivation.length === 0 ? (
                'Everyone active already has a pending link or has activated — nothing to send.'
              ) : (
                <>
                  <span className="font-medium text-slate-900">{awaitingActivation.length}</span>{' '}
                  active account{awaitingActivation.length === 1 ? '' : 's'} waiting on activation
                  {' '}({awaitingActivation.filter((a) => a.portal_type === 'attorney').length} attorneys,{' '}
                  {awaitingActivation.filter((a) => a.portal_type === 'expert').length} experts).
                </>
              )}
            </p>
            <div className="flex gap-2">
              {bulkGenerate.isRunning && (
                <Button size="sm" variant="outline" className="rounded-none" onClick={bulkGenerate.cancel}>
                  Stop after current
                </Button>
              )}
              <Button
                size="sm"
                className="rounded-none bg-black text-white hover:bg-black/85"
                disabled={awaitingActivation.length === 0 || bulkGenerate.isRunning}
                onClick={handleBulkSend}
              >
                {bulkGenerate.isRunning ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Sending {bulkGenerate.sentCount + bulkGenerate.failedCount} / {bulkGenerate.results.length}…
                  </>
                ) : (
                  <>
                    <Send className="mr-1.5 h-4 w-4" />
                    Send to {awaitingActivation.length || ''} account{awaitingActivation.length === 1 ? '' : 's'}
                  </>
                )}
              </Button>
            </div>
          </div>

          {bulkGenerate.results.length > 0 && (
            <div className="border border-black/10">
              <div className="flex items-center gap-4 border-b border-black/10 bg-slate-50 px-3 py-2 text-xs">
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {bulkGenerate.sentCount} sent
                </span>
                {bulkGenerate.failedCount > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-3.5 w-3.5" /> {bulkGenerate.failedCount} failed
                  </span>
                )}
                {bulkGenerate.pendingCount > 0 && (
                  <span className="text-slate-500">{bulkGenerate.pendingCount} queued…</span>
                )}
                {!bulkGenerate.isRunning && (
                  <Button size="sm" variant="ghost" className="ml-auto h-6 rounded-none px-2 text-xs" onClick={bulkGenerate.reset}>
                    Dismiss
                  </Button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto">
                <Table>
                  <TableBody>
                    {bulkGenerate.results.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="w-6 py-1.5">
                          {r.status === 'sent' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                          {r.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
                          {r.status === 'pending' && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                        </TableCell>
                        <TableCell className="py-1.5 font-medium">{r.full_name}</TableCell>
                        <TableCell className="py-1.5 text-slate-500">{PORTAL_TYPE_LABEL[r.portal_type as 'attorney' | 'expert'] || r.portal_type}</TableCell>
                        <TableCell className="py-1.5 text-slate-500">{r.email}</TableCell>
                        <TableCell className="py-1.5 text-destructive">{r.error || ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </AdminCardBody>
      </AdminCard>

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
