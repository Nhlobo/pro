import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

const TICKETS_KEY = ['support-tickets'] as const;

/**
 * Shared support-ticket data layer. Backed by react-query so the Admin
 * Support Hub and the portal support widget read from one cache instead of
 * each firing its own fetch-on-mount — a ticket created or updated from
 * either surface invalidates the same key and both re-render from cache.
 *
 * Public shape is unchanged from the previous implementation on purpose:
 * existing consumers (PortalSupportWidget) keep working without any
 * changes to their call sites.
 */
export const useSupportTickets = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tickets, isLoading: loading, refetch } = useQuery({
    queryKey: TICKETS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as SupportTicket[]) || [];
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const fetchTickets = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const createTicketMutation = useMutation({
    mutationFn: async (ticket: { subject: string; description: string; category: string; priority: string }) => {
      if (!user) throw new Error('Not authenticated');
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
      if (error) throw error;
      return data as SupportTicket;
    },
    onSuccess: (data) => {
      toast({ title: 'Ticket submitted', description: `Ticket ${data.ticket_number} created successfully` });
      queryClient.invalidateQueries({ queryKey: TICKETS_KEY });
    },
    onError: (err: any) => {
      toast({ title: 'Error creating ticket', description: err.message, variant: 'destructive' });
    },
  });

  const updateTicketStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === 'resolved') updates.resolved_at = new Date().toISOString();
      const { error } = await supabase.from('support_tickets').update(updates).eq('id', ticketId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Ticket updated' });
      queryClient.invalidateQueries({ queryKey: TICKETS_KEY });
    },
    onError: (err: any) => {
      toast({ title: 'Error updating ticket', description: err.message, variant: 'destructive' });
    },
  });

  const fetchMessages = useCallback(async (ticketId: string): Promise<TicketMessage[]> => {
    const { data, error } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (error) {
      toast({ title: 'Error loading messages', description: error.message, variant: 'destructive' });
      return [];
    }
    return (data as TicketMessage[]) || [];
  }, [toast]);

  const sendMessage = useCallback(async (ticketId: string, message: string, isInternalNote = false) => {
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
    return data as TicketMessage;
  }, [user, toast]);

  return {
    tickets: tickets || [],
    loading,
    fetchTickets,
    createTicket: createTicketMutation.mutateAsync,
    isCreatingTicket: createTicketMutation.isPending,
    updateTicketStatus: (ticketId: string, status: string) => updateTicketStatusMutation.mutate({ ticketId, status }),
    isUpdatingStatus: updateTicketStatusMutation.isPending,
    fetchMessages,
    sendMessage,
  };
};
