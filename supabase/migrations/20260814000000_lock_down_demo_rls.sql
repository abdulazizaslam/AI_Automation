-- Lock down the MVP tables so browser clients cannot directly read or write them.
-- The Next.js server uses SUPABASE_SERVICE_ROLE_KEY and therefore bypasses RLS.

alter table public.leads enable row level security;
alter table public.lead_qualifications enable row level security;
alter table public.appointments enable row level security;
alter table public.calls enable row level security;

drop policy if exists "demo leads select" on public.leads;
drop policy if exists "demo leads insert" on public.leads;
drop policy if exists "demo leads update" on public.leads;
drop policy if exists "demo qualifications all" on public.lead_qualifications;
drop policy if exists "demo appointments all" on public.appointments;
drop policy if exists "demo calls all" on public.calls;

revoke all on table public.leads from anon, authenticated;
revoke all on table public.lead_qualifications from anon, authenticated;
revoke all on table public.appointments from anon, authenticated;
revoke all on table public.calls from anon, authenticated;
