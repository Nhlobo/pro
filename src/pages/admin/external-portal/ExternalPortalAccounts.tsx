import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import ExternalPortalManagementLayout from './ExternalPortalManagementLayout';
import {
  useExternalPortalAccounts,
  useCreateExternalPortalAccount,
  useSetExternalPortalAccountStatus,
  type CreateExternalPortalAccountInput,
} from '@/hooks/externalPortal/useExternalPortalAccounts';
import { useExternalPortalLinkableCases, useToggleExternalPortalCaseLink } from '@/hooks/externalPortal/useExternalPortalCaseLinks';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserPlus, MoreHorizontal, PauseCircle, PlayCircle, XCircle, Trash2, Users, MessageSquare } from 'lucide-react';
import { PORTAL_TYPE_LABEL, ACCOUNT_STATUS_LABEL, ACCOUNT_STATUS_TONE, type ExternalPortalType, type ExternalPortalAccount } from '@/types/externalPortal';
import { formatDateTimeShort } from '@/utils/dateTime';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';

const EMPTY_FORM: CreateExternalPortalAccountInput = {
  portal_type: 'attorney',
  full_name: '',
  email: '',
  phone: '',
  notes: '',
};

const ExternalPortalAccounts: React.FC = () => {
  const { userRole } = usePermissions();
  const isAdminUser = userRole === 'admin';
  const { data: accounts, isLoading } = useExternalPortalAccounts(false);
  const createAccount = useCreateExternalPortalAccount();
  const setStatus = useSetExternalPortalAccountStatus();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ExternalPortalType>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<CreateExternalPortalAccountInput>(EMPTY_FORM);
  const [caseAccessAccount, setCaseAccessAccount] = useState<ExternalPortalAccount | null>(null);

  const filtered = useMemo(() => {
    return (accounts || []).filter((a) => {
      if (typeFilter !== 'all' && a.portal_type !== typeFilter) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return a.full_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
    });
  }, [accounts, typeFilter, search]);

  const handleCreate = async () => {
    if (!form.full_name.trim() || !form.email.trim()) {
      toast.error('Full name and email are required');
      return;
    }
    await createAccount.mutateAsync(form);
    setForm(EMPTY_FORM);
    setDrawerOpen(false);
  };

  return (
    <ExternalPortalManagementLayout>
      <Helmet><title>External Portal Management — Portal Accounts</title></Helmet>

      <AdminCard className="mt-4">
        <AdminCardHeader
          title="Portal Accounts"
          description="Attorneys and Medical Experts with external portal access."
          icon={Users}
          actions={
            <Button
              size="sm"
              className="rounded-none bg-black text-white hover:bg-black/85"
              onClick={() => setDrawerOpen(true)}
            >
              <UserPlus className="mr-1.5 h-4 w-4" />
              New Portal Account
            </Button>
          }
        />
        <AdminCardBody className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <AdminSearchInput value={search} onChange={setSearch} placeholder="Search by name or email…" className="sm:max-w-xs" />
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
              <SelectTrigger className="rounded-none border-black/15 sm:w-48">
                <SelectValue placeholder="Portal type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All portal types</SelectItem>
                <SelectItem value="attorney">Referring Attorney</SelectItem>
                <SelectItem value="expert">Medical Expert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <AdminLoadingState label="Loading portal accounts…" />
          ) : filtered.length === 0 ? (
            <AdminEmptyState
              icon={Users}
              title="No portal accounts found"
              description="Create a Portal Account to grant an attorney or medical expert access to their cases."
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
                    <TableHead>Login</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.full_name}</TableCell>
                      <TableCell>{PORTAL_TYPE_LABEL[a.portal_type]}</TableCell>
                      <TableCell className="text-slate-600">{a.email}</TableCell>
                      <TableCell>
                        <AdminPill tone={ACCOUNT_STATUS_TONE[a.status]}>{ACCOUNT_STATUS_LABEL[a.status]}</AdminPill>
                      </TableCell>
                      <TableCell>
                        {a.is_bridged ? (
                          <AdminPill tone="success">Signed in</AdminPill>
                        ) : (
                          <span className="text-slate-400">Not yet</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-500">{formatDateTimeShort(a.created_at)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-none">
                            {a.status !== 'active' && (
                              <DropdownMenuItem onClick={() => setStatus.mutate({ accountId: a.id, status: 'active' })}>
                                <PlayCircle className="mr-2 h-4 w-4" /> Set Active
                              </DropdownMenuItem>
                            )}
                            {a.status === 'active' && (
                              <DropdownMenuItem onClick={() => setStatus.mutate({ accountId: a.id, status: 'paused' })}>
                                <PauseCircle className="mr-2 h-4 w-4" /> Pause
                              </DropdownMenuItem>
                            )}
                            {a.status !== 'expired' && (
                              <DropdownMenuItem onClick={() => setStatus.mutate({ accountId: a.id, status: 'expired' })}>
                                <XCircle className="mr-2 h-4 w-4" /> Mark Expired
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setCaseAccessAccount(a)}>
                              <MessageSquare className="mr-2 h-4 w-4" /> Case Access (Messages)
                            </DropdownMenuItem>
                            {isAdminUser && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setStatus.mutate({ accountId: a.id, status: 'deleted' })}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Move to Recycle Bin
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </AdminCardBody>
      </AdminCard>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>New Portal Account</SheetTitle>
            <SheetDescription>
              This creates the account only. Generate the one-time access link from the Access Links tab
              once link generation is available (Phase 2).
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Portal Type</Label>
              <Select value={form.portal_type} onValueChange={(v) => setForm((f) => ({ ...f, portal_type: v as ExternalPortalType }))}>
                <SelectTrigger className="rounded-none border-black/15"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="attorney">Referring Attorney</SelectItem>
                  <SelectItem value="expert">Medical Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input
                className="rounded-none border-black/15"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="e.g. Jane Dlamini"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                className="rounded-none border-black/15"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="name@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Phone (optional)</Label>
              <Input
                className="rounded-none border-black/15"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                className="rounded-none border-black/15"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>

            <Button
              className="w-full rounded-none bg-black text-white hover:bg-black/85"
              disabled={createAccount.isPending}
              onClick={handleCreate}
            >
              {createAccount.isPending ? 'Creating…' : 'Create Portal Account'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!caseAccessAccount} onOpenChange={(open) => !open && setCaseAccessAccount(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto rounded-none sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Case Access — {caseAccessAccount?.full_name}</DialogTitle>
            <DialogDescription>
              Toggle which cases {caseAccessAccount?.full_name} can message about in the portal. Turning a case off doesn't affect what they can see elsewhere (My Cases, Appointments) — only the message thread for that case.
            </DialogDescription>
          </DialogHeader>
          {caseAccessAccount && <CaseAccessList account={caseAccessAccount} />}
        </DialogContent>
      </Dialog>
    </ExternalPortalManagementLayout>
  );
};

const CaseAccessList: React.FC<{ account: ExternalPortalAccount }> = ({ account }) => {
  const { data: cases, isLoading } = useExternalPortalLinkableCases(account);
  const toggleLink = useToggleExternalPortalCaseLink();

  if (isLoading) return <AdminLoadingState label="Loading cases…" />;
  if (!cases || cases.length === 0) {
    return <AdminEmptyState icon={Users} title="No cases found" description="No appointments are linked to this person's attorney/expert record yet." />;
  }

  return (
    <div className="divide-y divide-black/10 border border-black/10">
      {cases.map((c) => (
        <div key={c.appointment_id} className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{c.claimant_name}</p>
            <p className="text-xs text-slate-500">
              {c.appointment_date ? formatDateTimeShort(c.appointment_date) : 'No date'} · {c.case_status || 'unknown status'}
            </p>
          </div>
          <Switch
            checked={c.is_linked}
            disabled={toggleLink.isPending}
            onCheckedChange={(checked) =>
              toggleLink.mutate({ accountId: account.id, appointmentId: c.appointment_id, link: checked })
            }
          />
        </div>
      ))}
    </div>
  );
};

export default ExternalPortalAccounts;
