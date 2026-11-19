-- Tradarr Business Suite: private, trader-owned business workflows.
-- No price gates, automatic marketing, unverified compliance badges or public documents.
create table public.trade_suite_radar_prefs(
 tradesperson_id uuid primary key references public.tradesperson_profiles(user_id) on delete cascade,
 trade_filter text not null default '' check(length(trade_filter)<=70),
 max_distance_miles integer not null default 15 check(max_distance_miles between 1 and 100),
 minimum_job_value numeric(10,2) not null default 0 check(minimum_job_value between 0 and 100000),
 urgent_only boolean not null default false,
 updated_at timestamptz not null default now()
);

create table public.trade_suite_templates(
 id uuid primary key default gen_random_uuid(),
 tradesperson_id uuid not null references public.tradesperson_profiles(user_id) on delete cascade,
 category text not null check(category in('quote','follow_up','review','general')),
 title text not null check(char_length(btrim(title)) between 2 and 100),
 body text not null check(char_length(btrim(body)) between 5 and 3500),
 created_at timestamptz not null default now()
);
create index trade_suite_templates_owner_idx on public.trade_suite_templates(tradesperson_id,category);

create table public.trade_suite_reminders(
 id uuid primary key default gen_random_uuid(),
 tradesperson_id uuid not null references public.tradesperson_profiles(user_id) on delete cascade,
 customer_id uuid not null references public.trade_customers(id) on delete cascade,
 title text not null check(length(btrim(title)) between 3 and 120),
 due_on date not null,
 note text not null default '' check(length(note)<=800),
 status text not null default 'due' check(status in ('due','done')),
 created_at timestamptz not null default now()
);
create index trade_suite_reminders_due_idx on public.trade_suite_reminders(tradesperson_id,due_on) where status='due';

create table public.trade_suite_job_tasks(
 id uuid primary key default gen_random_uuid(),
 tradesperson_id uuid not null references public.tradesperson_profiles(user_id) on delete cascade,
 job_id uuid not null,
 job_kind text not null check(job_kind in ('standard','urgent')),
 title text not null check(length(btrim(title)) between 2 and 240),
 is_done boolean not null default false,
 created_at timestamptz not null default now()
);
create index trade_suite_tasks_job_idx on public.trade_suite_job_tasks(tradesperson_id,job_kind,job_id);

create table public.trade_suite_crew_hours(
 id uuid primary key default gen_random_uuid(),
 tradesperson_id uuid not null references public.tradesperson_profiles(user_id) on delete cascade,
 application_id uuid not null references public.crew_applications(id) on delete cascade,
 worked_on date not null,
 hours numeric(5,2) not null check(hours>0 and hours<=24),
 hourly_cost numeric(9,2) check(hourly_cost is null or (hourly_cost>=0 and hourly_cost<=10000)),
 note text not null default '' check(length(note)<=500),
 created_at timestamptz not null default now()
);
create index trade_suite_crew_hours_owner on public.trade_suite_crew_hours(tradesperson_id,worked_on desc);

create table public.trade_suite_booking_profile(
 tradesperson_id uuid primary key references public.tradesperson_profiles(user_id) on delete cascade,
 headline text not null default '' check(length(headline)<=140),
 services text not null default '' check(length(services)<=700),
 booking_instructions text not null default '' check(length(booking_instructions)<=700),
 updated_at timestamptz not null default now()
);

create table public.trade_suite_documents(
 id uuid primary key default gen_random_uuid(),
 tradesperson_id uuid not null references public.tradesperson_profiles(user_id) on delete cascade,
 label text not null check(length(btrim(label)) between 3 and 140),
 category text not null check(category in ('insurance','qualification','receipt','warranty','other')),
 object_path text not null unique check(length(object_path)<=500),
 expiry_date date,
 created_at timestamptz not null default now()
);
create index trade_suite_documents_owner on public.trade_suite_documents(tradesperson_id,created_at desc);

