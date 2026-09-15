import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import ExternalPortalManagementLayout from './ExternalPortalManagementLayout';
import { useExternalPortalAccounts } from '@/hooks/externalPortal/useExternalPortalAccounts';
import { useSendExternalPortalSignInLink } from '@/hooks/externalPortal/useSendExternalPortalSignInLink';
import {
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminSearchInput,
  AdminPill,
  AdminEmptyState,
  AdminLoadingState,
} from '@/components/admin/ui/AdminUI';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Send, Copy, Check, ShieldAlert } from 'lucide-react';
import {
  PORTAL_TYPE_LABEL,
  ACCOUNT_STATUS_LABEL,
  ACCOUNT_STATUS_TONE,
  type ExternalPortalType,
} from '@/types/externalPortal';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * External Portal Module — "Send Sign-In Link" tab.
 *
 * Deliberately scoped to admin only (see the tab entry in
 * ExternalPortalManagementLayout and the server-side check in
 * external-portal-admin-links' send_signin_link action). Unlike
 * Access Links (one-time registration links, admin/employee/
 * sales_consultant), this re-sends the plain returning-user sign-in
 * URL to an account that already exists — an admin can only ever pick
 * from real, active portal accounts here, never type an arbitrary
 * address.
 */

// Settings row select is intentionally minimal — this page only needs
// app_origin for the Copy Link button; it doesn't touch expiry hours,
// OTP config, etc. (those stay on the Settings tab).
async function fetchAppOrigin(): Promise<string> {
  const { data, error } = await supabase
    .from('external_portal_settings' as any)
    .select('app_origin')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  const origin = (data as any)?.app_origin as string | undefined;
  return (origin || 'https://medico-legal-pro-71z1.onrender.com').replace(/\/+$/, '');
}

const ExternalPortalSendSignInLink: React.FC = () => {
  const { userRole } = usePermissions();
  const isAdminUser = userRole === 'admin';

  // Active accounts only — an admin can never send this link to a
  // paused/expired/deleted account or type a raw email address.
  const { data: accounts, isLoading } = useExternalPortalAccounts(false);
  const { data: appOrigin } = useQuery({
    queryKey: ['external-portal', 'settings', 'app-origin'],
    queryFn: fetchAppOrigin,
    staleTime: 60_000,
  });
  const sendSignInLink = useSendExternalPortalSignInLink();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ExternalPortalType>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeAccounts = useMemo(
    () => (accounts || []).filter((a) => a.status === 'active'),
    [accounts],
  );

  const filtered = useMemo(() => {
    return activeAccounts.filter((a) => {
      if (typeFilter !== 'all' && a.portal_type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!a.full_name.toLowerCase().includes(q) && !a.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [activeAccounts, typeFilter, search]);

  const selectedAccount = useMemo(
    () => activeAccounts.find((a) => a.id === selectedId) || null,
    [activeAccounts, selectedId],
  );

  const signInUrl = `${appOrigin || 'https://medico-legal-pro-71z1.onrender.com'}/external-portal/sign-in`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(signInUrl);
      setCopied(true);
      toast.success('Sign-in link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — copy it manually');
    }
  };

  const handleSend = () => {
    if (!selectedAccount) return;
    sendSignInLink.mutate({ accountId: selectedAccount.id });
  };

  if (!isAdminUser) {
    return (
      <ExternalPortalManagementLayout>
        <Helmet><title>Send Sign-In Link | External Portal Management</title></Helmet>
        <AdminCard>
          <AdminCardBody>
            <AdminEmptyState
              icon={ShieldAlert}
              title="Admin access required"
              description="Only Admin staff can send the External Portal sign-in link to a portal account."
            />
          </AdminCardBody>
        </AdminCard>
      </ExternalPortalManagementLayout>
    );
  }

  return (
    <ExternalPortalManagementLayout>
      <Helmet><title>Send Sign-In Link | External Portal Management</title></Helmet>

      <div className="space-y-4">
        {/* Sign-in link + copy */}
        <AdminCard>
          <AdminCardHeader title="External Portal sign-in link" description="The link every existing portal user signs back in from." />
          <AdminCardBody>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <code className="flex-1 truncate rounded-none border border-black/15 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {signInUrl}
              </code>
              <Button
                variant="outline"
                className="shrink-0 rounded-none border-black/15"
                onClick={handleCopy}
              >
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? 'Copied' : 'Copy Link'}
              </Button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              This domain is configured in Settings — update it there when the production domain changes, and it
              updates everywhere this link is used.
            </p>
          </AdminCardBody>
        </AdminCard>

        {/* Account picker */}
        <AdminCard>
          <AdminCardHeader
            title="Select an existing portal account"
            description="Only active External Portal accounts are listed — the sign-in link can't be sent to an arbitrary email address."
          />
          <AdminCardBody>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <AdminSearchInput value={search} onChange={setSearch} placeholder="Search name or email…" />
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as 'all' | ExternalPortalType)}>
                <SelectTrigger className="w-full rounded-none border-black/15 sm:w-56">
                  <SelectValue placeholder="Account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="attorney">Referring Attorney</SelectItem>
                  <SelectItem value="expert">Medical Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <AdminLoadingState label="Loading portal accounts…" />
            ) : filtered.length === 0 ? (
              <AdminEmptyState
                icon={Send}
                title="No active portal accounts found"
                description={search || typeFilter !== 'all' ? 'Try a different search or filter.' : 'Create a portal account first, under Portal Accounts.'}
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Account type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((account) => (
                      <TableRow
                        key={account.id}
                        className={`cursor-pointer ${selectedId === account.id ? 'bg-teal-50' : ''}`}
                        onClick={() => setSelectedId(account.id)}
                      >
                        <TableCell>
                          <input
                            type="radio"
                            checked={selectedId === account.id}
                            onChange={() => setSelectedId(account.id)}
                            aria-label={`Select ${account.full_name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{account.full_name}</TableCell>
                        <TableCell className="text-slate-600">{account.email}</TableCell>
                        <TableCell>{PORTAL_TYPE_LABEL[account.portal_type]}</TableCell>
                        <TableCell>
                          <AdminPill tone={ACCOUNT_STATUS_TONE[account.status]}>
                            {ACCOUNT_STATUS_LABEL[account.status]}
                          </AdminPill>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between border-t border-black/10 pt-4">
              <p className="text-sm text-slate-600">
                {selectedAccount ? (
                  <>Sending to <span className="font-medium text-slate-900">{selectedAccount.full_name}</span> ({selectedAccount.email})</>
                ) : (
                  'Select an account above'
                )}
              </p>
              <Button
                className="rounded-none bg-black text-white hover:bg-black/85"
                disabled={!selectedAccount || sendSignInLink.isPending}
                onClick={handleSend}
              >
                <Send className="mr-2 h-4 w-4" />
                {sendSignInLink.isPending ? 'Sending…' : 'Send Sign-In Link'}
              </Button>
            </div>
          </AdminCardBody>
        </AdminCard>
      </div>
    </ExternalPortalManagementLayout>
  );
};

export default ExternalPortalSendSignInLink;
