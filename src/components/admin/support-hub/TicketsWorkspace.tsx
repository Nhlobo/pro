// src/components/admin/support-hub/TicketsWorkspace.tsx
import React, { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, MessageSquare, Clock, User, Send, Loader2, ChevronRight, Lock,
} from 'lucide-react';
import { useSupportTickets, TicketMessage } from '@/hooks/useSupportTickets';
import {
  AdminCard,
  AdminPill,
  AdminEmptyState,
  AdminLoadingState,
} from '@/components/admin/ui/AdminUI';

type PillTone = 'neutral' | 'teal' | 'success' | 'warning' | 'destructive';

const STATUS_TONE: Record<string, PillTone> = {
  open: 'teal',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'neutral',
};

const PRIORITY_TONE: Record<string, PillTone> = {
  low: 'neutral',
  medium: 'warning',
  high: 'destructive',
  urgent: 'destructive',
};

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'];
const ROW_HEIGHT = 92;

/**
 * Ticket workspace: a virtualized row list (rows are mounted/unmounted as
 * they scroll into view via @tanstack/react-virtual) instead of rendering
 * every ticket's DOM at once — the list stays fast whether there are 20
 * tickets or 2,000. Detail + reply happens in a side sheet, unchanged in
 * business logic from the previous implementation (same status options,
 * same message send/fetch calls).
 */
const TicketsWorkspace: React.FC = () => {
  const { tickets, loading, updateTicketStatus, fetchMessages, sendMessage } = useSupportTickets();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => tickets.filter(t => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      t.subject.toLowerCase().includes(q) ||
      t.ticket_number.toLowerCase().includes(q) ||
      t.submitted_by_name?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [tickets, search, statusFilter]);

  const selectedTicket = useMemo(
    () => tickets.find(t => t.id === selectedTicketId) || null,
    [tickets, selectedTicketId],
  );

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const openTicketDetail = async (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setLoadingMessages(true);
    const msgs = await fetchMessages(ticketId);
    setMessages(msgs);
    setLoadingMessages(false);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;
    setSending(true);
    const msg = await sendMessage(selectedTicket.id, newMessage, isInternalNote);
    if (msg) {
      setMessages(prev => [...prev, msg]);
      setNewMessage('');
    }
    setSending(false);
  };

  if (loading) {
    return <AdminCard><AdminLoadingState label="Loading tickets…" /></AdminCard>;
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <AdminCard>
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search tickets by subject, number, or sender…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="rounded-none border-black/15 pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="rounded-none border-black/15 sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </AdminCard>

      {/* Virtualized ticket list */}
      {filtered.length === 0 ? (
        <AdminCard>
          <AdminEmptyState icon={MessageSquare} title="No tickets found" description="Try adjusting your search or status filter." />
        </AdminCard>
      ) : (
        <AdminCard className="overflow-hidden">
          <div ref={parentRef} className="max-h-[70vh] overflow-y-auto divide-y divide-black/10">
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
              {virtualizer.getVirtualItems().map(row => {
                const ticket = filtered[row.index];
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => openTicketDetail(ticket.id)}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: row.size,
                      transform: `translateY(${row.start}px)`,
                    }}
                    className="flex w-full items-start gap-3 border-b border-black/10 px-4 py-3 text-left transition-colors hover:bg-black/[0.03]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs text-slate-400">{ticket.ticket_number}</span>
                        <AdminPill tone={STATUS_TONE[ticket.status] || 'neutral'}>{ticket.status.replace('_', ' ')}</AdminPill>
                        <AdminPill tone={PRIORITY_TONE[ticket.priority] || 'neutral'}>{ticket.priority}</AdminPill>
                        <AdminPill tone="neutral">{ticket.category}</AdminPill>
                      </div>
                      <p className="truncate text-sm font-medium text-black">{ticket.subject}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{ticket.submitted_by_name}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(ticket.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="border-t border-black/10 px-4 py-2 text-[11px] text-slate-400">
            Showing {filtered.length} of {tickets.length} ticket{tickets.length === 1 ? '' : 's'}
          </div>
        </AdminCard>
      )}

      {/* Ticket detail panel */}
      <Sheet open={!!selectedTicket} onOpenChange={(open) => { if (!open) setSelectedTicketId(null); }}>
        <SheetContent side="right" className="flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-2xl">
          <SheetHeader className="space-y-1 border-b border-black/10 px-5 py-4 text-left">
            <SheetTitle className="flex items-center gap-2 text-black">
              <span className="font-mono text-xs text-slate-400">{selectedTicket?.ticket_number}</span>
              <span className="truncate">{selectedTicket?.subject}</span>
            </SheetTitle>
            <SheetDescription>Review the ticket, update its status, and reply to the submitter.</SheetDescription>
          </SheetHeader>

          {selectedTicket && (
            <div className="flex flex-1 flex-col gap-4 px-5 py-4">
              {/* Ticket info */}
              <div className="grid grid-cols-1 gap-3 border border-black/10 bg-black/[0.02] p-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">From</p>
                  <p className="mt-0.5 text-black">{selectedTicket.submitted_by_name} <span className="text-slate-400">({selectedTicket.submitted_by_role})</span></p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Category</p>
                  <p className="mt-0.5 text-black">{selectedTicket.category}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Description</p>
                  <p className="mt-0.5 text-black">{selectedTicket.description}</p>
                </div>
              </div>

              {/* Status actions */}
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map(s => (
                  <Button
                    key={s}
                    size="sm"
                    variant={selectedTicket.status === s ? 'default' : 'outline'}
                    className={selectedTicket.status === s
                      ? 'rounded-none bg-black text-white hover:bg-black/90'
                      : 'rounded-none border-black/15 text-black hover:bg-black/5'}
                    onClick={() => updateTicketStatus(selectedTicket.id, s)}
                  >
                    {s.replace('_', ' ')}
                  </Button>
                ))}
              </div>

              {/* Messages */}
              <div className="h-56 overflow-y-auto border border-black/10 p-3">
                {loadingMessages ? (
                  <AdminLoadingState label="Loading messages…" />
                ) : messages.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">No messages yet</p>
                ) : (
                  <div className="space-y-2">
                    {messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`border p-2 text-sm ${msg.is_internal_note ? 'border-warning/30 bg-warning/5' : 'border-black/10 bg-black/[0.02]'}`}
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-black">{msg.sender_name}</span>
                          <AdminPill tone="neutral">{msg.sender_role}</AdminPill>
                          {msg.is_internal_note && (
                            <AdminPill tone="warning"><Lock className="h-2.5 w-2.5" /> Internal</AdminPill>
                          )}
                          <span className="ml-auto text-[10px] text-slate-400">{new Date(msg.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-black">{msg.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reply */}
              <div className="mt-auto space-y-2 border-t border-black/10 pt-4">
                <Textarea
                  placeholder="Type your reply…"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  rows={2}
                  className="rounded-none border-black/15"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={e => setIsInternalNote(e.target.checked)}
                      className="rounded-none"
                    />
                    Internal note (not visible to submitter)
                  </label>
                  <Button
                    size="sm"
                    className="rounded-none bg-black text-white hover:bg-black/90"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sending}
                  >
                    {sending ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Send className="mr-1.5 h-3 w-3" />}
                    Send
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TicketsWorkspace;
