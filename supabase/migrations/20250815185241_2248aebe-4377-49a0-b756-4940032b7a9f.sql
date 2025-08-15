-- Fix function search path security warning by updating the calculate_expert_performance function
CREATE OR REPLACE FUNCTION public.calculate_expert_performance()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only calculate if report is completed
  IF NEW.report_status = 'completed' AND NEW.report_submitted_date IS NOT NULL THEN
    -- Calculate days to complete
    IF NEW.payment_date IS NOT NULL THEN
      NEW.days_to_complete = EXTRACT(DAYS FROM (NEW.report_submitted_date - NEW.payment_date));
      
      -- Set performance based on days (7-30 days is the rule)
      IF NEW.days_to_complete <= 14 THEN
        NEW.expert_performance = 'good';
      ELSIF NEW.days_to_complete <= 25 THEN
        NEW.expert_performance = 'average';
      ELSE
        NEW.expert_performance = 'bad';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;