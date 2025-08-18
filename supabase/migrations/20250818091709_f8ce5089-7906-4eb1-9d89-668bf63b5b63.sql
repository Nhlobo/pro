-- Create leads table for tracking potential attorney clients
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  firm_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  address TEXT,
  province TEXT NOT NULL,
  lead_type TEXT NOT NULL CHECK (lead_type IN ('plaintiff_attorney', 'state_attorney', 'insurance_claimant_dept', 'prasa_matters', 'other')),
  practice_areas TEXT[],
  firm_size TEXT,
  notes TEXT,
  lead_status TEXT NOT NULL DEFAULT 'new' CHECK (lead_status IN ('new', 'contacted', 'interested', 'converted', 'not_interested', 'follow_up')),
  lead_source TEXT NOT NULL DEFAULT 'google_search' CHECK (lead_source IN ('google_search', 'referral', 'website', 'social_media', 'cold_call', 'other')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  assigned_to UUID REFERENCES auth.users(id),
  last_contact_date TIMESTAMP WITH TIME ZONE,
  next_follow_up_date TIMESTAMP WITH TIME ZONE,
  conversion_probability INTEGER CHECK (conversion_probability >= 0 AND conversion_probability <= 100),
  estimated_annual_value NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for leads
CREATE POLICY "Users can view leads from their law firm" 
ON public.leads 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.law_firm_id = (
      SELECT p2.law_firm_id 
      FROM public.profiles p2 
      WHERE p2.id = leads.created_by
    )
  )
);

CREATE POLICY "Users can create leads for their law firm" 
ON public.leads 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update leads from their law firm" 
ON public.leads 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.law_firm_id = (
      SELECT p2.law_firm_id 
      FROM public.profiles p2 
      WHERE p2.id = leads.created_by
    )
  )
);

CREATE POLICY "Users can delete leads from their law firm" 
ON public.leads 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.law_firm_id = (
      SELECT p2.law_firm_id 
      FROM public.profiles p2 
      WHERE p2.id = leads.created_by
    )
  )
);

-- Create lead search history table
CREATE TABLE public.lead_search_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  search_query TEXT NOT NULL,
  province TEXT NOT NULL,
  lead_type TEXT NOT NULL,
  results_found INTEGER NOT NULL DEFAULT 0,
  search_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Enable RLS for search history
ALTER TABLE public.lead_search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own search history" 
ON public.lead_search_history 
FOR SELECT 
USING (created_by = auth.uid());

CREATE POLICY "Users can create search history" 
ON public.lead_search_history 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

-- Create trigger for updating updated_at on leads
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_leads_province ON public.leads(province);
CREATE INDEX idx_leads_type ON public.leads(lead_type);
CREATE INDEX idx_leads_status ON public.leads(lead_status);
CREATE INDEX idx_leads_created_by ON public.leads(created_by);
CREATE INDEX idx_search_history_created_by ON public.lead_search_history(created_by);