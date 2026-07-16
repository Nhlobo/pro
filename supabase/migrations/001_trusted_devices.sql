-- =============================================================================
-- TRUSTED DEVICES
-- Internal Staff Biometric Authentication
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists public.trusted_devices (

    id uuid primary key default gen_random_uuid(),

    -------------------------------------------------------------------------
    -- Owner
    -------------------------------------------------------------------------

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    -------------------------------------------------------------------------
    -- WebAuthn Credential
    -------------------------------------------------------------------------

    credential_id text not null unique,

    public_key text not null,

    counter bigint not null default 0,

    -------------------------------------------------------------------------
    -- Device Information
    -------------------------------------------------------------------------

    device_label text not null,

    platform text,

    user_agent text,

    transports text[] default '{}',

    -------------------------------------------------------------------------
    -- Status
    -------------------------------------------------------------------------

    last_used_at timestamptz,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    revoked_at timestamptz,

    revoked_by uuid
        references auth.users(id)
        on delete set null,

    revoked_reason text,

    -------------------------------------------------------------------------
    -- Constraints
    -------------------------------------------------------------------------

    constraint trusted_devices_device_label_length
        check (char_length(device_label) between 1 and 100)

);

-- =============================================================================
-- Indexes
-- =============================================================================

create index if not exists trusted_devices_user_idx
on public.trusted_devices(user_id);

create index if not exists trusted_devices_active_idx
on public.trusted_devices(user_id)
where revoked_at is null;

create index if not exists trusted_devices_last_used_idx
on public.trusted_devices(last_used_at);

-- =============================================================================
-- Trigger to maintain updated_at
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as
$$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trusted_devices_updated_at
on public.trusted_devices;

create trigger trusted_devices_updated_at

before update

on public.trusted_devices

for each row

execute procedure public.set_updated_at();

-- =============================================================================
-- Helper Function
-- =============================================================================

create or replace function public.is_device_active(
    p_user uuid,
    p_credential text
)

returns boolean

language sql

stable

as
$$

select exists (

    select 1

    from public.trusted_devices

    where user_id = p_user

      and credential_id = p_credential

      and revoked_at is null

);

$$;

-- =============================================================================
-- Comments
-- =============================================================================

comment on table public.trusted_devices is
'Stores WebAuthn credentials enrolled by internal staff.';

comment on column public.trusted_devices.credential_id is
'Unique WebAuthn credential identifier.';

comment on column public.trusted_devices.public_key is
'Credential public key used for signature verification.';

comment on column public.trusted_devices.counter is
'WebAuthn signature counter to prevent cloned authenticators.';

comment on column public.trusted_devices.revoked_at is
'Timestamp when this trusted device was revoked.';

comment on function public.is_device_active(uuid, text) is
'Returns true if the specified credential is currently active.';
