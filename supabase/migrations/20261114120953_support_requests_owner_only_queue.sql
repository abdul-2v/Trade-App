-- Early-access support queue. Users can create and read only their own tickets.
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('account','booking','safety','technical','other')),
  subject text not null check (char_length(trim(subject)) between 4 and 140),
  message text not null check (char_length(trim(message)) between 10 and 4000),
  status text not null default 'open' check (status in ('open','in_progress','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_requests_user_created_idx
  on public.support_requests (submitted_by, created_at desc);
alter table public.support_requests enable row level security;
create policy support_requests_read_own on public.support_requests
  for select to authenticated using (submitted_by = (select auth.uid()));
create policy support_requests_submit_own on public.support_requests
  for insert to authenticated
  with check (submitted_by = (select auth.uid()) and status = 'open');
grant select, insert on public.support_requests to authenticated;
