
-- Add the missing sales_consultant_id column
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS sales_consultant_id UUID REFERENCES public.sales_consultants(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_appointments_sales_consultant ON public.appointments(sales_consultant_id);
