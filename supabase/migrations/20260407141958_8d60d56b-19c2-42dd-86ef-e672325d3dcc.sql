
-- Sales consultants table
CREATE TABLE public.sales_consultants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'internal' CHECK (type IN ('internal', 'external')),
  region TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Monthly performance tracking
CREATE TABLE public.monthly_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultant_id UUID REFERENCES public.sales_consultants(id) ON DELETE CASCADE NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year >= 2020),
  raf_appts INTEGER NOT NULL DEFAULT 0,
  medneg_appts INTEGER NOT NULL DEFAULT 0,
  total_appts INTEGER NOT NULL DEFAULT 0,
  raf_incentive_earned NUMERIC(10,2) DEFAULT 0,
  medneg_incentive_earned NUMERIC(10,2) DEFAULT 0,
  incentive_earned NUMERIC(10,2) DEFAULT 0,
  target_met BOOLEAN DEFAULT false,
  warning_issued BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(consultant_id, month, year)
);

-- Strikes table
CREATE TABLE public.consultant_strikes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultant_id UUID REFERENCES public.sales_consultants(id) ON DELETE CASCADE NOT NULL,
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('verbal', 'written', 'dismissal')),
  reason TEXT,
  expired BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Incentive tiers (admin-editable)
CREATE TABLE public.incentive_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier_type TEXT NOT NULL CHECK (tier_type IN ('internal', 'external')),
  min_appointments INTEGER NOT NULL,
  max_appointments INTEGER,
  raf_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  medneg_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_consultants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultant_strikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentive_tiers ENABLE ROW LEVEL SECURITY;

-- RLS policies for sales_consultants
CREATE POLICY "Admins and employees can view all consultants" ON public.sales_consultants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage consultants" ON public.sales_consultants
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee')
  );

-- RLS policies for monthly_performance
CREATE POLICY "Users can view own performance" ON public.monthly_performance
  FOR SELECT TO authenticated USING (
    consultant_id IN (SELECT id FROM public.sales_consultants WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
  );

CREATE POLICY "Admins can manage performance" ON public.monthly_performance
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee')
  );

-- RLS policies for consultant_strikes
CREATE POLICY "Users can view own strikes" ON public.consultant_strikes
  FOR SELECT TO authenticated USING (
    consultant_id IN (SELECT id FROM public.sales_consultants WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
  );

CREATE POLICY "Admins can manage strikes" ON public.consultant_strikes
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee')
  );

-- RLS policies for incentive_tiers
CREATE POLICY "Anyone authenticated can view tiers" ON public.incentive_tiers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage tiers" ON public.incentive_tiers
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
  );

-- Seed default internal incentive tiers
INSERT INTO public.incentive_tiers (tier_type, min_appointments, max_appointments, raf_amount, medneg_amount, label) VALUES
  ('internal', 5, 6, 300, 200, 'Bronze'),
  ('internal', 7, 9, 480, 320, 'Silver'),
  ('internal', 10, 14, 900, 600, 'Gold'),
  ('internal', 15, NULL, 1500, 1000, 'Platinum');

-- Seed default external incentive tiers
INSERT INTO public.incentive_tiers (tier_type, min_appointments, max_appointments, raf_amount, medneg_amount, label) VALUES
  ('external', 1, 4, 350, 500, 'Starter'),
  ('external', 5, 9, 500, 800, 'Growth'),
  ('external', 10, 14, 650, 1000, 'Pro'),
  ('external', 15, NULL, 800, 1200, 'Elite');
