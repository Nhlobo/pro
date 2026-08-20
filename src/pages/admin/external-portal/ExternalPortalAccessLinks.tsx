import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import ExternalPortalManagementLayout from './ExternalPortalManagementLayout';
import { useExternalPortalAccounts } from '@/hooks/externalPortal/useExternalPortalAccounts';
import {
  useExternalPortalAccessLinks,
  useGenerateExternalPortalLink,
  useRevokeExternalPortalLink,
} from '@/hooks/externalPortal/useExternalPortalAccessLinks';
import { useBulkGenerateExternalPortalLinks } from '@/hooks/externalPortal/useBulkGenerateExternalPortalLinks';
import { useReferringAttorneysByUsage, useMedicalExpertsByUsage } from '@/hooks/externalPortal/useExternalPortalUsageRanking';
import { useReferringAttorneyContacts, useCreateReferringAttorneyContact } from '@/hooks/externalPortal/useReferringAttorneyContacts';
import {
  useExternalPortalAccountForPerson,
  useCreateExternalPortalAccountForPerson,
  useUpdateExternalPortalAccountContact,
} from '@/hooks/externalPortal/useExternalPortalAccountForPerson';
import { useExternalPortalAccountEmails } from '@/hooks/externalPortal/useExternalPortalAccountEmails';
import { AdminCard, AdminCardHeader, AdminCardBody, AdminEmptyState, AdminLoadingState, AdminPill } from '@/components/admin/ui/AdminUI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link2, Copy, Ban, Send, Loader2, CheckCircle2, XCircle, Scale, Stethoscope, Plus } from 'lucide-react';
import { PORTAL_TYPE_LABEL, ACCOUNT_STATUS_LABEL, ACCOUNT_STATUS_TONE, type ExternalPortalType } from '@/types/externalPortal';
import { formatDateTimeShort } from '@/utils/dateTime';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';

const LINK_STATUS_TONE: Record<string, 'success' | 'neutral' | 'warning' | 'destructive'> = {
  pending: 'success',
  used: 'neutral',
  expired: 'warning',
  revoked: 'destructive',
};

