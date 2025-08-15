-- First, create user profiles table for authentication
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  law_firm_id UUID REFERENCES public.law_firms(id),
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies - users can only see their own profile
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.email
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create security definer function to get current user's law firm
CREATE OR REPLACE FUNCTION public.get_current_user_law_firm()
RETURNS UUID AS $$
  SELECT law_firm_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Update claimants RLS policies to be secure
DROP POLICY IF EXISTS "Public can select claimants" ON public.claimants;
DROP POLICY IF EXISTS "Public can insert claimants" ON public.claimants;
DROP POLICY IF EXISTS "Public can update claimants" ON public.claimants;
DROP POLICY IF EXISTS "Public can delete claimants" ON public.claimants;

-- New secure claimants policies
CREATE POLICY "Users can view claimants from their law firm" 
ON public.claimants 
FOR SELECT 
TO authenticated
USING (law_firm_id = public.get_current_user_law_firm());

CREATE POLICY "Users can create claimants for their law firm" 
ON public.claimants 
FOR INSERT 
TO authenticated
WITH CHECK (law_firm_id = public.get_current_user_law_firm());

CREATE POLICY "Users can update claimants from their law firm" 
ON public.claimants 
FOR UPDATE 
TO authenticated
USING (law_firm_id = public.get_current_user_law_firm())
WITH CHECK (law_firm_id = public.get_current_user_law_firm());

CREATE POLICY "Users can delete claimants from their law firm" 
ON public.claimants 
FOR DELETE 
TO authenticated
USING (law_firm_id = public.get_current_user_law_firm());

-- Update law_firms RLS policies to be secure
DROP POLICY IF EXISTS "Public can select law firms" ON public.law_firms;
DROP POLICY IF EXISTS "Public can insert law firms" ON public.law_firms;
DROP POLICY IF EXISTS "Public can update law firms" ON public.law_firms;
DROP POLICY IF EXISTS "Public can delete law firms" ON public.law_firms;

-- New secure law_firms policies
CREATE POLICY "Users can view their own law firm" 
ON public.law_firms 
FOR SELECT 
TO authenticated
USING (id = public.get_current_user_law_firm());

CREATE POLICY "Admins can manage law firms" 
ON public.law_firms 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Add foreign key constraint to claimants table for law_firm_id
ALTER TABLE public.claimants 
ADD CONSTRAINT fk_claimants_law_firm 
FOREIGN KEY (law_firm_id) REFERENCES public.law_firms(id) ON DELETE RESTRICT;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();