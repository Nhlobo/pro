import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useInternalChat, useConversationMessages } from '@/hooks/useInternalChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { MessageSquare, ArrowLeft, Plus, Send, CheckCheck, Megaphone, Users, User, Minus, X, Maximize2 } from 'lucide-react';
import { GlassBackdrop } from '@/components/ui/glass-backdrop';
import { cn } from '@/lib/utils';

export const InternalChatWidget: React.FC = () => {
  const { user } = useAuth();
  const chat = useInternalChat();
  const [mode, setMode] = useState<'closed' | 'open' | 'minimized'>('closed');
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  // Allow other parts of the app to open a conversation
  useEffect(() => {
    const handler = (e: any) => {
      const id = e?.detail?.conversationId as string | undefined;
      setMode('open');
      if (id) setActiveConv(id);
    };
    window.addEventListener('open-internal-chat', handler as any);
    return () => window.removeEventListener('open-internal-chat', handler as any);
  }, []);

  if (!user) return null;

  const activeConvObj = chat.conversations.find((c) => c.id === activeConv) || null;
  const title = activeConvObj ? conversationTitle(activeConvObj, chat.userMap, user.id) : 'Team Chat';

  return (
    <>
      <GlassBackdrop show={mode === 'open'} onClick={() => setMode('minimized')} zIndex={40} />

      {/* Closed: floating action button */}
      {mode === 'closed' && (
        <Button
          size="icon"
          className="fixed bottom-5 right-5 z-50 h-11 w-11 rounded-full shadow-md"
          aria-label="Open team chat"
          onClick={() => setMode('open')}
        >
          <MessageSquare className="h-4.5 w-4.5" />
          {chat.totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full min-w-[18px] h-[18px] px-1 text-[10px] font-semibold flex items-center justify-center">
              {chat.totalUnread > 99 ? '99+' : chat.totalUnread}
            </span>
          )}
        </Button>
      )}

      {/* Minimized: compact floating bar */}
      {mode === 'minimized' && (
        <div className="fixed bottom-6 right-6 z-50 w-72 rounded-lg border bg-background shadow-lg flex items-center justify-between px-3 py-2 cursor-pointer"
          onClick={() => setMode('open')}
          role="button"
          aria-label="Restore team chat"
        >
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="h-4 w-4 shrink-1 text-muted-foreground" />
            <span className="text-sm font-medium truncate">{title}</span>
            {chat.totalUnread > 0 && (
              <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                {chat.totalUnread > 99 ? '99+' : chat.totalUnread}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setMode('open'); }} aria-label="Restore chat">
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setMode('closed'); setActiveConv(null); }} aria-label="Close chat">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Open: full floating panel */}
      {mode === 'open' && (
        <div className="fixed bottom-5 right-5 z-50 w-[92vw] sm:w-[340px] h-[460px] max-h-[75vh] rounded-xl border bg-background shadow-xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b flex items-center justify-between shrink-1 bg-background">
            <div className="flex items-center gap-2 min-w-1">
              {activeConv && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActiveConv(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <h2 className="text-base font-semibold truncate">{title}</h2>
            </div>
            <div className="flex items-center gap-1 shrink-1">
              {!activeConv && (
                <NewChatDialog
                  open={newOpen}
                  onOpenChange={setNewOpen}
                  users={chat.users.filter((u) => u.id !== user.id)}
                  onCreate={async (kind, title, ids) => {
                    let id: string | null = null;
                    if (kind === 'direct') id = await chat.startDirect(ids[0]);
                    else id = await chat.startGroupOrBroadcast(kind, title, ids);
                    if (id) {
                      setActiveConv(id);
                      setNewOpen(false);
                    }
                  }}
                />
              )}
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMode('minimized')} aria-label="Minimize chat">
                <Minus className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setMode('closed'); setActiveConv(null); }} aria-label="Close chat">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Body */}
          {!activeConv ? (
            <ConversationList
              conversations={chat.conversations}
              userMap={chat.userMap}
              currentUserId={user.id}
              loading={chat.loading}
              onOpen={(id) => {
                setActiveConv(id);
                chat.markRead(id);
              }}
            />
          ) : (
            <ConversationView
              conversationId={activeConv}
              conversation={activeConvObj}
              userMap={chat.userMap}
              currentUserId={user.id}
              onSend={(body, requiresAck) => chat.sendMessage(activeConv, body, requiresAck)}
              onAck={(id) => chat.acknowledge(id)}
              markRead={() => chat.markRead(activeConv)}
            />
          )}
        </div>
      )}
    </>
  );
};

