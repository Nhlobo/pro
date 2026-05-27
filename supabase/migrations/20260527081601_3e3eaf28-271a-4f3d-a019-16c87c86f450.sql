DELETE FROM public.aod_payments WHERE aod_document_id = 'e848fff9-1d49-45e2-adfd-7d432207c42b';

INSERT INTO public.aod_payments (aod_document_id, payment_date, payment_amount, payment_type, reports_taken_out, payment_notes) VALUES
('e848fff9-1d49-45e2-adfd-7d432207c42b', '2025-03-13', 400000, 'regular', 0, 'Payment received. Files/reports to be allocated manually.'),
('e848fff9-1d49-45e2-adfd-7d432207c42b', '2025-04-24', 200000, 'regular', 0, 'Payment received. Files/reports to be allocated manually.'),
('e848fff9-1d49-45e2-adfd-7d432207c42b', '2025-06-23', 100000, 'regular', 0, 'Payment received. Files/reports to be allocated manually.'),
('e848fff9-1d49-45e2-adfd-7d432207c42b', '2025-10-07', 250000, 'regular', 0, 'Payment received. Files/reports to be allocated manually.'),
('e848fff9-1d49-45e2-adfd-7d432207c42b', '2026-02-07', 400000, 'regular', 0, 'Payment received. Files/reports to be allocated manually.');

UPDATE public.aod_documents
SET total_contract_value = 3799934,
    original_contract_value = 3799934,
    payments_made = 1350000,
    deposit_amount = 0,
    total_reports_agreed = 219,
    reports_released = 0,
    payment_status = 'pending',
    last_payment_date = '2026-02-07',
    updated_at = now()
WHERE id = 'e848fff9-1d49-45e2-adfd-7d432207c42b';