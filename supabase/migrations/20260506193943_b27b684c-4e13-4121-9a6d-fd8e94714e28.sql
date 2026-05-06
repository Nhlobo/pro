
-- Consolidate Mokhari duplicate AODs into the earliest one and link all 6 appointments
DO $$
DECLARE
  v_attorney UUID := 'db1c8a5e-4973-482e-939c-ed60beca40f1';
  v_master UUID;
  v_appt_ids UUID[];
  v_total NUMERIC;
  v_discount NUMERIC;
  v_paid NUMERIC;
  v_count INT;
  v_full INT;
BEGIN
  SELECT array_agg(id ORDER BY appointment_date) INTO v_appt_ids
  FROM appointments WHERE referring_attorney_id = v_attorney AND deleted_at IS NULL;

  SELECT COALESCE(SUM(service_fee),0),
         COALESCE(SUM(discount_amount),0),
         COALESCE(SUM(CASE WHEN payment_status='full_payment' THEN service_fee ELSE LEAST(deposit_amount, service_fee) END),0),
         COUNT(*),
         COUNT(*) FILTER (WHERE payment_status='full_payment')
  INTO v_total, v_discount, v_paid, v_count, v_full
  FROM appointments WHERE referring_attorney_id = v_attorney AND deleted_at IS NULL;

  SELECT id INTO v_master FROM aod_documents
  WHERE referring_attorney_id = v_attorney
  ORDER BY created_at ASC LIMIT 1;

  -- Delete duplicates
  DELETE FROM aod_documents
  WHERE referring_attorney_id = v_attorney AND id <> v_master;

  -- Update master
  UPDATE aod_documents SET
    linked_appointment_ids = v_appt_ids,
    total_contract_value = v_total,
    discount_amount = v_discount,
    deposit_amount = v_paid,
    payments_made = GREATEST(0, v_paid - v_paid),
    total_reports_agreed = v_count,
    reports_released = v_full,
    payment_status = CASE WHEN v_paid >= v_total AND v_total > 0 THEN 'paid'
                          WHEN v_paid > 0 THEN 'partial' ELSE 'pending' END,
    last_payment_date = (SELECT MAX(payment_date) FROM appointments
                         WHERE referring_attorney_id = v_attorney AND deleted_at IS NULL),
    updated_at = now()
  WHERE id = v_master;
END $$;
