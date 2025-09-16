-- Fix remaining functions with missing search_path for security

CREATE OR REPLACE FUNCTION public.calculate_response_rating(hours numeric)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path = 'public'
AS $function$
  SELECT CASE 
    WHEN hours <= 2 THEN 'excellent'
    WHEN hours <= 8 THEN 'good'
    WHEN hours <= 24 THEN 'average'
    WHEN hours <= 72 THEN 'slow'
    ELSE 'very_slow'
  END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_expert_performance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
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
$function$;