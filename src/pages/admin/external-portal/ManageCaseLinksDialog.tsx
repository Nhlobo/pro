import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AdminPill, AdminEmptyState, AdminLoadingState } from '@/components/admin/ui/AdminUI';
import { Search, Link2, X, FolderOpen, MessageSquare } from 'lucide-react';
import {
  useAccountCaseLinks,
  useSearchCases,
  useLinkCaseToAccount,
  useUnlinkCaseFromAccount,
} from '@/hooks/externalPortal/useExternalPortalCaseLinks';
import { formatDateTimeShort } from '@/utils/dateTime';
import CaseMessagesAdminDialog from './CaseMessagesAdminDialog';

interface Props {
  accountId: string | null;
  accountName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ManageCaseLinksDialog: React.FC<Props> = ({ accountId, accountName, open, onOpenChange }) => {
  const [query, setQuery] = useState('');
  const { data: linkedCases, isLoading: linkedLoading } = useAccountCaseLinks(open ? accountId : null);
  const { data: searchResults, isLoading: searchLoading } = useSearchCases(query);
  const linkCase = useLinkCaseToAccount();
  const unlinkCase = useUnlinkCaseFromAccount();
  const [messagesFor, setMessagesFor] = useState<{ appointmentId: string; label: string } | null>(null);

  const linkedAppointmentIds = new Set((linkedCases || []).map((c) => c.appointment_id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-none">
        <DialogHeader>
          <DialogTitle>Manage Linked Cases</DialogTitle>
          <DialogDescription>{accountName} can only see cases linked here.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Currently Linked</p>
            {linkedLoading ? (
              <AdminLoadingState label="Loading linked cases…" />
            ) : !linkedCases || linkedCases.length === 0 ? (
              <AdminEmptyState icon={FolderOpen} title="No cases linked yet" description="Search below to link one." />
            ) : (
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {linkedCases.map((c) => (
                  <div key={c.link_id} className="flex items-center justify-between gap-2 border border-black/10 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-black">
                        {c.claimant_name}
                        {c.claimant_reference && <span className="ml-2 text-xs text-slate-400">#{c.claimant_reference}</span>}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {c.matter_type || 'Matter'} · {formatDateTimeShort(c.appointment_date)}
                        {c.case_status && ` · ${c.case_status}`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0 rounded-none px-2"
                      onClick={() => setMessagesFor({ appointmentId: c.appointment_id, label: `${accountName} · ${c.claimant_name}` })}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0 rounded-none px-2 text-destructive hover:text-destructive"
                      disabled={unlinkCase.isPending}
                      onClick={() => accountId && unlinkCase.mutate({ linkId: c.link_id, accountId })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Link a Case</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                className="rounded-none border-black/15 pl-8"
                placeholder="Search by claimant name or reference…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {query.trim().length >= 2 && (
              <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
                {searchLoading ? (
                  <AdminLoadingState label="Searching…" />
                ) : !searchResults || searchResults.length === 0 ? (
                  <p className="px-1 py-3 text-center text-xs text-slate-400">No matching cases found.</p>
                ) : (
                  searchResults.map((c) => {
                    const alreadyLinked = linkedAppointmentIds.has(c.appointment_id);
                    return (
                      <div key={c.appointment_id} className="flex items-center justify-between gap-2 border border-black/10 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-black">
                            {c.claimant_name}
                            {c.claimant_reference && <span className="ml-2 text-xs text-slate-400">#{c.claimant_reference}</span>}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {c.matter_type || 'Matter'} · {formatDateTimeShort(c.appointment_date)}
                            {c.case_status && ` · ${c.case_status}`}
                          </p>
                        </div>
                        {alreadyLinked ? (
                          <AdminPill tone="neutral">Linked</AdminPill>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 shrink-0 rounded-none border-black/15 px-2"
                            disabled={linkCase.isPending}
                            onClick={() => accountId && linkCase.mutate({ accountId, appointmentId: c.appointment_id })}
                          >
                            <Link2 className="mr-1 h-3.5 w-3.5" /> Link
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      <CaseMessagesAdminDialog
        accountId={accountId}
        appointmentId={messagesFor?.appointmentId ?? null}
        caseLabel={messagesFor?.label ?? ''}
        open={!!messagesFor}
        onOpenChange={(o) => !o && setMessagesFor(null)}
      />
    </Dialog>
  );
};

export default ManageCaseLinksDialog;
