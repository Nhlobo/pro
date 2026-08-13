import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, HeadsetIcon, Megaphone, HelpCircle, Plus, Send, Clock, MessageSquare } from 'lucide-react';
import { useSupportTickets, TicketMessage } from '@/hooks/useSupportTickets';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useFAQ } from '@/hooks/useFAQ';
import { AdminTabList, AdminTabTrigger } from '@/components/admin/ui/AdminUI';
import {
  PortalPage,
  PortalHeader,
  PortalCard,
  PortalCardHeader,
  PortalCardBody,
  PortalEmptyState,
  PortalLoadingState,
  PortalPill,
  type PortalPillTone,
} from '@/components/attorney-portal/ui/PortalPrimitives';

/**
 * Support & Communications — shared by both the Attorney and Expert
 * portals (AttorneySupport.tsx and ExpertSupport.tsx both render this
 * directly). Rebuilt on the same flat/square design system as every
 * other portal page instead of the default rounded shadcn Card/Tabs
 * styling it had before: PortalPage/PortalHeader shell, the black
 * scrollable AdminTabList tab bar, PortalCard sections, and semantic
 * PortalPill tones instead of ad-hoc badge colors.
 *
 * `portalLabel` lets each parent page set the right eyebrow text
 * ("Attorney Portal" / "Expert Portal") without duplicating the rest
 * of this component.
 */

const TICKET_STATUS_TONE: Record<string, PortalPillTone> = {
  open: 'teal',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'neutral',
};

const ANNOUNCEMENT_TONE: Record<string, PortalPillTone> = {
  urgent: 'destructive',
  high: 'warning',
};

