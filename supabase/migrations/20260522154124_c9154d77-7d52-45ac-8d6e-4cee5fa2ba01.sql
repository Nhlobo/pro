
-- ============================================================
-- Internal chat helper: is the current user an internal user?
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_internal_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','employee','sales_consultant','finance','director')
  );
$$;

-- ============================================================
-- Conversations
-- ============================================================
CREATE TABLE public.internal_chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  kind text NOT NULL DEFAULT 'direct' CHECK (kind IN ('direct','group','broadcast')),
  created_by uuid NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_conv_last_msg ON public.internal_chat_conversations(last_message_at DESC);

-- ============================================================
-- Participants
-- ============================================================
CREATE TABLE public.internal_chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.internal_chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'recipient' CHECK (role IN ('sender','recipient')),
  last_read_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX idx_chat_part_user ON public.internal_chat_participants(user_id);
CREATE INDEX idx_chat_part_conv ON public.internal_chat_participants(conversation_id);

-- Security definer to avoid RLS recursion when checking participation
CREATE OR REPLACE FUNCTION public.is_chat_participant(_conv_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_chat_participants
    WHERE conversation_id = _conv_id AND user_id = _user_id
  );
$$;

-- ============================================================
-- Messages
-- ============================================================
CREATE TABLE public.internal_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.internal_chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) <= 5000),
  requires_acknowledgement boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_chat_msg_conv ON public.internal_chat_messages(conversation_id, created_at DESC);

-- ============================================================
-- Acknowledgements
-- ============================================================
CREATE TABLE public.internal_chat_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.internal_chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX idx_chat_ack_msg ON public.internal_chat_acknowledgements(message_id);

-- ============================================================
-- Bump conversation.last_message_at on new message
-- ============================================================
CREATE OR REPLACE FUNCTION public.bump_chat_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.internal_chat_conversations
    SET last_message_at = NEW.created_at,
        updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bump_chat_conversation
AFTER INSERT ON public.internal_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.bump_chat_conversation_last_message();

-- updated_at triggers
CREATE TRIGGER trg_chat_conv_updated_at
BEFORE UPDATE ON public.internal_chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_chat_msg_updated_at
BEFORE UPDATE ON public.internal_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.internal_chat_conversations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_chat_participants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_chat_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_chat_acknowledgements ENABLE ROW LEVEL SECURITY;

-- Conversations
CREATE POLICY "chat_conv_select_participants_or_admin"
ON public.internal_chat_conversations FOR SELECT TO authenticated
USING (public.is_chat_participant(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "chat_conv_insert_internal_users"
ON public.internal_chat_conversations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by AND public.is_internal_user(auth.uid()));

CREATE POLICY "chat_conv_update_creator_or_admin"
ON public.internal_chat_conversations FOR UPDATE TO authenticated
USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "chat_conv_delete_creator_or_admin"
ON public.internal_chat_conversations FOR DELETE TO authenticated
USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- Participants
CREATE POLICY "chat_part_select_self_or_co_or_admin"
ON public.internal_chat_participants FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_chat_participant(conversation_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- Inserts only by internal users; either adding self, or by the conversation creator adding others.
CREATE POLICY "chat_part_insert_internal_users"
ON public.internal_chat_participants FOR INSERT TO authenticated
WITH CHECK (
  public.is_internal_user(auth.uid())
  AND (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.internal_chat_conversations c
      WHERE c.id = conversation_id AND c.created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "chat_part_update_self_or_admin"
ON public.internal_chat_participants FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "chat_part_delete_creator_or_self_or_admin"
ON public.internal_chat_participants FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.internal_chat_conversations c
    WHERE c.id = conversation_id AND c.created_by = auth.uid()
  )
);

-- Messages
CREATE POLICY "chat_msg_select_participants_or_admin"
ON public.internal_chat_messages FOR SELECT TO authenticated
USING (public.is_chat_participant(conversation_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "chat_msg_insert_participants"
ON public.internal_chat_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_internal_user(auth.uid())
  AND public.is_chat_participant(conversation_id, auth.uid())
);

CREATE POLICY "chat_msg_update_sender_or_admin"
ON public.internal_chat_messages FOR UPDATE TO authenticated
USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "chat_msg_delete_sender_or_admin"
ON public.internal_chat_messages FOR DELETE TO authenticated
USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Acknowledgements
CREATE POLICY "chat_ack_select_participants_or_admin"
ON public.internal_chat_acknowledgements FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.internal_chat_messages m
    WHERE m.id = message_id
      AND (public.is_chat_participant(m.conversation_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "chat_ack_insert_self_participant"
ON public.internal_chat_acknowledgements FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.internal_chat_messages m
    WHERE m.id = message_id
      AND public.is_chat_participant(m.conversation_id, auth.uid())
  )
);

CREATE POLICY "chat_ack_delete_self_or_admin"
ON public.internal_chat_acknowledgements FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Realtime
-- ============================================================
ALTER TABLE public.internal_chat_conversations    REPLICA IDENTITY FULL;
ALTER TABLE public.internal_chat_participants     REPLICA IDENTITY FULL;
ALTER TABLE public.internal_chat_messages         REPLICA IDENTITY FULL;
ALTER TABLE public.internal_chat_acknowledgements REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_chat_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_chat_acknowledgements;
