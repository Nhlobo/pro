
-- Merge duplicates: transfer linked data from duplicate to primary, then delete duplicate

-- 1. Nadeemah Moosa: keep dc0b91c8 (15 appts), merge faafbf26 (1 appt)
UPDATE appointments SET expert_id = 'dc0b91c8-d4ca-42b2-8e7f-de0d20d52a08', updated_at = NOW() WHERE expert_id = 'faafbf26-f3e3-4b31-a980-031254f48e1a';
UPDATE expert_reports SET expert_id = 'dc0b91c8-d4ca-42b2-8e7f-de0d20d52a08', updated_at = NOW() WHERE expert_id = 'faafbf26-f3e3-4b31-a980-031254f48e1a';
UPDATE expert_payments SET expert_id = 'dc0b91c8-d4ca-42b2-8e7f-de0d20d52a08', updated_at = NOW() WHERE expert_id = 'faafbf26-f3e3-4b31-a980-031254f48e1a';
UPDATE documents SET expert_id = 'dc0b91c8-d4ca-42b2-8e7f-de0d20d52a08', updated_at = NOW() WHERE expert_id = 'faafbf26-f3e3-4b31-a980-031254f48e1a';
DELETE FROM medical_experts WHERE id = 'faafbf26-f3e3-4b31-a980-031254f48e1a';

-- 2. Uli Kunzmann: keep 8664dea4 (7 appts), merge ecb54e86 (1 appt)
UPDATE appointments SET expert_id = '8664dea4-73cd-482c-8dc9-0ee847f48b53', updated_at = NOW() WHERE expert_id = 'ecb54e86-dc68-402f-8b16-03d0ed30f64e';
UPDATE expert_reports SET expert_id = '8664dea4-73cd-482c-8dc9-0ee847f48b53', updated_at = NOW() WHERE expert_id = 'ecb54e86-dc68-402f-8b16-03d0ed30f64e';
UPDATE expert_payments SET expert_id = '8664dea4-73cd-482c-8dc9-0ee847f48b53', updated_at = NOW() WHERE expert_id = 'ecb54e86-dc68-402f-8b16-03d0ed30f64e';
UPDATE documents SET expert_id = '8664dea4-73cd-482c-8dc9-0ee847f48b53', updated_at = NOW() WHERE expert_id = 'ecb54e86-dc68-402f-8b16-03d0ed30f64e';
DELETE FROM medical_experts WHERE id = 'ecb54e86-dc68-402f-8b16-03d0ed30f64e';

-- 3. Kgadi Mailula: keep 7b6061a7 (oldest), delete a8df3ffa (no linked data)
DELETE FROM medical_experts WHERE id = 'a8df3ffa-2588-4be3-b211-4e2b4072b7b3';

-- 4. Mmathapelo Tshabangu: keep 4d253971 (oldest), delete 76db21d5 (no linked data)
DELETE FROM medical_experts WHERE id = '76db21d5-1763-43c4-be60-c0e2d0ac38b3';

-- 5. TA Mudau: keep f7b6bc5e (oldest), delete f0457728 (no linked data)
DELETE FROM medical_experts WHERE id = 'f0457728-7c17-46ac-a01c-f90cdb1fe81e';
