-- Enable pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create function to automatically delete old documents
CREATE OR REPLACE FUNCTION public.cleanup_old_documents()
RETURNS TABLE(deleted_count integer, document_type text, deletion_reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    expert_report_count integer := 0;
    other_report_count integer := 0;
    doc_record RECORD;
BEGIN
    -- Log the cleanup start
    INSERT INTO public.document_cleanup_log (cleanup_date, status, details)
    VALUES (now(), 'started', 'Automatic document cleanup started');

    -- Delete expert reports older than 3 years
    FOR doc_record IN 
        SELECT id, file_path, document_type, upload_date
        FROM public.documents 
        WHERE document_type = 'expert_report_sent' 
        AND upload_date < (now() - interval '3 years')
    LOOP
        -- Delete from storage
        PERFORM storage.objects 
        WHERE bucket_id = 'attorney-documents' 
        AND name = doc_record.file_path;
        
        -- Delete from database
        DELETE FROM public.documents WHERE id = doc_record.id;
        
        expert_report_count := expert_report_count + 1;
    END LOOP;

    -- Delete other reports older than 4 years
    FOR doc_record IN 
        SELECT id, file_path, document_type, upload_date
        FROM public.documents 
        WHERE document_type IN ('instruction_letter', 'claimant_id_copy', 'medical_records')
        AND upload_date < (now() - interval '4 years')
    LOOP
        -- Delete from storage
        PERFORM storage.objects 
        WHERE bucket_id = 'attorney-documents' 
        AND name = doc_record.file_path;
        
        -- Delete from database
        DELETE FROM public.documents WHERE id = doc_record.id;
        
        other_report_count := other_report_count + 1;
    END LOOP;

    -- Log the cleanup results
    INSERT INTO public.document_cleanup_log (cleanup_date, status, details)
    VALUES (
        now(), 
        'completed', 
        format('Deleted %s expert reports (3+ years old) and %s other documents (4+ years old)', 
               expert_report_count, other_report_count)
    );

    -- Return results
    IF expert_report_count > 0 THEN
        RETURN QUERY SELECT expert_report_count, 'expert_report_sent'::text, '3 years old'::text;
    END IF;
    
    IF other_report_count > 0 THEN
        RETURN QUERY SELECT other_report_count, 'other_documents'::text, '4 years old'::text;
    END IF;
    
    -- If no documents were deleted
    IF expert_report_count = 0 AND other_report_count = 0 THEN
        RETURN QUERY SELECT 0, 'none'::text, 'no old documents found'::text;
    END IF;
END;
$$;

-- Create a log table for tracking cleanup operations
CREATE TABLE IF NOT EXISTS public.document_cleanup_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cleanup_date timestamp with time zone NOT NULL DEFAULT now(),
    status text NOT NULL,
    details text,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on cleanup log table
ALTER TABLE public.document_cleanup_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for cleanup log (admin access only)
CREATE POLICY "Admins can view cleanup log" 
ON public.document_cleanup_log 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Schedule the cleanup function to run daily at 2 AM
SELECT cron.schedule(
    'daily-document-cleanup',
    '0 2 * * *',  -- Every day at 2 AM
    $$SELECT public.cleanup_old_documents();$$
);

-- Create a manual cleanup function for administrators
CREATE OR REPLACE FUNCTION public.manual_document_cleanup()
RETURNS TABLE(deleted_count integer, document_type text, deletion_reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;

    -- Run the cleanup function
    RETURN QUERY SELECT * FROM public.cleanup_old_documents();
END;
$$;

-- Create a function to view cleanup history
CREATE OR REPLACE FUNCTION public.get_cleanup_history(limit_count integer DEFAULT 10)
RETURNS TABLE(
    cleanup_date timestamp with time zone,
    status text,
    details text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        dcl.cleanup_date,
        dcl.status,
        dcl.details
    FROM public.document_cleanup_log dcl
    WHERE EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
    ORDER BY dcl.cleanup_date DESC
    LIMIT limit_count;
$$;