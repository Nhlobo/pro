-- Fix the remaining two functions without proper search_path

CREATE OR REPLACE FUNCTION public.is_within_edit_window(created_date timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN created_date > (now() - INTERVAL '30 days');
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_appointment_request_rating()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  -- Calculate response time if first_response_at is set
  IF NEW.first_response_at IS NOT NULL AND OLD.first_response_at IS NULL THEN
    SELECT 
      EXTRACT(EPOCH FROM (NEW.first_response_at - ar.created_at))/3600,
      ar.created_at
    INTO NEW.response_time_hours, NEW.created_at
    FROM public.appointment_requests ar
    WHERE ar.id = NEW.appointment_request_id;
    
    -- Auto-calculate rating based on response time
    NEW.response_rating = public.calculate_response_rating(NEW.response_time_hours);
  END IF;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;