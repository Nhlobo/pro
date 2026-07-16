-- =============================================================================
-- TRUSTED DEVICE CHALLENGES
-- Temporary WebAuthn Challenges
-- =============================================================================

create table if not exists public.trusted_device_challenges (

    id uuid primary key default gen_random_uuid(),

    -------------------------------------------------------------------------
    -- User
    -------------------------------------------------------------------------

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    -------------------------------------------------------------------------
    -- Challenge
    -------------------------------------------------------------------------

    challenge text not null,

    challenge_type text not null
        check (
            challenge_type in (
                'registration',
                'authentication'
            )
        ),

    -------------------------------------------------------------------------
    -- Metadata
    -------------------------------------------------------------------------

    expires_at timestamptz not null,

    used_at timestamptz,

    created_at timestamptz not null default now()

);

-- =============================================================================
-- Indexes
-- =============================================================================

create index if not exists trusted_device_challenges_user_idx
on public.trusted_device_challenges(user_id);

create index if not exists trusted_device_challenges_expiry_idx
on public.trusted_device_challenges(expires_at);

create index if not exists trusted_device_challenges_lookup_idx
on public.trusted_device_challenges(
    user_id,
    challenge_type
);

-- =============================================================================
-- Helper Function
-- Removes expired or already used challenges
-- =============================================================================

create or replace function public.cleanup_trusted_device_challenges()

returns void

language sql

as
$$

delete

from public.trusted_device_challenges

where

    expires_at < now()

or

    used_at is not null;

$$;

-- =============================================================================
-- Helper Function
-- Marks a challenge as used
-- =============================================================================

create or replace function public.consume_trusted_device_challenge(

    p_user uuid,

    p_challenge text,

    p_type text

)

returns boolean

language plpgsql

as
$$

declare

    v_exists boolean;

begin

    update public.trusted_device_challenges

    set used_at = now()

    where

        user_id = p_user

    and challenge = p_challenge

    and challenge_type = p_type

    and expires_at > now()

    and used_at is null;

    get diagnostics v_exists = row_count;

    return v_exists;

end;

$$;

-- =============================================================================
-- Comments
-- =============================================================================

comment on table public.trusted_device_challenges is
'Stores temporary WebAuthn registration and authentication challenges.';

comment on function public.cleanup_trusted_device_challenges() is
'Deletes expired or already consumed WebAuthn challenges.';

comment on function public.consume_trusted_device_challenge(uuid,text,text) is
'Marks a valid WebAuthn challenge as consumed so it cannot be replayed.';
