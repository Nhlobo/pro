-- Create Kutlwano Associate law firm if it doesn't exist
DO $$
DECLARE
  v_kutlwano_id uuid;
BEGIN
  -- Check if Kutlwano Associate exists
  SELECT id INTO v_kutlwano_id
  FROM law_firms
  WHERE name = 'Kutlwano Associate';
  
  -- If it doesn't exist, create it
  IF v_kutlwano_id IS NULL THEN
    INSERT INTO law_firms (name, code, contact_person, email)
    VALUES ('Kutlwano Associate', 'KA202510', 'Mr. Boshomane', 'boshomane@kutlwanoassociate.com')
    RETURNING id INTO v_kutlwano_id;
  END IF;
  
  -- Update Mr. Boshomane's profile to point to Kutlwano Associate
  UPDATE profiles
  SET law_firm_id = v_kutlwano_id,
      updated_at = now()
  WHERE email = 'boshomane@kutlwanoassociate.com';
  
END $$;