import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Send, MessageSquare } from 'lucide-react';
import { useAdminCaseMessages, useSendAdminCaseMessage } from '@/hooks/externalPortal/useAdminCaseMessages';
import { formatDateTimeShort } from '@/utils/dateTime';
import { cn } from '@/lib/utils';

interface Props {
  accountId: string | null;
  appointmentId: string | null;
  caseLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CaseMessagesAdminDialog: React.FC<Props> = ({ accountId, appointmentId, caseLabel, open, onOpenChange }) => {
  const { data: messages, isLoading } = useAdminCaseMessages(open ? accountId : null, open ? appointmentId : null);
  const sendMessage = useSendAdminCaseMessage(accountId, appointmentId);
  const [draft, setDraft] = useState('');

  const handleSend = async () => {
    if (!draft.trim()) return;
    await sendMessage.mutateAsync(draft.trim());
    setDraft('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-none">
        <DialogHeader>
          <DialogTitle>Messages</DialogTitle>
          <DialogDescription>{caseLabel}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading messages…
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-8 text-center text-sm text-slate-400">
            <MessageSquare className="h-6 w-6 text-slate-300" />
            No messages yet.
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'max-w-[85%] border px-3 py-2 text-sm',
                  m.sender_type === 'admin' ? 'ml-auto border-black/15 bg-slate-50' : 'border-black/10 bg-white'
                )}
              >
                <p className="text-black">{m.body}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                  {m.sender_type === 'admin' ? 'Staff' : 'Portal User'} · {formatDateTimeShort(m.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 border-t border-black/10 pt-3">
          <Textarea
            className="min-h-[44px] flex-1 rounded-none border-black/15"
            placeholder="Reply to this portal user…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            size="icon"
            className="shrink-0 rounded-none bg-black text-white hover:bg-black/85"
            disabled={sendMessage.isPending || !draft.trim()}
            onClick={handleSend}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CaseMessagesAdminDialog;