-- Every exposed table has strict per-owner RLS. The same business account can switch
-- to customer mode; this never exposes its business records to other users.
do $ddl$ declare t text; begin
 foreach t in array array[
  'trade_suite_radar_prefs','trade_suite_templates','trade_suite_reminders',
  'trade_suite_job_tasks','trade_suite_crew_hours','trade_suite_booking_profile',
  'trade_suite_documents'
 ] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy trade_suite_owner_select on public.%I for select to authenticated using (tradesperson_id=(select auth.uid()))',t);
  execute format('create policy trade_suite_owner_insert on public.%I for insert to authenticated with check (tradesperson_id=(select auth.uid()) and not trade_private.tradarr_account_suspended((select auth.uid())) and not trade_private.tradarr_trade_paused((select auth.uid())))',t);
  execute format('create policy trade_suite_owner_update on public.%I for update to authenticated using(tradesperson_id=(select auth.uid()) and not trade_private.tradarr_account_suspended((select auth.uid()))) with check(tradesperson_id=(select auth.uid()))',t);
  execute format('create policy trade_suite_owner_delete on public.%I for delete to authenticated using(tradesperson_id=(select auth.uid()) and not trade_private.tradarr_account_suspended((select auth.uid())))',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,delete on public.%I to authenticated',t);
 end loop;
end $ddl$;

grant update(trade_filter,max_distance_miles,minimum_job_value,urgent_only,updated_at) on public.trade_suite_radar_prefs to authenticated;
grant update(status) on public.trade_suite_reminders to authenticated;
grant update(is_done) on public.trade_suite_job_tasks to authenticated;
grant update(headline,services,booking_instructions,updated_at) on public.trade_suite_booking_profile to authenticated;

-- Ensure reminders can only refer to a customer in the same business account.
drop policy trade_suite_owner_insert on public.trade_suite_reminders;
create policy trade_suite_owner_insert on public.trade_suite_reminders for insert to authenticated
with check (
 tradesperson_id=(select auth.uid())
 and not trade_private.tradarr_account_suspended((select auth.uid()))
 and exists(select 1 from public.trade_customers c where c.id=customer_id and c.tradesperson_id=(select auth.uid()))
);

-- A checklist belongs to an accepted job; no arbitrary job/customer IDs permitted.
drop policy trade_suite_owner_insert on public.trade_suite_job_tasks;
create policy trade_suite_owner_insert on public.trade_suite_job_tasks for insert to authenticated
with check (
 tradesperson_id=(select auth.uid())
 and not trade_private.tradarr_account_suspended((select auth.uid()))
 and (
   (job_kind='standard' and exists(select 1 from public.jobs j where j.id=job_id and j.accepted_tradesperson_id=(select auth.uid())))
   or
   (job_kind='urgent' and exists(select 1 from public.urgent_requests j where j.id=job_id and j.accepted_tradesperson_id=(select auth.uid())))
 )
);

-- Crew timesheets: owned by hirer, only for accepted applicant, never a payroll claim.
drop policy trade_suite_owner_insert on public.trade_suite_crew_hours;
create policy trade_suite_owner_insert on public.trade_suite_crew_hours for insert to authenticated
with check (
 tradesperson_id=(select auth.uid())
 and not trade_private.tradarr_account_suspended((select auth.uid()))
 and exists(
  select 1 from public.crew_applications a join public.crew_requests r on r.id=a.request_id
  where a.id=application_id and a.status='accepted' and r.owner_id=(select auth.uid())
 )
);

-- Private vault bucket; each object must live under the authenticated user's UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('tradarr-trade-vault','tradarr-trade-vault',false,10485760,
 array['application/pdf','image/jpeg','image/png','image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
 on conflict(id) do nothing;
create policy trade_suite_vault_read on storage.objects for select to authenticated
 using(bucket_id='tradarr-trade-vault' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy trade_suite_vault_insert on storage.objects for insert to authenticated
 with check(bucket_id='tradarr-trade-vault' and (storage.foldername(name))[1]=(select auth.uid())::text
 and not trade_private.tradarr_account_suspended((select auth.uid())));
create policy trade_suite_vault_delete on storage.objects for delete to authenticated
 using(bucket_id='tradarr-trade-vault' and (storage.foldername(name))[1]=(select auth.uid())::text
 and not trade_private.tradarr_account_suspended((select auth.uid())));

comment on table public.trade_suite_documents is 'Private trader document metadata; files are stored separately in the private tradarr-trade-vault bucket.';
comment on table public.trade_suite_crew_hours is 'Internal hire cost/time record, not evidence of employment, worker payment or payroll compliance.';
