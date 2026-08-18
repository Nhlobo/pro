import React, { useEffect, useState } from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { AttorneyNotLinkedState } from '@/components/portal/AttorneyNotLinkedState';
import { useAttorneyLinkStatus } from '@/hooks/useAttorneyLinkStatus';
import { useExternalPortalMessageThreads, useExternalPortalCaseMessages } from '@/hooks/useExternalPortalMessages';
import {
  PortalPage,
  PortalHeader,
  PortalCard,
  PortalCardBody,
  PortalEmptyState,
  PortalLoadingState,
  PortalPill,
} from '@/components/attorney-portal/ui/PortalPrimitives';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { MessageSquare, Send, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';

/**
 * Case-linked messaging. Scope is intentionally narrower than "My
 * Cases": only appointments an admin has explicitly opened messaging
 * on (external_portal_case_links), not every case this attorney can
 * see — see the RLS in the Phase 11 migration for the enforced
 * boundary this UI mirrors.
 */
const AttorneyMessages: React.FC = () => {
  const linkStatus = useAttorneyLinkStatus();
  const { data: threads, isLoading } = useExternalPortalMessageThreads();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && threads && threads.length > 0) setSelectedId(threads[0].appointment_id);
  }, [threads, selectedId]);

  if (linkStatus === 'checking') return <PortalLoadingState label="Loading…" />;
  if (linkStatus === 'not_linked') return <AttorneyNotLinkedState />;

  const selectedThread = threads?.find((t) => t.appointment_id === selectedId) || null;

  return (
    <AttorneyPortalLayout>
      <PortalPage>
        <PortalHeader eyebrow="Attorney Portal" title="Messages" description="Case-linked conversations with our team." icon={MessageSquare} />

        {isLoading ? (
          <PortalLoadingState label="Loading messages…" />
        ) : !threads || threads.length === 0 ? (
          <PortalEmptyState
            icon={MessageSquare}
            title="No message threads yet"
            description="When our team opens a case for messaging, it will appear here."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-[280px_1fr]">
            <PortalCard className={cn(selectedId && 'hidden md:block')}>
              <PortalCardBody className="max-h-[70vh] divide-y divide-black/10 overflow-y-auto p-0">
                {threads.map((t) => (
                  <button
                    key={t.appointment_id}
                    onClick={() => setSelectedId(t.appointment_id)}
                    className={cn(
                      'block w-full px-3 py-2.5 text-left transition-colors hover:bg-slate-50',
                      selectedId === t.appointment_id && 'bg-slate-50'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{t.claimant_name}</p>
                      {t.unread_count > 0 && <PortalPill tone="teal">{t.unread_count}</PortalPill>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{t.last_message_preview || 'No messages yet'}</p>
                  </button>
                ))}
              </PortalCardBody>
            </PortalCard>

            <div className={cn(!selectedId && 'hidden md:block')}>
              {selectedThread && (
                <MessageThread
                  key={selectedThread.appointment_id}
                  appointmentId={selectedThread.appointment_id}
                  claimantName={selectedThread.claimant_name}
                  onBack={() => setSelectedId(null)}
                />
              )}
            </div>
          </div>
        )}
      </PortalPage>
    </AttorneyPortalLayout>
  );
};

const MessageThread: React.FC<{ appointmentId: string; claimantName: string; onBack: () => void }> = ({
  appointmentId,
  claimantName,
  onBack,
}) => {
  const { data: messages, isLoading, sendMessage, markThreadRead } = useExternalPortalCaseMessages(appointmentId);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    markThreadRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  const handleSend = () => {
    if (!draft.trim()) return;
    sendMessage.mutate(draft, { onSuccess: () => setDraft('') });
  };

  return (
    <PortalCard className="flex h-[70vh] flex-col">
      <div className="flex items-center gap-2 border-b border-black/10 px-3 py-2.5">
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none md:hidden" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="truncate text-sm font-semibold">{claimantName}</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {isLoading ? (
          <PortalLoadingState label="Loading conversation…" />
        ) : !messages || messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No messages yet — say hello.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn('flex', m.sender_type === 'external_user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] border px-3 py-2 text-sm',
                  m.sender_type === 'external_user' ? 'border-black bg-black text-white' : 'border-black/10 bg-slate-50'
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn('mt-1 text-[10px]', m.sender_type === 'external_user' ? 'text-white/60' : 'text-slate-400')}>
                  {format(new Date(m.created_at), 'd MMM, h:mm a')}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-end gap-2 border-t border-black/10 p-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          className="min-h-[44px] rounded-none border-black/15"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button
          className="h-11 shrink-0 rounded-none bg-black text-white hover:bg-black/85"
          disabled={!draft.trim() || sendMessage.isPending}
          onClick={handleSend}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </PortalCard>
  );
};

export default AttorneyMessages;
