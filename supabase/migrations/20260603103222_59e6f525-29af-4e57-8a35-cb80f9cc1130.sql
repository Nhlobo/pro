INSERT INTO public.system_settings (setting_key, setting_value, category, description)
VALUES (
  'payment_approval_reminders',
  '{"reminder_after_hours": 48, "repeat_reminder_every_hours": 24}'::jsonb,
  'notifications',
  'Configurable timing for payment approval reminder emails. reminder_after_hours = how long a submission must be pending before first reminder; repeat_reminder_every_hours = minimum gap between successive reminders.'
)
ON CONFLICT (setting_key) DO NOTHING;