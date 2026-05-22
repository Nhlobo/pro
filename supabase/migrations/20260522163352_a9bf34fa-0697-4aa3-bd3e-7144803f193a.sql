REVOKE EXECUTE ON FUNCTION public.get_internal_chat_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_internal_chat_users() TO authenticated;