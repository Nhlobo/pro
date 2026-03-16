import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface SupportTicket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  submitted_by: string;
  submitted_by_email: string;
  submitted_by_name: string;
  submitted_by_role: string;
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  is_internal_note: boolean;
  created_at: string;
}

export const useSupportTickets = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error loading tickets', description: error.message, variant: 'destructive' });
    } else {
      setTickets((data as any[]) || []);
    }
    setLoading(false);
  }, [toast]);

  const createTicket = async (ticket: { subject: string; description: string; category: string; priority: string }) => {
    if (!user) return null;

    const profile = await supabase.from('profiles').select('role, first_name, last_name, email').eq('id', user.id).single();
    const displayName = profile.data ? `${profile.data.first_name || ''} ${profile.data.last_name || ''}`.trim() : '';

    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        subject: ticket.subject,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        submitted_by: user.id,
        submitted_by_email: user.email || '',
        submitted_by_name: displayName || user.email || '',
        submitted_by_role: profile.data?.role || 'user',
      } as any)
      .select()
      .single();

    if (error) {
      toast({ title: 'Error creating ticket', description: error.message, variant: 'destructive' });
      return null;
    }
    toast({ title: 'Ticket submitted', description: `Ticket ${(data as any)?.ticket_number} created successfully` });
    fetchTickets();
    return data;
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === 'resolved') updates.resolved_at = new Date().toISOString();

    const { error } = await supabase.from('support_tickets').update(updates).eq('id', ticketId);
    if (error) {
      toast({ title: 'Error updating ticket', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Ticket updated' });
      fetchTickets();
    }
  };

  const fetchMessages = async (ticketId: string): Promise<TicketMessage[]> => {
    const { data, error } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      toast({ title: 'Error loading messages', description: error.message, variant: 'destructive' });
      return [];
    }
    return (data as any[]) || [];
  };

  const sendMessage = async (ticketId: string, message: string, isInternalNote = false) => {
    if (!user) return null;
    const profile = await supabase.from('profiles').select('role, first_name, last_name').eq('id', user.id).single();
    const displayName = profile.data ? `${profile.data.first_name || ''} ${profile.data.last_name || ''}`.trim() : '';

    const { data, error } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_id: user.id,
        sender_name: displayName || user.email || '',
        sender_role: profile.data?.role || 'user',
        message,
        is_internal_note: isInternalNote,
      } as any)
      .select()
      .single();

    if (error) {
      toast({ title: 'Error sending message', description: error.message, variant: 'destructive' });
      return null;
    }
    return data;
  };

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  return { tickets, loading, fetchTickets, createTicket, updateTicketStatus, fetchMessages, sendMessage };
};
