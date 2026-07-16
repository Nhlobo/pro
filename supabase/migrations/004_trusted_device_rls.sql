-- =============================================================================
-- TRUSTED DEVICE ROW LEVEL SECURITY
-- Internal Staff Biometric Authentication
-- =============================================================================

----------------------------------------------------------------------------
-- Enable RLS
----------------------------------------------------------------------------

alter table public.trusted_devices
enable row level security;

alter table public.trusted_device_challenges
enable row level security;

alter table public.trusted_device_events
enable row level security;

----------------------------------------------------------------------------
-- Remove Existing Policies
----------------------------------------------------------------------------

drop policy if exists "trusted_devices_select" on public.trusted_devices;
drop policy if exists "trusted_devices_update" on public.trusted_devices;

drop policy if exists "trusted_device_events_select" on public.trusted_device_events;

----------------------------------------------------------------------------
-- TRUSTED DEVICES
----------------------------------------------------------------------------

create policy "trusted_devices_select"

on public.trusted_devices

for select

using (

    auth.uid() = user_id

);

create policy "trusted_devices_update"

on public.trusted_devices

for update

using (

    auth.uid() = user_id

)

with check (

    auth.uid() = user_id

);

----------------------------------------------------------------------------
-- AUDIT EVENTS
----------------------------------------------------------------------------

create policy "trusted_device_events_select"

on public.trusted_device_events

for select

using (

    auth.uid() = user_id

);

----------------------------------------------------------------------------
-- CHALLENGES
----------------------------------------------------------------------------

-- Challenge records should NEVER be visible from the client.

revoke all

on table public.trusted_device_challenges

from authenticated;

revoke all

on table public.trusted_device_challenges

from anon;

----------------------------------------------------------------------------
-- Trusted Devices
----------------------------------------------------------------------------

grant

select,
update

on public.trusted_devices

to authenticated;

----------------------------------------------------------------------------
-- Audit Events
----------------------------------------------------------------------------

grant

select

on public.trusted_device_events

to authenticated;

----------------------------------------------------------------------------
-- Comments
----------------------------------------------------------------------------

comment on policy "trusted_devices_select"

on public.trusted_devices

is 'Employees may only view their own enrolled biometric devices.';

comment on policy "trusted_devices_update"

on public.trusted_devices

is 'Employees may rename their own biometric devices.';

comment on policy "trusted_device_events_select"

on public.trusted_device_events

is 'Employees may only view their own biometric audit history.';
