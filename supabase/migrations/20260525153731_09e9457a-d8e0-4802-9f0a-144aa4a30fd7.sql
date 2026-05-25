CREATE OR REPLACE FUNCTION public.create_internal_chat_conversation(
  _kind text,
  _title text DEFAULT NULL,
  _participant_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_user uuid := auth.uid();
  _recipients uuid[];
  _conversation_id uuid;
  _invalid_count integer;
BEGIN
  IF _current_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to start a chat';
  END IF;

  IF _kind NOT IN ('direct', 'group', 'broadcast') THEN
    RAISE EXCEPTION 'Invalid chat type';
  END IF;

  IF NOT public.is_internal_user(_current_user) THEN
    RAISE EXCEPTION 'Only internal staff users can start team chats';
  END IF;

  SELECT coalesce(array_agg(DISTINCT participant_id), ARRAY[]::uuid[])
  INTO _recipients
  FROM unnest(coalesce(_participant_ids, ARRAY[]::uuid[])) AS participant_id
  WHERE participant_id IS NOT NULL
    AND participant_id <> _current_user;

  IF coalesce(array_length(_recipients, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Pick at least one recipient';
  END IF;

  IF _kind = 'direct' AND coalesce(array_length(_recipients, 1), 0) <> 1 THEN
    RAISE EXCEPTION 'Direct chats require exactly one recipient';
  END IF;

  SELECT count(*)
  INTO _invalid_count
  FROM unnest(_recipients) AS recipient_id
  WHERE NOT public.is_internal_user(recipient_id);

  IF _invalid_count > 0 THEN
    RAISE EXCEPTION 'One or more selected recipients cannot use internal team chat';
  END IF;

  IF _kind = 'direct' THEN
    SELECT c.id
    INTO _conversation_id
    FROM public.internal_chat_conversations c
    JOIN public.internal_chat_participants p_self
      ON p_self.conversation_id = c.id
      AND p_self.user_id = _current_user
    JOIN public.internal_chat_participants p_other
      ON p_other.conversation_id = c.id
      AND p_other.user_id = _recipients[1]
    WHERE c.kind = 'direct'
      AND (
        SELECT count(*)
        FROM public.internal_chat_participants p_count
        WHERE p_count.conversation_id = c.id
      ) = 2
    ORDER BY c.last_message_at DESC
    LIMIT 1;

    IF _conversation_id IS NOT NULL THEN
      RETURN _conversation_id;
    END IF;
  END IF;

  INSERT INTO public.internal_chat_conversations (kind, title, created_by)
  VALUES (
    _kind,
    NULLIF(btrim(coalesce(_title, '')), ''),
    _current_user
  )
  RETURNING id INTO _conversation_id;

  INSERT INTO public.internal_chat_participants (conversation_id, user_id, role)
  VALUES (_conversation_id, _current_user, 'sender');

  INSERT INTO public.internal_chat_participants (conversation_id, user_id, role)
  SELECT _conversation_id, recipient_id, 'recipient'
  FROM unnest(_recipients) AS recipient_id;

  RETURN _conversation_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_internal_chat_conversation(text, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_internal_chat_conversation(text, text, uuid[]) TO authenticated;