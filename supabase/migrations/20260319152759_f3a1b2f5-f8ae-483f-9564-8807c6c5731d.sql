-- Fix any existing stuck "pending" emails to show as "sent" (they were already auto-sent but status wasn't updated)
UPDATE public.email_queue 
SET status = 'sent', sent_at = COALESCE(sent_at, created_at)
WHERE status = 'pending' 
AND created_at < NOW() - INTERVAL '2 minutes';