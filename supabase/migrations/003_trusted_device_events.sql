-- =============================================================================
-- TRUSTED DEVICE AUDIT EVENTS
-- Internal Staff Biometric Audit Log
-- =============================================================================

create table if not exists public.trusted_device_events (

    -------------------------------------------------------------------------
    -- Primary Key
    -------------------------------------------------------------------------

    id uuid primary key default gen_random_uuid(),

    -------------------------------------------------------------------------
    -- User
    -------------------------------------------------------------------------

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    -------------------------------------------------------------------------
    -- Device
    -------------------------------------------------------------------------

    trusted_device_id uuid
        references public.trusted_devices(id)
        on delete set null,

    credential_id text,

    -------------------------------------------------------------------------
    -- Event
    -------------------------------------------------------------------------

    event_type text not null
        check (

            event_type in (

                'registration',

                'authentication',

                'failed_authentication',

                'rename',

                'revoke'

            )

        ),

    -------------------------------------------------------------------------
    -- Result
    -------------------------------------------------------------------------

    success boolean not null default true,

    message text,

    -------------------------------------------------------------------------
    -- Client Information
    -------------------------------------------------------------------------

    ip_address inet,

    user_agent text,

    -------------------------------------------------------------------------
    -- Timestamp
    -------------------------------------------------------------------------

    created_at timestamptz not null default now()

);

-- =============================================================================
-- Indexes
-- =============================================================================

create index if not exists trusted_device_events_user_idx
on public.trusted_device_events(user_id);

create index if not exists trusted_device_events_device_idx
on public.trusted_device_events(trusted_device_id);

create index if not exists trusted_device_events_created_idx
on public.trusted_device_events(created_at desc);

create index if not exists trusted_device_events_event_idx
on public.trusted_device_events(event_type);

-- =============================================================================
-- Helper Function
-- =============================================================================

create or replace function public.log_trusted_device_event(

    p_user_id uuid,

    p_device_id uuid,

    p_credential_id text,

    p_event_type text,

    p_success boolean default true,

    p_message text default null,

    p_ip inet default null,

    p_user_agent text default null

)

returns uuid

language plpgsql

security definer

as
$$

declare

    v_event_id uuid;

begin

    insert into public.trusted_device_events (

        user_id,

        trusted_device_id,

        credential_id,

        event_type,

        success,

        message,

        ip_address,

        user_agent

    )

    values (

        p_user_id,

        p_device_id,

        p_credential_id,

        p_event_type,

        p_success,

        p_message,

        p_ip,

        p_user_agent

    )

    returning id

    into v_event_id;

    return v_event_id;

end;

$$;

-- =============================================================================
-- View
-- Useful for Admin Reporting
-- =============================================================================

create or replace view public.active_trusted_devices as

select

    td.id,

    td.user_id,

    td.device_label,

    td.platform,

    td.last_used_at,

    td.created_at,

    td.user_agent

from public.trusted_devices td

where td.revoked_at is null;

-- =============================================================================
-- Comments
-- =============================================================================

comment on table public.trusted_device_events is
'Audit history for biometric registration and authentication.';

comment on function public.log_trusted_device_event is
'Writes an immutable biometric audit record.';

comment on view public.active_trusted_devices is
'Lists all active (non-revoked) trusted biometric devices.';