const PortalSupportWidget: React.FC<{ portalLabel?: string }> = ({ portalLabel = 'Support' }) => {
  const { tickets, loading: ticketsLoading, createTicket, fetchMessages, sendMessage } = useSupportTickets();
  const { announcements, loading: announcementsLoading } = useAnnouncements();
  const { articles, loading: faqLoading } = useFAQ();

  const [activeTab, setActiveTab] = useState('announcements');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ subject: '', description: '', category: 'general', priority: 'medium' });
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);

  const publishedAnnouncements = announcements.filter(a => a.is_published);
  const publishedFAQ = articles.filter(a => a.is_published);

  const handleCreate = async () => {
    if (!form.subject || !form.description) return;
    await createTicket(form);
    setForm({ subject: '', description: '', category: 'general', priority: 'medium' });
    setCreateOpen(false);
  };

  const openTicket = async (ticket: any) => {
    setSelectedTicket(ticket);
    setLoadingMessages(true);
    const msgs = await fetchMessages(ticket.id);
    setMessages(msgs);
    setLoadingMessages(false);
  };

  const handleReply = async () => {
    if (!newMessage.trim() || !selectedTicket) return;
    const msg = await sendMessage(selectedTicket.id, newMessage);
    if (msg) {
      setMessages(prev => [...prev, msg as any]);
      setNewMessage('');
    }
  };

  const faqGrouped = publishedFAQ.reduce((acc, a) => {
    if (!acc[a.category]) acc[a.category] = [];
    acc[a.category].push(a);
    return acc;
  }, {} as Record<string, typeof publishedFAQ>);

  return (
    <PortalPage>
      <PortalHeader
        eyebrow={portalLabel}
        title="Support & Communications"
        description="Submit queries, view announcements, and browse FAQ."
        icon={HeadsetIcon}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <AdminTabList>
          <AdminTabTrigger value="announcements" label="Announcements" icon={Megaphone} />
          <AdminTabTrigger value="tickets" label="My Tickets" icon={HeadsetIcon} badge={tickets.length || undefined} />
          <AdminTabTrigger value="faq" label="FAQ" icon={HelpCircle} />
        </AdminTabList>
      </Tabs>

      {/* Announcements */}
      {activeTab === 'announcements' && (
        <PortalCard>
          {announcementsLoading ? (
            <PortalLoadingState label="Loading announcements…" />
          ) : publishedAnnouncements.length === 0 ? (
            <PortalEmptyState icon={Megaphone} title="No announcements" />
          ) : (
            <PortalCardBody className="space-y-3">
              {publishedAnnouncements.map(a => (
                <div
                  key={a.id}
                  className={`border p-4 ${a.priority === 'urgent' ? 'border-destructive/30 bg-destructive/5' : a.priority === 'high' ? 'border-warning/30 bg-warning/5' : 'border-black/10'}`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Megaphone className="h-4 w-4" />
                    <span className="font-semibold text-black">{a.title}</span>
                    {a.priority !== 'normal' && (
                      <PortalPill tone={ANNOUNCEMENT_TONE[a.priority] || 'neutral'}>{a.priority}</PortalPill>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">{a.content}</p>
                  <p className="mt-2 text-[10px] text-slate-400">{new Date(a.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </PortalCardBody>
          )}
        </PortalCard>
      )}

      {/* Tickets */}
      {activeTab === 'tickets' && (
        <>
          <PortalCard>
            <PortalCardHeader
              icon={HeadsetIcon}
              title={`My Tickets (${tickets.length})`}
              actions={
                <Button size="sm" className="rounded-none" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" /> New Ticket
                </Button>
              }
            />
            {ticketsLoading ? (
              <PortalLoadingState label="Loading tickets…" />
            ) : tickets.length === 0 ? (
              <PortalEmptyState icon={HeadsetIcon} title="No tickets submitted yet" />
            ) : (
              <PortalCardBody className="p-0">
                <ul>
                  {tickets.map(ticket => (
                    <li
                      key={ticket.id}
                      className="cursor-pointer border-b border-black/10 px-4 py-3 last:border-b-0 transition-colors hover:bg-black/[0.03]"
                      onClick={() => openTicket(ticket)}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-500">{ticket.ticket_number}</span>
                        <PortalPill tone={TICKET_STATUS_TONE[ticket.status] || 'neutral'}>{ticket.status.replace('_', ' ')}</PortalPill>
                      </div>
                      <p className="text-sm font-medium text-black">{ticket.subject}</p>
                      <span className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                        <Clock className="h-3 w-3" />{new Date(ticket.created_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </PortalCardBody>
            )}
          </PortalCard>

          {/* New ticket — slides in from the right, same panel pattern
              used across every other portal surface (no center-screen
              popups). */}
          <Sheet open={createOpen} onOpenChange={setCreateOpen}>
            <SheetContent side="right" className="flex w-full flex-col overflow-y-auto rounded-none sm:max-w-md">
              <SheetHeader className="text-left">
                <SheetTitle>Submit Support Ticket</SheetTitle>
                <SheetDescription>Describe your query and we'll get back to you as soon as possible.</SheetDescription>
              </SheetHeader>
              <div className="mt-4 flex-1 space-y-3">
                <Input className="rounded-none" placeholder="Subject" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
                <Textarea className="rounded-none" placeholder="Describe your query..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} />
                <div className="grid grid-cols-2 gap-3">
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="appointments">Appointments</SelectItem>
                      <SelectItem value="reports">Reports</SelectItem>
                      <SelectItem value="payments">Payments</SelectItem>
                      <SelectItem value="documents">Documents</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                    <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full rounded-none" onClick={handleCreate} disabled={!form.subject || !form.description}>Submit Ticket</Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Ticket detail — same sliding side-sheet pattern as the New
              Ticket panel above, instead of a center-screen popup. */}
          <Sheet open={!!selectedTicket} onOpenChange={(open) => { if (!open) setSelectedTicket(null); }}>
            <SheetContent side="right" className="flex w-full flex-col overflow-y-auto rounded-none sm:max-w-lg">
              <SheetHeader className="text-left">
                <SheetTitle className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-slate-500">{selectedTicket?.ticket_number}</span>
                  <span className="truncate">{selectedTicket?.subject}</span>
                </SheetTitle>
                <SheetDescription>Track replies and add a message below.</SheetDescription>
              </SheetHeader>
              {selectedTicket && (
                <div className="mt-4 flex flex-1 flex-col gap-3">
                  <p className="text-sm text-slate-600">{selectedTicket.description}</p>
                  <ScrollArea className="h-56 border border-black/10 p-3">
                    {loadingMessages ? (
                      <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                    ) : messages.length === 0 ? (
                      <p className="py-4 text-center text-sm text-slate-500">No replies yet</p>
                    ) : (
                      <div className="space-y-2">
                        {messages.filter(m => !m.is_internal_note).map(msg => (
                          <div key={msg.id} className="bg-black/[0.03] p-2 text-sm">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="font-medium text-black">{msg.sender_name}</span>
                              <span className="ml-auto text-[10px] text-slate-400">{new Date(msg.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-slate-700">{msg.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                  <div className="mt-auto flex gap-2">
                    <Input className="rounded-none" placeholder="Reply..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleReply()} />
                    <Button size="icon" className="rounded-none" onClick={handleReply} disabled={!newMessage.trim()}><Send className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </>
      )}

      {/* FAQ */}
      {activeTab === 'faq' && (
        faqLoading ? (
          <PortalCard><PortalLoadingState label="Loading FAQ…" /></PortalCard>
        ) : Object.keys(faqGrouped).length === 0 ? (
          <PortalCard><PortalEmptyState icon={HelpCircle} title="No FAQ articles available" /></PortalCard>
        ) : (
          <div className="space-y-4">
            {Object.entries(faqGrouped).map(([category, items]) => (
              <PortalCard key={category}>
                <PortalCardHeader icon={HelpCircle} title={category} className="capitalize" />
                <PortalCardBody>
                  <Accordion type="multiple">
                    {items.map(item => (
                      <AccordionItem key={item.id} value={item.id}>
                        <AccordionTrigger className="text-left text-sm">{item.question}</AccordionTrigger>
                        <AccordionContent><p className="text-sm text-slate-600">{item.answer}</p></AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </PortalCardBody>
              </PortalCard>
            ))}
          </div>
        )
      )}

      <div className="flex items-start gap-3 border border-black/10 bg-[#F7F5EE] p-4">
        <MessageSquare className="mt-1 h-5 w-5 shrink-0 text-black" />
        <div className="text-sm text-slate-700">
          For account-specific issues please include your registered email and a screenshot of
          the message you are seeing.
        </div>
      </div>
    </PortalPage>
  );
};

export default PortalSupportWidget;
