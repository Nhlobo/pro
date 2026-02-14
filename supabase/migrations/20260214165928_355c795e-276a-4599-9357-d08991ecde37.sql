
-- Update check constraint to allow 'employee' role
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['admin'::text, 'user'::text, 'employee'::text]));
