
INSERT INTO public.sales_consultants (user_id, name, type, region, is_active)
SELECT
  p.id,
  p.first_name || ' ' || p.last_name,
  'internal',
  'All',
  true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.sales_consultants sc WHERE sc.user_id = p.id
);

-- Re-create the auto-create trigger (in case it was also rolled back)
CREATE OR REPLACE FUNCTION public.auto_create_sales_consultant()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.sales_consultants (user_id, name, type, region, is_active)
  VALUES (NEW.id, NEW.first_name || ' ' || NEW.last_name, 'internal', 'All', true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_auto_create_sales_consultant ON public.profiles;
CREATE TRIGGER trg_auto_create_sales_consultant
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_sales_consultant();
