-- Supabase Migration: Solar Voice MVP Tables & Seed Data

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  phone text not null,
  property_address text,
  address text,
  lead_status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure property_address & address exist if table already existed
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='leads' and column_name='property_address') then
    alter table public.leads add column property_address text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='leads' and column_name='lead_status') then
    alter table public.leads add column lead_status text not null default 'new';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='leads' and column_name='updated_at') then
    alter table public.leads add column updated_at timestamptz not null default now();
  end if;
end $$;

create table if not exists public.lead_qualifications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  average_electric_bill numeric,
  homeowner_confirmed boolean,
  home_type text,
  electricity_provider text,
  credit_above_650 boolean,
  roof_shading text,
  decision_maker boolean,
  qualification_status text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  appointment_datetime timestamptz not null,
  status text not null default 'confirmed',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  external_call_id text unique,
  call_status text not null default 'pending',
  call_outcome text,
  recording_url text,
  transcript text,
  summary text,
  appointment_booked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists calls_lead_created_idx on public.calls(lead_id, created_at desc);
create index if not exists appointments_lead_created_idx on public.appointments(lead_id, created_at desc);

-- Seed 5 required test leads
insert into public.leads (first_name, last_name, phone, email, property_address, address, lead_status)
select * from (values
  ('John','Smith','+15550100001','john.smith@example.com','101 Sunflower Ave','101 Sunflower Ave','new'),
  ('Michael','Brown','+15550100002','michael.brown@example.com','202 Solar Way','202 Solar Way','new'),
  ('Sarah','Johnson','+15550100003','sarah.johnson@example.com','303 Bright Street','303 Bright Street','new'),
  ('David','Wilson','+15550100004','david.wilson@example.com','404 Power Lane','404 Power Lane','new'),
  ('Emily','Davis','+15550100005','emily.davis@example.com','505 Ray Court','505 Ray Court','new')
) as seed(first_name, last_name, phone, email, property_address, address, lead_status)
where not exists (select 1 from public.leads l where l.email = seed.email);

-- Enable RLS and permissive policies for MVP demo
alter table public.leads enable row level security;
alter table public.lead_qualifications enable row level security;
alter table public.appointments enable row level security;
alter table public.calls enable row level security;

drop policy if exists "demo leads select" on public.leads;
create policy "demo leads select" on public.leads for select to anon, authenticated using (true);
drop policy if exists "demo leads insert" on public.leads;
create policy "demo leads insert" on public.leads for insert to anon, authenticated with check (true);
drop policy if exists "demo leads update" on public.leads;
create policy "demo leads update" on public.leads for update to anon, authenticated using (true);

drop policy if exists "demo qualifications all" on public.lead_qualifications;
create policy "demo qualifications all" on public.lead_qualifications for all to anon, authenticated using (true) with check (true);

drop policy if exists "demo appointments all" on public.appointments;
create policy "demo appointments all" on public.appointments for all to anon, authenticated using (true) with check (true);

drop policy if exists "demo calls all" on public.calls;
create policy "demo calls all" on public.calls for all to anon, authenticated using (true) with check (true);
