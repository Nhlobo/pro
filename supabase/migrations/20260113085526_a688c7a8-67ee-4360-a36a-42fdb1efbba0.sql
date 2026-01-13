-- Consolidate duplicate Nompumza Attorneys records
-- Move all claimants from 81bb5662-7659-4af2-87f2-39c1b027f74d to e536238a-8cf7-4b27-8d37-6f2e3603106a
UPDATE claimants 
SET referring_attorney_id = 'e536238a-8cf7-4b27-8d37-6f2e3603106a'
WHERE referring_attorney_id = '81bb5662-7659-4af2-87f2-39c1b027f74d';

-- Move all appointments
UPDATE appointments 
SET referring_attorney_id = 'e536238a-8cf7-4b27-8d37-6f2e3603106a'
WHERE referring_attorney_id = '81bb5662-7659-4af2-87f2-39c1b027f74d';

-- Move all documents
UPDATE documents 
SET referring_attorney_id = 'e536238a-8cf7-4b27-8d37-6f2e3603106a'
WHERE referring_attorney_id = '81bb5662-7659-4af2-87f2-39c1b027f74d';

-- Move all AOD documents
UPDATE aod_documents 
SET referring_attorney_id = 'e536238a-8cf7-4b27-8d37-6f2e3603106a'
WHERE referring_attorney_id = '81bb5662-7659-4af2-87f2-39c1b027f74d';

-- Move all short term agreements
UPDATE short_term_agreements 
SET referring_attorney_id = 'e536238a-8cf7-4b27-8d37-6f2e3603106a'
WHERE referring_attorney_id = '81bb5662-7659-4af2-87f2-39c1b027f74d';

-- Move all profiles linked to the duplicate
UPDATE profiles 
SET referring_attorney_id = 'e536238a-8cf7-4b27-8d37-6f2e3603106a'
WHERE referring_attorney_id = '81bb5662-7659-4af2-87f2-39c1b027f74d';

-- Move appointment archives
UPDATE appointment_archives 
SET referring_attorney_id = 'e536238a-8cf7-4b27-8d37-6f2e3603106a'
WHERE referring_attorney_id = '81bb5662-7659-4af2-87f2-39c1b027f74d';

-- Move grouped email logs
UPDATE grouped_email_log 
SET referring_attorney_id = 'e536238a-8cf7-4b27-8d37-6f2e3603106a'
WHERE referring_attorney_id = '81bb5662-7659-4af2-87f2-39c1b027f74d';

-- Move attorneys (staff linked to law firm)
UPDATE attorneys 
SET referring_attorney_id = 'e536238a-8cf7-4b27-8d37-6f2e3603106a'
WHERE referring_attorney_id = '81bb5662-7659-4af2-87f2-39c1b027f74d';

-- Move pitch logs
UPDATE pitch_logs 
SET law_firm_id = 'e536238a-8cf7-4b27-8d37-6f2e3603106a'
WHERE law_firm_id = '81bb5662-7659-4af2-87f2-39c1b027f74d';

-- Move case timelines
UPDATE case_timelines 
SET referring_attorney_id = 'e536238a-8cf7-4b27-8d37-6f2e3603106a'
WHERE referring_attorney_id = '81bb5662-7659-4af2-87f2-39c1b027f74d';

-- Move case sources
UPDATE case_sources 
SET referring_attorney_id = 'e536238a-8cf7-4b27-8d37-6f2e3603106a'
WHERE referring_attorney_id = '81bb5662-7659-4af2-87f2-39c1b027f74d';

-- Finally delete the duplicate record
DELETE FROM referring_attorneys 
WHERE id = '81bb5662-7659-4af2-87f2-39c1b027f74d';