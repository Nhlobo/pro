import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type ChatKind = 'direct' | 'group' | 'broadcast';

export interface ChatUser {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  position?: string | null;
}

export interface ChatConversation {
  id: string;
  title: string | null;
  kind: ChatKind;
  created_by: string;
  last_message_at: string;
  participants: { user_id: string; last_read_at: string | null; role: string }[];
  lastMessage?: { body: string; sender_id: string; created_at: string } | null;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  requires_acknowledgement: boolean;
  created_at: string;
  acknowledgements: { user_id: string; acknowledged_at: string }[];
}

const INTERNAL_ROLES = ['admin', 'employee', 'sales_consultant', 'finance', 'director'];

export function useInternalChat() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const userMapRef = useRef<Map<string, ChatUser>>(new Map());

  // ---- Load internal users (directory) ----
  const loadUsers = useCallback(async () => {
    const { data: profiles, error } = await (supabase as any).rpc('get_internal_chat_users');
    if (error) {
      toast.error('Could not load chat users: ' + error.message);
      setUsers([]);
      userMapRef.current = new Map();
      return;
    }
    const list: ChatUser[] = (profiles || []).map((p: any) => ({
      id: p.id,
      email: p.email,
      role: p.role,
      position: p.position,
      name: [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || 'User',
    }));
    list.sort((a, b) => a.name.localeCompare(b.name));
    setUsers(list);
    userMapRef.current = new Map(list.map((u) => [u.id, u]));
  }, []);

  // ---- Load conversations the user participates in ----
  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Conversations where I am a participant
    const { data: myParts } = await supabase
      .from('internal_chat_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', user.id);
    const convIds = (myParts || []).map((p: any) => p.conversation_id);
    if (convIds.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }
    const { data: convs } = await supabase
      .from('internal_chat_conversations')
      .select('*')
      .in('id', convIds)
      .order('last_message_at', { ascending: false });

    const { data: allParts } = await supabase
      .from('internal_chat_participants')
      .select('conversation_id, user_id, last_read_at, role')
      .in('conversation_id', convIds);

    // Last message per conv (one round trip)
    const { data: lastMsgs } = await supabase
      .from('internal_chat_messages')
      .select('id, conversation_id, sender_id, body, created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
      .limit(1000);

    const lastByConv = new Map<string, any>();
    for (const m of lastMsgs || []) {
      if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);
    }

    const myReadByConv = new Map(
      (myParts || []).map((p: any) => [p.conversation_id, p.last_read_at as string | null]),
    );

    // Unread counts (rough: messages after my last_read_at, not sent by me)
    const unreadByConv = new Map<string, number>();
    for (const m of lastMsgs || []) {
      const lastRead = myReadByConv.get(m.conversation_id);
      if (m.sender_id === user.id) continue;
      if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
        unreadByConv.set(m.conversation_id, (unreadByConv.get(m.conversation_id) || 0) + 1);
      }
    }

    const merged: ChatConversation[] = (convs || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      kind: c.kind,
      created_by: c.created_by,
      last_message_at: c.last_message_at,
      participants: (allParts || []).filter((p: any) => p.conversation_id === c.id),
      lastMessage: lastByConv.get(c.id) || null,
      unreadCount: unreadByConv.get(c.id) || 0,
    }));
    setConversations(merged);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ---- Realtime: new messages -> toast + refresh list ----
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('internal-chat-' + user.id)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'internal_chat_messages' },
        async (payload) => {
          const msg: any = payload.new;
          if (msg.sender_id === user.id) {
            loadConversations();
            return;
          }
          // Only notify if I'm a participant
          const { data: amPart } = await supabase
            .from('internal_chat_participants')
            .select('conversation_id')
            .eq('conversation_id', msg.conversation_id)
            .eq('user_id', user.id)
            .maybeSingle();
          if (!amPart) return;
          const sender = userMapRef.current.get(msg.sender_id);
          toast.message(`💬 ${sender?.name || 'New message'}`, {
            description: String(msg.body || '').slice(0, 120),
            action: msg.requires_acknowledgement
              ? { label: 'Open', onClick: () => window.dispatchEvent(new CustomEvent('open-internal-chat', { detail: { conversationId: msg.conversation_id } })) }
              : undefined,
          });
          loadConversations();
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'internal_chat_participants' },
        () => loadConversations(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadConversations]);

  // ---- Mutations ----
  const startDirect = useCallback(
    async (otherUserId: string): Promise<string | null> => {
      if (!user) return null;
      // Reuse an existing direct conversation if one exists between exactly the two
      const existing = conversations.find(
        (c) =>
          c.kind === 'direct' &&
          c.participants.length === 2 &&
          c.participants.some((p) => p.user_id === otherUserId) &&
          c.participants.some((p) => p.user_id === user.id),
      );
      if (existing) return existing.id;

      const { data: conv, error } = await supabase
        .from('internal_chat_conversations')
        .insert({ kind: 'direct', created_by: user.id })
        .select()
        .single();
      if (error || !conv) {
        toast.error('Could not start chat: ' + (error?.message || 'unknown'));
        return null;
      }
      await supabase.from('internal_chat_participants').insert([
        { conversation_id: conv.id, user_id: user.id, role: 'sender' },
        { conversation_id: conv.id, user_id: otherUserId, role: 'recipient' },
      ]);
      await loadConversations();
      return conv.id;
    },
    [user, conversations, loadConversations],
  );

  const startGroupOrBroadcast = useCallback(
    async (kind: 'group' | 'broadcast', title: string, userIds: string[]): Promise<string | null> => {
      if (!user) return null;
      const recipients = userIds.filter((id) => id !== user.id);
      if (recipients.length === 0) {
        toast.error('Pick at least one recipient');
        return null;
      }
      const { data: conv, error } = await supabase
        .from('internal_chat_conversations')
        .insert({ kind, title: title || (kind === 'broadcast' ? 'Broadcast' : 'Group chat'), created_by: user.id })
        .select()
        .single();
      if (error || !conv) {
        toast.error('Could not create: ' + (error?.message || 'unknown'));
        return null;
      }
      const parts = [
        { conversation_id: conv.id, user_id: user.id, role: 'sender' },
        ...recipients.map((id) => ({ conversation_id: conv.id, user_id: id, role: 'recipient' as const })),
      ];
      await supabase.from('internal_chat_participants').insert(parts);
      await loadConversations();
      return conv.id;
    },
    [user, loadConversations],
  );

  const sendMessage = useCallback(
    async (conversationId: string, body: string, requiresAck: boolean) => {
      if (!user) return;
      const { error } = await supabase.from('internal_chat_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body,
        requires_acknowledgement: requiresAck,
      });
      if (error) toast.error('Send failed: ' + error.message);
    },
    [user],
  );

  const markRead = useCallback(
    async (conversationId: string) => {
      if (!user) return;
      await supabase
        .from('internal_chat_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
      loadConversations();
    },
    [user, loadConversations],
  );

  const acknowledge = useCallback(
    async (messageId: string) => {
      if (!user) return;
      const { error } = await supabase
        .from('internal_chat_acknowledgements')
        .insert({ message_id: messageId, user_id: user.id });
      if (error && !String(error.message).includes('duplicate')) {
        toast.error('Acknowledge failed: ' + error.message);
      }
    },
    [user],
  );

  const totalUnread = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
    [conversations],
  );

  return {
    users,
    userMap: userMapRef.current,
    conversations,
    loading,
    totalUnread,
    startDirect,
    startGroupOrBroadcast,
    sendMessage,
    markRead,
    acknowledge,
    refresh: loadConversations,
  };
}

export function useConversationMessages(conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    const { data: msgs } = await supabase
      .from('internal_chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    const msgIds = (msgs || []).map((m: any) => m.id);
    let acks: any[] = [];
    if (msgIds.length) {
      const { data } = await supabase
        .from('internal_chat_acknowledgements')
        .select('*')
        .in('message_id', msgIds);
      acks = data || [];
    }
    setMessages(
      (msgs || []).map((m: any) => ({
        ...m,
        acknowledgements: acks.filter((a) => a.message_id === m.id),
      })),
    );
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!conversationId || !user) return;
    const channel = supabase
      .channel('conv-' + conversationId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internal_chat_messages', filter: `conversation_id=eq.${conversationId}` },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'internal_chat_acknowledgements' },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, load]);

  return { messages, loading, reload: load };
}