function conversationTitle(c: any, userMap: Map<string, any>, currentUserId: string): string {
  if (c.title) return c.title;
  if (c.kind === 'direct') {
    const other = c.participants.find((p: any) => p.user_id !== currentUserId);
    return other ? (userMap.get(other.user_id)?.name || 'Direct chat') : 'Direct chat';
  }
  if (c.kind === 'broadcast') return 'Broadcast';
  return 'Group chat';
}

const ConversationList: React.FC<{
  conversations: any[];
  userMap: Map<string, any>;
  currentUserId: string;
  loading: boolean;
  onOpen: (id: string) => void;
}> = ({ conversations, userMap, currentUserId, loading, onOpen }) => {
  return (
    <ScrollArea className="flex-1">
      {loading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
      {!loading && conversations.length === 0 && (
        <p className="p-6 text-sm text-muted-foreground text-center">
          No conversations yet. Start a new chat with the + button above.
        </p>
      )}
      <ul className="divide-y">
        {conversations.map((c) => {
          const title = conversationTitle(c, userMap, currentUserId);
          const subtitle = c.lastMessage?.body || 'No messages yet';
          const Icon = c.kind === 'broadcast' ? Megaphone : c.kind === 'group' ? Users : User;
          return (
            <li key={c.id}>
              <button
                onClick={() => onOpen(c.id)}
                className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-start gap-3"
              >
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">{title}</p>
                    {c.unreadCount > 0 && (
                      <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                        {c.unreadCount}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
};

const ConversationView: React.FC<{
  conversationId: string;
  conversation: any;
  userMap: Map<string, any>;
  currentUserId: string;
  onSend: (body: string, requiresAck: boolean) => Promise<void> | void;
  onAck: (msgId: string) => void;
  markRead: () => void;
}> = ({ conversationId, conversation, userMap, currentUserId, onSend, onAck, markRead }) => {
  const { messages, loading } = useConversationMessages(conversationId);
  const [body, setBody] = useState('');
  const [requireAck, setRequireAck] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (messages.length) markRead();
  }, [messages.length]); // eslint-disable-line

  const submit = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    await onSend(text, requireAck);
    setBody('');
    setRequireAck(false);
    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-1">
        <ScrollArea className="flex-1 px-3 py-2">
          <div className="space-y-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(
                  'flex flex-col gap-1',
                  i % 2 === 0 ? 'items-end' : 'items-start',
                )}
              >
                {i % 2 !== 0 && (
                  <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                )}
                <div
                  className={cn(
                    'h-10 rounded-2xl animate-pulse',
                    i % 2 === 1 ? 'bg-muted w-3/4' : 'bg-primary/20 w-2/3',
                  )}
                />
                <div className="h-2.5 w-12 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="border-t p-3 space-y-2 opacity-50">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-muted animate-pulse" />
            <div className="h-3 w-32 rounded bg-muted animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 flex-1 rounded bg-muted animate-pulse" />
            <div className="h-10 w-10 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <ScrollArea className="flex-1 px-3 py-2">
        <ul className="space-y-3">
          {messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            const sender = userMap.get(m.sender_id);
            const ackedByMe = m.acknowledgements.some((a) => a.user_id === currentUserId);
            return (
              <li key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                {!mine && (
                  <span className="text-[11px] text-muted-foreground mb-0.5 px-1">
                    {sender?.name || 'User'}
                  </span>
                )}
                <div
                  className={cn(
                    'rounded-2xl px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap break-words',
                    mine ? 'bg-primary text-primary-foreground' : 'bg-muted',
                  )}
                >
                  {m.body}
                </div>
                <div className="flex items-center gap-2 mt-1 px-1">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleString('en-ZA', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                  {m.requires_acknowledgement && (
                    <>
                      {mine ? (
                        <Badge variant="outline" className="h-4 px-1 text-[10px] gap-1">
                          <CheckCheck className="h-3 w-3" />
                          {m.acknowledgements.length} ack
                        </Badge>
                      ) : ackedByMe ? (
                        <Badge variant="secondary" className="h-4 px-1 text-[10px] gap-1">
                          <CheckCheck className="h-3 w-3" /> Acknowledged
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[11px] px-2"
                          onClick={() => onAck(m.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
          <div ref={endRef} />
        </ul>
      </ScrollArea>
      <div className="border-t p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="require-ack"
            checked={requireAck}
            onCheckedChange={(v) => setRequireAck(Boolean(v))}
          />
          <Label htmlFor="require-ack" className="text-xs cursor-pointer">
            Require acknowledgement
          </Label>
        </div>
        <div className="flex gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Type a message…"
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
          />
          <Button onClick={submit} disabled={sending || !body.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const NewChatDialog: React.FC<{
  open: boolean;
  onOpenChange: (o: boolean) => void;
  users: { id: string; name: string; email: string | null; role: string | null; position?: string | null }[];
  onCreate: (kind: 'direct' | 'group' | 'broadcast', title: string, ids: string[]) => Promise<void>;
}> = ({ open, onOpenChange, users, onCreate }) => {
  const [kind, setKind] = useState<'direct' | 'group' | 'broadcast'>('direct');
  const [title, setTitle] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.position || '').toLowerCase().includes(q),
    );
  }, [users, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (kind === 'direct') {
        next.clear();
        next.add(id);
      } else {
        next.has(id) ? next.delete(id) : next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map((u) => u.id)));
  const clear = () => setSelected(new Set());

  const submit = async () => {
    if (selected.size === 0) return;
    await onCreate(kind, title, Array.from(selected));
    setTitle('');
    setSelected(new Set());
    setSearch('');
    setKind('direct');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="New chat">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New chat</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Chat type">
          {(['direct', 'group', 'broadcast'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k);
                setSelected(new Set());
              }}
              className={cn(
                'flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer text-sm capitalize transition-colors hover:bg-muted/50',
                kind === k && 'border-primary bg-primary/5',
              )}
            >
              {k === 'direct' ? <User className="h-4 w-4" /> : k === 'group' ? <Users className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
              {k}
            </button>
          ))}
        </div>

        {kind !== 'direct' && (
          <Input
            placeholder={kind === 'broadcast' ? 'Broadcast title (e.g. Friday standup)' : 'Group name'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        )}

        <Input
          placeholder="Search by profile name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {kind !== 'direct' && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{selected.size} selected</span>
            <div className="flex gap-2">
              <button className="underline" onClick={selectAll}>Select all</button>
              <button className="underline" onClick={clear}>Clear</button>
            </div>
          </div>
        )}

        <ScrollArea className="h-60 border rounded-md">
          <ul className="divide-y">
            {filtered.map((u) => {
              const checked = selected.has(u.id);
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => toggle(u.id)}
                    className={cn(
                      'w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-muted/50',
                      checked && 'bg-primary/5',
                    )}
                  >
                    {kind === 'direct' ? (
                      <span
                        className={cn(
                          'h-4 w-4 rounded-full border border-primary flex items-center justify-center',
                          checked && 'bg-primary',
                        )}
                      >
                        {checked && <span className="h-2 w-2 rounded-full bg-primary-foreground" />}
                      </span>
                    ) : (
                      <Checkbox checked={checked} className="pointer-events-none" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.position || u.role || '—'}{u.email ? ` · ${u.email}` : ''}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="p-4 text-sm text-muted-foreground text-center">No matching users.</li>
            )}
          </ul>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={selected.size === 0}>
            {kind === 'broadcast' ? 'Create broadcast' : kind === 'group' ? 'Create group' : 'Start chat'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InternalChatWidget;
