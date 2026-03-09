-- Report versions table for tracking re-uploads
CREATE TABLE public.report_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_report_id uuid NOT NULL REFERENCES public.expert_reports(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  file_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  upload_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Report delivery tracking
CREATE TABLE public.report_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_report_id uuid NOT NULL REFERENCES public.expert_reports(id) ON DELETE CASCADE,
  delivered_to_attorney_id uuid REFERENCES public.referring_attorneys(id),
  delivery_method text NOT NULL DEFAULT 'email',
  delivered_at timestamp with time zone NOT NULL DEFAULT now(),
  delivered_by uuid REFERENCES auth.users(id),
  confirmed_receipt boolean NOT NULL DEFAULT false,
  confirmed_at timestamp with time zone,
  notes text
);

-- Report reviews
CREATE TABLE public.report_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_report_id uuid NOT NULL REFERENCES public.expert_reports(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id),
  review_status text NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.report_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_reviews ENABLE ROW LEVEL SECURITY;

-- RLS for report_versions
CREATE POLICY "System admins full access to report_versions"
  ON public.report_versions FOR ALL TO authenticated
  USING (is_system_admin()) WITH CHECK (is_system_admin());

CREATE POLICY "Admin and employees can manage report_versions"
  ON public.report_versions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'));

CREATE POLICY "Users can view report_versions for their law firm"
  ON public.report_versions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM expert_reports er
    JOIN appointments a ON a.id = er.appointment_id
    WHERE er.id = report_versions.expert_report_id
    AND a.referring_attorney_id = get_current_user_referring_attorney()
  ));

-- RLS for report_deliveries
CREATE POLICY "System admins full access to report_deliveries"
  ON public.report_deliveries FOR ALL TO authenticated
  USING (is_system_admin()) WITH CHECK (is_system_admin());

CREATE POLICY "Admin and employees can manage report_deliveries"
  ON public.report_deliveries FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'));

CREATE POLICY "Users can view deliveries for their law firm"
  ON public.report_deliveries FOR SELECT TO authenticated
  USING (delivered_to_attorney_id = get_current_user_referring_attorney());

-- RLS for report_reviews
CREATE POLICY "System admins full access to report_reviews"
  ON public.report_reviews FOR ALL TO authenticated
  USING (is_system_admin()) WITH CHECK (is_system_admin());

CREATE POLICY "Admin and employees can manage report_reviews"
  ON public.report_reviews FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'));

CREATE POLICY "Users can view reviews for their reports"
  ON public.report_reviews FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM expert_reports er
    JOIN appointments a ON a.id = er.appointment_id
    WHERE er.id = report_reviews.expert_report_id
    AND a.referring_attorney_id = get_current_user_referring_attorney()
  ));