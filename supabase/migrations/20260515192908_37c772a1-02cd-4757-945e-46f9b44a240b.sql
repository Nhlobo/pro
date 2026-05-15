
CREATE TABLE IF NOT EXISTS public.sa_districts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  province TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (province, name)
);

CREATE INDEX IF NOT EXISTS idx_sa_districts_province ON public.sa_districts(province) WHERE is_active;

ALTER TABLE public.sa_districts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read districts"
  ON public.sa_districts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert districts"
  ON public.sa_districts FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update districts"
  ON public.sa_districts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete districts"
  ON public.sa_districts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_sa_districts_updated_at
  BEFORE UPDATE ON public.sa_districts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.sa_districts (province, name, sort_order) VALUES
  ('Gauteng','Pretoria',1),('Gauteng','Johannesburg',2),('Gauteng','Sandton',3),('Gauteng','Midrand',4),('Gauteng','Centurion',5),('Gauteng','Soweto',6),('Gauteng','Roodepoort',7),('Gauteng','Vereeniging',8),
  ('Western Cape','Cape Town',1),('Western Cape','Bellville',2),('Western Cape','Paarl',3),('Western Cape','Stellenbosch',4),('Western Cape','George',5),('Western Cape','Worcester',6),
  ('KwaZulu-Natal','Durban',1),('KwaZulu-Natal','Pietermaritzburg',2),('KwaZulu-Natal','Umhlanga',3),('KwaZulu-Natal','Richards Bay',4),('KwaZulu-Natal','Newcastle',5),
  ('Eastern Cape','Gqeberha',1),('Eastern Cape','East London',2),('Eastern Cape','Mthatha',3),('Eastern Cape','Uitenhage',4),
  ('Free State','Bloemfontein',1),('Free State','Welkom',2),('Free State','Bethlehem',3),
  ('Limpopo','Polokwane',1),('Limpopo','Tzaneen',2),('Limpopo','Mokopane',3),
  ('Mpumalanga','Nelspruit',1),('Mpumalanga','Witbank',2),('Mpumalanga','Secunda',3),
  ('North West','Mahikeng',1),('North West','Rustenburg',2),('North West','Klerksdorp',3),
  ('Northern Cape','Kimberley',1),('Northern Cape','Upington',2)
ON CONFLICT (province, name) DO NOTHING;
