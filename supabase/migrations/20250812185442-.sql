create type if not exists public.specialization_type as enum ('mva', 'med_neg', 'both');

create table if not exists public.medical_experts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null,
  expert_type text not null,
  specialization public.specialization_type not null,
  practice_number text,
  cost_fee numeric(12,2) not null default 0,
  court_case_fee numeric(12,2),
  years_experience int,
  available_for_court boolean not null default false,
  court_availability_notes text,
  province text not null,
  auto_code text not null
);

alter table public.medical_experts enable row level security;

create policy if not exists "Public can select medical_experts"
on public.medical_experts for select using (true);

create policy if not exists "Public can insert medical_experts"
on public.medical_experts for insert with check (true);

create policy if not exists "Public can update medical_experts"
on public.medical_experts for update using (true) with check (true);

create policy if not exists "Public can delete medical_experts"
on public.medical_experts for delete using (true);
