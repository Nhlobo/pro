
-- Migrate all data from Molebo Brain Attorneys to Kutlwano Associate
DO $$
DECLARE
  v_old_firm_id uuid := 'a93fbbae-765e-4a9d-92a4-678a7bb9fa5d'; -- Molebo Brain Attorneys
  v_new_firm_id uuid := 'f488f92f-2055-403a-970d-6386cee012d1'; -- Kutlwano Associate
BEGIN
  -- Temporarily disable triggers
  SET session_replication_role = replica;
  
  -- Update all appointments
  UPDATE appointments
  SET law_firm_id = v_new_firm_id,
      updated_at = now()
  WHERE law_firm_id = v_old_firm_id;
  
  -- Update all claimants
  UPDATE claimants
  SET law_firm_id = v_new_firm_id
  WHERE law_firm_id = v_old_firm_id;
  
  -- Update all appointment requests
  UPDATE appointment_requests
  SET law_firm_id = v_new_firm_id,
      updated_at = now()
  WHERE law_firm_id = v_old_firm_id;
  
  -- Update all attorneys
  UPDATE attorneys
  SET law_firm_id = v_new_firm_id,
      updated_at = now()
  WHERE law_firm_id = v_old_firm_id;
  
  -- Update all AOD documents
  UPDATE aod_documents
  SET law_firm_id = v_new_firm_id,
      updated_at = now()
  WHERE law_firm_id = v_old_firm_id;
  
  -- Update all case sources
  UPDATE case_sources
  SET law_firm_id = v_new_firm_id
  WHERE law_firm_id = v_old_firm_id;
  
  -- Update all pitch logs
  UPDATE pitch_logs
  SET law_firm_id = v_new_firm_id
  WHERE law_firm_id = v_old_firm_id;
  
  -- Update all appointment archives
  UPDATE appointment_archives
  SET law_firm_id = v_new_firm_id
  WHERE law_firm_id = v_old_firm_id;
  
  -- Update all assessment report archives
  UPDATE assessment_report_archives
  SET law_firm_id = v_new_firm_id
  WHERE law_firm_id = v_old_firm_id;
  
  -- Update all user profiles from old firm to new firm
  UPDATE profiles
  SET law_firm_id = v_new_firm_id,
      updated_at = now()
  WHERE law_firm_id = v_old_firm_id;
  
  -- Re-enable triggers
  SET session_replication_role = DEFAULT;
  
  -- Delete the old Molebo Brain Attorneys firm
  DELETE FROM law_firms WHERE id = v_old_firm_id;
  
END $$;
