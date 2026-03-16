import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, HeadsetIcon, Megaphone, HelpCircle, Plus, Send, Clock, MessageSquare } from 'lucide-react';
import { useSupportTickets, TicketMessage } from '@/hooks/useSupportTickets';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useFAQ } from '@/hooks/useFAQ';

const PortalSupportWidget: React.FC = () => {
  const { tickets, loading: ticketsLoading, createTicket, fetchMessages, sendMessage } = useSupportTickets();
  const { announcements, loading: announcementsLoading } = useAnnouncements();
  const { articles, loading: faqLoading } = useFAQ();

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

  const statusColors: Record<string, string> = {
    open: 'bg-primary/10 text-primary',
    in_progress: 'bg-warning/10 text-warning',
    resolved: 'bg-success/10 text-success',
    closed: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Support & Communications</h1>
        <p className="text-sm text-muted-foreground">Submit queries, view announcements, and browse FAQ</p>
      </div>

      <Tabs defaultValue="announcements" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="announcements" className="gap-2"><Megaphone className="h-4 w-4" /> Announcements</TabsTrigger>
          <TabsTrigger value="tickets" className="gap-2"><HeadsetIcon className="h-4 w-4" /> My Tickets</TabsTrigger>
          <TabsTrigger value="faq" className="gap-2"><HelpCircle className="h-4 w-4" /> FAQ</TabsTrigger>
        </TabsList>

        {/* Announcements */}
        <TabsContent value="announcements">
          {announcementsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : publishedAnnouncements.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No announcements</p>
          ) : (
            <div className="space-y-3">
              {publishedAnnouncements.map(a => (
                <Card key={a.id} className={a.priority === 'urgent' ? 'border-destructive/30 bg-destructive/5' : a.priority === 'high' ? 'border-warning/30 bg-warning/5' : ''}>
                  <CardContent className="py-4 px-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Megaphone className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-foreground">{a.title}</span>
                      {a.priority !== 'normal' && <Badge variant={a.priority === 'urgent' ? 'destructive' : 'outline'} className="text-xs">{a.priority}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{a.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">{new Date(a.created_at).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tickets */}
        <TabsContent value="tickets">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Ticket</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Submit Support Ticket</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder="Subject" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
                    <Textarea placeholder="Describe your query..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} />
                    <div className="grid grid-cols-2 gap-3">
                      <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
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
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full" onClick={handleCreate}>Submit Ticket</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {ticketsLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : tickets.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No tickets submitted yet</p>
            ) : (
              <div className="space-y-2">
                {tickets.map(ticket => (
                  <Card key={ticket.id} className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => openTicket(ticket)}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{ticket.ticket_number}</span>
                        <Badge variant="outline" className={statusColors[ticket.status]}>{ticket.status.replace('_', ' ')}</Badge>
                      </div>
                      <p className="font-medium text-foreground text-sm">{ticket.subject}</p>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1"><Clock className="h-3 w-3" />{new Date(ticket.created_at).toLocaleDateString()}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Ticket Detail */}
          <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
            <DialogContent className="max-w-lg max-h-[70vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-muted-foreground">{selectedTicket?.ticket_number}</span>
                  {selectedTicket?.subject}
                </DialogTitle>
              </DialogHeader>
              {selectedTicket && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{selectedTicket.description}</p>
                  <ScrollArea className="h-40 border rounded-lg p-3">
                    {loadingMessages ? (
                      <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                    ) : messages.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-4">No replies yet</p>
                    ) : (
                      <div className="space-y-2">
                        {messages.filter(m => !m.is_internal_note).map(msg => (
                          <div key={msg.id} className="p-2 rounded-lg bg-muted/50 text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{msg.sender_name}</span>
                              <span className="text-[10px] text-muted-foreground ml-auto">{new Date(msg.created_at).toLocaleString()}</span>
                            </div>
                            <p>{msg.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                  <div className="flex gap-2">
                    <Input placeholder="Reply..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleReply()} />
                    <Button size="icon" onClick={handleReply} disabled={!newMessage.trim()}><Send className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* FAQ */}
        <TabsContent value="faq">
          {faqLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : Object.keys(faqGrouped).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No FAQ articles available</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(faqGrouped).map(([category, items]) => (
                <Card key={category}>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm capitalize flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary" /> {category}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 px-4 pb-3">
                    <Accordion type="multiple">
                      {items.map(item => (
                        <AccordionItem key={item.id} value={item.id}>
                          <AccordionTrigger className="text-sm text-left">{item.question}</AccordionTrigger>
                          <AccordionContent><p className="text-sm text-muted-foreground">{item.answer}</p></AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PortalSupportWidget;