// Same pattern as the server-side check in external-portal-admin-links —
// kept loose on purpose (not overly restrictive) since the Edge
// Function is the actual source of truth; this is just fast client
// feedback before the round trip.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ExternalPortalAccessLinks: React.FC = () => {
  const { userRole } = usePermissions();
  const isAdminUser = userRole === 'admin';
  const { data: accounts } = useExternalPortalAccounts(false);
  const { data: links, isLoading } = useExternalPortalAccessLinks();
  const generateLink = useGenerateExternalPortalLink();
  const revokeLink = useRevokeExternalPortalLink();
  const bulkGenerate = useBulkGenerateExternalPortalLinks();

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

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy — copy it manually from your email client');
    }
  };

  // ---- Choose a person (Referring Attorney / Medical Expert), ranked
  // most-used → least-used, then choose which email the link goes to. ----

  const [portalType, setPortalType] = useState<ExternalPortalType>('attorney');
  const [personId, setPersonId] = useState<string>('');
  const [emailChoice, setEmailChoice] = useState<string>(''); // a history email, or the sentinel '__new__'
  const [newEmail, setNewEmail] = useState('');

  const { data: attorneysByUsage, isLoading: loadingAttorneys } = useReferringAttorneysByUsage();
  const { data: expertsByUsage, isLoading: loadingExperts } = useMedicalExpertsByUsage();
  const people = portalType === 'attorney' ? attorneysByUsage : expertsByUsage;
  const loadingPeople = portalType === 'attorney' ? loadingAttorneys : loadingExperts;
  const selectedPerson = people?.find((p) => p.id === personId) || null;

  const { data: existingAccount, isLoading: loadingAccount } = useExternalPortalAccountForPerson(portalType, personId || null);
  const createAccountForPerson = useCreateExternalPortalAccountForPerson();
  const updateAccountContact = useUpdateExternalPortalAccountContact();
  const { data: emailHistory } = useExternalPortalAccountEmails(existingAccount?.id || null);

  // ---- Step 2b (attorney only) — WHICH individual at that firm this
  // account is scoped to. Required: an attorney account with no
  // contact assigned sees no cases at all (Phase 12/13 RLS), by
  // design, rather than falling back to the whole firm. ----
  const [contactId, setContactId] = useState<string>('');
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const { data: contacts, isLoading: loadingContacts } = useReferringAttorneyContacts(
    portalType === 'attorney' ? personId || null : null
  );
  const createContact = useCreateReferringAttorneyContact();

  useEffect(() => {
    setContactId('');
    setShowNewContact(false);
    setNewContactName('');
    setNewContactEmail('');
  }, [personId, portalType]);

  // Default to the existing account's current contact, once known.
  useEffect(() => {
    if (existingAccount && (existingAccount as any).assigned_attorney_contact_id) {
      setContactId((existingAccount as any).assigned_attorney_contact_id);
    }
  }, [existingAccount]);

  // Reset downstream selections whenever the person or portal type
  // changes, so a stale email choice can't carry over to a new person.
  useEffect(() => {
    setEmailChoice('');
    setNewEmail('');
  }, [personId, portalType]);

  // Once we know whether an account already exists, default the email
  // choice sensibly: the account's current email if one exists, or the
  // CRM record's email (referring_attorneys.email / medical_experts.email)
  // as a starting point for a brand-new account — falling through to
  // "enter a new email" if neither is available.
  useEffect(() => {
    if (!personId) return;
    if (existingAccount) {
      setEmailChoice(existingAccount.email);
    } else if (selectedPerson?.email) {
      setEmailChoice('__new__');
      setNewEmail(selectedPerson.email);
    } else {
      setEmailChoice('__new__');
      setNewEmail('');
    }
  }, [personId, existingAccount, selectedPerson]);

  const resolvedEmail = emailChoice === '__new__' ? newEmail.trim().toLowerCase() : emailChoice;
  const emailIsValid = !!resolvedEmail && EMAIL_REGEX.test(resolvedEmail) && !/\s/.test(resolvedEmail);

  const accountBlockedReason = existingAccount?.deleted_at
    ? 'This account is in the Recycle Bin — restore it from Portal Accounts first.'
    : existingAccount && existingAccount.status !== 'active'
      ? `This account is ${existingAccount.status} — set it to Active from Portal Accounts first.`
      : null;

  const canGenerate = !!personId && emailIsValid && !accountBlockedReason && (portalType !== 'attorney' || !!contactId);

  const handleCreateContactInline = async () => {
    if (!selectedPerson || !newContactName.trim()) {
      toast.error('Enter the individual attorney\'s name');
      return;
    }
    const created = await createContact.mutateAsync({
      referring_attorney_id: selectedPerson.id,
      full_name: newContactName,
      email: newContactEmail || null,
    });
    setContactId(created.id);
    setShowNewContact(false);
    setNewContactName('');
    setNewContactEmail('');
  };

  const handleGenerateForPerson = async () => {
    if (!selectedPerson || !emailIsValid) {
      toast.error('Choose a person and a valid email first');
      return;
    }
    if (accountBlockedReason) {
      toast.error(accountBlockedReason);
      return;
    }
    if (portalType === 'attorney' && !contactId) {
      toast.error('Choose (or add) the specific individual attorney this account belongs to');
      return;
    }

    let accountId = existingAccount?.id;
    if (!accountId) {
      const created = await createAccountForPerson.mutateAsync({
        portal_type: portalType,
        person_id: selectedPerson.id,
        full_name: selectedPerson.display_name,
        email: resolvedEmail,
        assigned_attorney_contact_id: portalType === 'attorney' ? contactId : null,
      });
      accountId = created.id;
    } else if (portalType === 'attorney' && (existingAccount as any)?.assigned_attorney_contact_id !== contactId) {
      // Existing account, but the individual relationship changed —
      // repair it in place rather than touching the account itself.
      await updateAccountContact.mutateAsync({ accountId, contactId });
    }

    await generateLink.mutateAsync({ accountId, email: resolvedEmail });
    setPersonId('');
    setEmailChoice('');
    setNewEmail('');
  };

  return (
    <ExternalPortalManagementLayout>
      <Helmet><title>External Portal Management — Access Links</title></Helmet>

      {isAdminUser && (
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
      )}

      <AdminCard className="mt-4">
        <AdminCardHeader title="Generate an Access Link" description="Choose a person, choose which email address to use, then send a one-time registration link." icon={Link2} />
        <AdminCardBody className="space-y-4">
          {/* Step 1 — portal type */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setPortalType('attorney'); setPersonId(''); }}
              className={`flex items-center gap-1.5 border px-3 py-1.5 text-sm font-medium transition-colors ${
                portalType === 'attorney'
                  ? 'border-black bg-black text-white'
                  : 'border-black/15 text-slate-600 hover:border-black/30'
              }`}
            >
              <Scale className="h-3.5 w-3.5" /> Referring Attorney
            </button>
            <button
              type="button"
              onClick={() => { setPortalType('expert'); setPersonId(''); }}
              className={`flex items-center gap-1.5 border px-3 py-1.5 text-sm font-medium transition-colors ${
                portalType === 'expert'
                  ? 'border-black bg-black text-white'
                  : 'border-black/15 text-slate-600 hover:border-black/30'
              }`}
            >
              <Stethoscope className="h-3.5 w-3.5" /> Medical Expert
            </button>
          </div>

          {/* Step 2 — person, ranked most used → least used */}
          <div className="space-y-1.5">
            <Select value={personId} onValueChange={setPersonId} disabled={loadingPeople}>
              <SelectTrigger className="rounded-none border-black/15 sm:max-w-md">
                <SelectValue placeholder={loadingPeople ? 'Loading…' : `Select a ${PORTAL_TYPE_LABEL[portalType].toLowerCase()} (most used first)`} />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {!people || people.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500">No {PORTAL_TYPE_LABEL[portalType].toLowerCase()} records found.</div>
                ) : (
                  people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name}
                      {p.usage_count > 0 ? ` — ${p.usage_count} case${p.usage_count === 1 ? '' : 's'}` : ' — unused'}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2b (attorney only) — the specific individual at that firm */}
          {portalType === 'attorney' && personId && (
            <div className="space-y-2 border border-black/10 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700">Which individual attorney at {selectedPerson?.display_name}?</p>
              <p className="text-xs text-slate-500">
                Required — without this, the account can log in but won't see any cases (it's never scoped to the whole firm).
              </p>
              {loadingContacts ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : (
                <Select value={contactId} onValueChange={(v) => (v === '__new__' ? setShowNewContact(true) : setContactId(v))}>
                  <SelectTrigger className="rounded-none border-black/15 sm:max-w-md">
                    <SelectValue placeholder="Select the individual attorney" />
                  </SelectTrigger>
                  <SelectContent>
                    {(contacts || []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}{c.email ? ` — ${c.email}` : ''}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__">
                      <span className="flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Add a new individual…</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}

              {showNewContact && (
                <div className="space-y-2 border border-black/10 bg-white p-2">
                  <Input
                    className="rounded-none border-black/15 sm:max-w-md"
                    placeholder="Individual attorney's full name"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                  />
                  <Input
                    type="email"
                    className="rounded-none border-black/15 sm:max-w-md"
                    placeholder="Their email (optional)"
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                  />
                  <Button size="sm" className="rounded-none bg-black text-white hover:bg-black/85" disabled={createContact.isPending} onClick={handleCreateContactInline}>
                    {createContact.isPending ? 'Adding…' : 'Add & Select'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 3 — email: existing history, or a new address */}
          {personId && (
            <div className="space-y-2 border border-black/10 bg-slate-50 p-3">
              {loadingAccount ? (
                <p className="text-sm text-slate-500">Checking for an existing portal account…</p>
              ) : (
                <>
                  {existingAccount && (
                    <p className="text-xs text-slate-500">
                      Existing portal account —{' '}
                      <AdminPill tone={ACCOUNT_STATUS_TONE[existingAccount.status]}>{ACCOUNT_STATUS_LABEL[existingAccount.status]}</AdminPill>
                    </p>
                  )}
                  {!existingAccount && (
                    <p className="text-xs text-slate-500">No portal account yet — one will be created when you generate the link.</p>
                  )}

                  <Select value={emailChoice} onValueChange={setEmailChoice}>
                    <SelectTrigger className="rounded-none border-black/15 sm:max-w-md">
                      <SelectValue placeholder="Choose an email address" />
                    </SelectTrigger>
                    <SelectContent>
                      {(emailHistory || []).map((h) => (
                        <SelectItem key={h.id} value={h.email}>
                          {h.email}{h.is_current ? ' (current)' : ''}
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__">
                        <span className="flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Enter a new email…</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {emailChoice === '__new__' && (
                    <Input
                      type="email"
                      className="rounded-none border-black/15 sm:max-w-md"
                      placeholder="name@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  )}

                  {emailChoice === '__new__' && newEmail.trim() && !emailIsValid && (
                    <p className="text-xs text-destructive">That doesn't look like a valid email address.</p>
                  )}

                  {accountBlockedReason && (
                    <p className="text-xs text-destructive">{accountBlockedReason}</p>
                  )}
                </>
              )}
            </div>
          )}

          <Button
            className="rounded-none bg-black text-white hover:bg-black/85"
            disabled={!canGenerate || generateLink.isPending || createAccountForPerson.isPending}
            onClick={handleGenerateForPerson}
          >
            {generateLink.isPending || createAccountForPerson.isPending ? 'Generating…' : 'Generate & Email Link'}
          </Button>

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
                    <TableHead>Sent To</TableHead>
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
                      </TableCell>
                      <TableCell>{PORTAL_TYPE_LABEL[l.account_portal_type as 'attorney' | 'expert'] || l.account_portal_type}</TableCell>
                      <TableCell className="text-xs text-slate-500">{l.sent_to_email || l.account_email}</TableCell>
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
