-- Enable realtime for claimants table and ensure full row data is available
DO $$
BEGIN
  -- Set replica identity to full (idempotent-safe)
  BEGIN
    EXECUTE 'ALTER TABLE public.claimants REPLICA IDENTITY FULL';
  EXCEPTION WHEN others THEN
    NULL;
  END;

  -- Add table to supabase_realtime publication (ignore if already added)
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.claimants';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  WHEN others THEN
    NULL;
  END;
END $$;