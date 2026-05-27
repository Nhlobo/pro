UPDATE public.aod_documents
SET total_contract_value = 3799934,
    original_contract_value = COALESCE(original_contract_value, 3799934),
    total_reports_agreed = 231,
    payments_made = 1350000,
    reports_released = 0,
    payment_status = 'pending',
    linked_appointment_ids = (
      SELECT array_agg(id)
      FROM public.appointments
      WHERE referring_attorney_id = 'e536238a-8cf7-4b27-8d37-6f2e3603106a'
        AND deleted_at IS NULL
    ),
    notes = COALESCE(notes,'') || E'\n-- Consolidated 2026-05-27: single master AOD. 231 assessments performed. Reports taken out tracked via aod_payments.reports_taken_out --',
    updated_at = now()
WHERE id = 'e848fff9-1d49-45e2-adfd-7d432207c42b';

DELETE FROM public.aod_documents
WHERE referring_attorney_id = 'e536238a-8cf7-4b27-8d37-6f2e3603106a'
  AND id <> 'e848fff9-1d49-45e2-adfd-7d432207c42b';
