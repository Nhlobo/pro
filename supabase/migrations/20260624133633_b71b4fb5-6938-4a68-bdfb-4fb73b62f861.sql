
CREATE INDEX IF NOT EXISTS idx_expert_reports_status ON public.expert_reports (report_status);
CREATE INDEX IF NOT EXISTS idx_expert_reports_status_created ON public.expert_reports (report_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expert_reports_appointment ON public.expert_reports (appointment_id);

CREATE INDEX IF NOT EXISTS idx_aod_documents_attorney ON public.aod_documents (referring_attorney_id);
CREATE INDEX IF NOT EXISTS idx_aod_documents_created ON public.aod_documents (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_cat_created ON public.notifications (user_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_attorney_status ON public.appointments (referring_attorney_id, case_status);
CREATE INDEX IF NOT EXISTS idx_appointments_deleted_at ON public.appointments (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_claimant ON public.appointments (claimant_id);

CREATE INDEX IF NOT EXISTS idx_referring_attorneys_created ON public.referring_attorneys (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sta_linked_appointments_gin ON public.short_term_agreements USING GIN (linked_appointment_ids);
CREATE INDEX IF NOT EXISTS idx_sta_attorney ON public.short_term_agreements (referring_attorney_id);

CREATE INDEX IF NOT EXISTS idx_claimants_id ON public.claimants (id);

ANALYZE public.expert_reports;
ANALYZE public.aod_documents;
ANALYZE public.notifications;
ANALYZE public.appointments;
ANALYZE public.referring_attorneys;
ANALYZE public.short_term_agreements;
