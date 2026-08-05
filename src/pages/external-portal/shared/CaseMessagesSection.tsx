import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Send, MessageSquare } from 'lucide-react';
import { useCaseMessages, useSendCaseMessage } from '@/hooks/externalPortal/useCaseMessages';
import { formatDateTimeShort } from '@/utils/dateTime';
import { cn } from '@/lib/utils';

const CaseMessagesSection: React.FC<{ appointmentId: string }> = ({ appointmentId }) => {
  const { data, isLoading } = useCaseMessages(appointmentId);
  const sendMessage = useSendCaseMessage(appointmentId);
  const [draft, setDraft] = useState('');

  const handleSend = async () => {
    if (!draft.trim()) return;
    await sendMessage.mutateAsync(draft.trim());
    setDraft('');
  };

  return (
    <Card className="rounded-none border-black/10">
      <CardHeader><CardTitle className="text-base">Messages</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading messages…
          </div>
        ) : !data || data.messages.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-6 text-center text-sm text-slate-400">
            <MessageSquare className="h-6 w-6 text-slate-300" />
            No messages yet — send one below if you have a question about this case.
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {data.messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'max-w-[85%] border px-3 py-2 text-sm',
                  m.sender_type === 'external_user' ? 'ml-auto border-black/15 bg-slate-50' : 'border-black/10 bg-white'
                )}
              >
                <p className="text-black">{m.body}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                  {m.sender_type === 'external_user' ? 'You' : 'Case Team'} · {formatDateTimeShort(m.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 border-t border-black/10 pt-3">
          <Textarea
            className="min-h-[44px] flex-1 rounded-none border-black/15"
            placeholder="Type a message about this case…"
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
      </CardContent>
    </Card>
  );
};

export default CaseMessagesSection;
