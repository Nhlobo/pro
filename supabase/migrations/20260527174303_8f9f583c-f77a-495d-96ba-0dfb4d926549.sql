
CREATE OR REPLACE FUNCTION public.apply_aod_allocations(
  p_allocations jsonb,
  p_payment_date timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alloc jsonb;
  v_apt_id uuid;
  v_amount numeric;
  v_fee numeric;
  v_current_deposit numeric;
  v_new_deposit numeric;
  v_fully_paid boolean;
  v_new_status text;
  v_fully_paid_count int := 0;
  v_updated_count int := 0;
BEGIN
  IF p_allocations IS NULL OR jsonb_typeof(p_allocations) <> 'array' THEN
    RAISE EXCEPTION 'p_allocations must be a JSON array';
  END IF;

  FOR alloc IN SELECT * FROM jsonb_array_elements(p_allocations)
  LOOP
    v_apt_id := (alloc->>'appointment_id')::uuid;
    v_amount := COALESCE((alloc->>'amount')::numeric, 0);

    IF v_apt_id IS NULL OR v_amount <= 0 THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(service_fee,0), COALESCE(deposit_amount,0)
      INTO v_fee, v_current_deposit
    FROM public.appointments
    WHERE id = v_apt_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Appointment % not found', v_apt_id;
    END IF;

    v_new_deposit := v_current_deposit + v_amount;
    v_fully_paid := v_new_deposit >= v_fee;
    v_new_status := CASE WHEN v_fully_paid THEN 'full_payment' ELSE 'deposit' END;

    UPDATE public.appointments
       SET deposit_amount = v_new_deposit,
           payment_status = v_new_status,
           payment_date = p_payment_date,
           updated_at = now()
     WHERE id = v_apt_id;

    UPDATE public.expert_reports
       SET report_status = CASE WHEN v_fully_paid THEN 'taken_out' ELSE 'pending' END,
           payment_status = CASE WHEN v_fully_paid THEN 'paid' ELSE 'partial' END,
           payment_date = p_payment_date,
           updated_at = now()
     WHERE appointment_id = v_apt_id;

    v_updated_count := v_updated_count + 1;
    IF v_fully_paid THEN
      v_fully_paid_count := v_fully_paid_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'updated_count', v_updated_count,
    'fully_paid_count', v_fully_paid_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_aod_allocations(jsonb, timestamptz) TO authenticated, service_role;
