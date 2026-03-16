import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, MessageSquare, Clock, User, Send } from 'lucide-react';
import { useSupportTickets, TicketMessage } from '@/hooks/useSupportTickets';

const statusColors: Record<string, string> = {
  open: 'bg-primary/10 text-primary border-primary/30',
  in_progress: 'bg-warning/10 text-warning border-warning/30',
  resolved: 'bg-success/10 text-success border-success/30',
  closed: 'bg-muted text-muted-foreground',
};

const priorityColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-warning/10 text-warning border-warning/30',
  high: 'bg-destructive/10 text-destructive border-destructive/30',
  urgent: 'bg-destructive text-destructive-foreground',
};

const AdminTicketManager: React.FC = () => {
  const { tickets, loading, updateTicketStatus, fetchMessages, sendMessage } = useSupportTickets();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const openTicketDetail = async (ticket: any) => {
    setSelectedTicket(ticket);
    setLoadingMessages(true);
    const msgs = await fetchMessages(ticket.id);
    setMessages(msgs);
    setLoadingMessages(false);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;
    const msg = await sendMessage(selectedTicket.id, newMessage, isInternalNote);
    if (msg) {
      setMessages(prev => [...prev, msg as any]);
      setNewMessage('');
    }
  };

  const filtered = tickets.filter(t => {
    const matchesSearch = t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      t.submitted_by_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{stats.open}</p><p className="text-xs text-muted-foreground">Open</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-warning">{stats.inProgress}</p><p className="text-xs text-muted-foreground">In Progress</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-success">{stats.resolved}</p><p className="text-xs text-muted-foreground">Resolved</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Ticket List */}
      <div className="space-y-2">
        {filtered.map(ticket => (
          <Card key={ticket.id} className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => openTicketDetail(ticket)}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground">{ticket.ticket_number}</span>
                    <Badge variant="outline" className={statusColors[ticket.status] || ''}>{ticket.status.replace('_', ' ')}</Badge>
                    <Badge variant="outline" className={priorityColors[ticket.priority] || ''}>{ticket.priority}</Badge>
                    <Badge variant="outline" className="text-xs">{ticket.category}</Badge>
                  </div>
                  <p className="font-medium text-foreground text-sm">{ticket.subject}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><User className="h-3 w-3" />{ticket.submitted_by_name}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(ticket.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No tickets found</p>}
      </div>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">{selectedTicket?.ticket_number}</span>
              {selectedTicket?.subject}
            </DialogTitle>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-4">
              {/* Ticket Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">From:</span> {selectedTicket.submitted_by_name} ({selectedTicket.submitted_by_role})</div>
                <div><span className="text-muted-foreground">Category:</span> {selectedTicket.category}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Description:</span> {selectedTicket.description}</div>
              </div>

              {/* Status Actions */}
              <div className="flex gap-2">
                {['open', 'in_progress', 'resolved', 'closed'].map(s => (
                  <Button key={s} size="sm" variant={selectedTicket.status === s ? 'default' : 'outline'} onClick={() => { updateTicketStatus(selectedTicket.id, s); setSelectedTicket({ ...selectedTicket, status: s }); }}>
                    {s.replace('_', ' ')}
                  </Button>
                ))}
              </div>

              {/* Messages */}
              <ScrollArea className="h-48 border rounded-lg p-3">
                {loadingMessages ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                ) : messages.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">No messages yet</p>
                ) : (
                  <div className="space-y-3">
                    {messages.map(msg => (
                      <div key={msg.id} className={`p-2 rounded-lg text-sm ${msg.is_internal_note ? 'bg-warning/10 border border-warning/20' : 'bg-muted/50'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-foreground">{msg.sender_name}</span>
                          <Badge variant="outline" className="text-[9px]">{msg.sender_role}</Badge>
                          {msg.is_internal_note && <Badge variant="outline" className="text-[9px] border-warning text-warning">Internal</Badge>}
                          <span className="text-[10px] text-muted-foreground ml-auto">{new Date(msg.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-foreground">{msg.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Reply */}
              <div className="space-y-2">
                <Textarea placeholder="Type your reply..." value={newMessage} onChange={e => setNewMessage(e.target.value)} rows={2} />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" checked={isInternalNote} onChange={e => setIsInternalNote(e.target.checked)} className="rounded" />
                    Internal note (not visible to submitter)
                  </label>
                  <Button size="sm" onClick={handleSendMessage} disabled={!newMessage.trim()}>
                    <Send className="h-3 w-3 mr-1" /> Send
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTicketManager;
