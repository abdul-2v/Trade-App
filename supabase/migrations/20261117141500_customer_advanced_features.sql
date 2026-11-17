-- Customer innovation pilot: real route gaps, multi-trade plans and photo repair briefs.
create table if not exists public.trade_grid_slots(
 id uuid primary key default gen_random_uuid(),
 tradesperson_id uuid not null references public.tradesperson_profiles(user_id) on delete cascade,
 trade text not null check(length(btrim(trade)) between 2 and 60),
 area_label text not null check(length(btrim(area_label)) between 2 and 90),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 price_note text check(price_note is null or length(price_note)<=180),
 status text not null default 'open' check(status in('open','paused','booked','closed')),
 created_at timestamptz not null default now(),
 check(ends_at>starts_at and ends_at<=starts_at+interval '12 hours')
);
create index if not exists trade_grid_slot_open_idx on public.trade_grid_slots(status,starts_at) where status='open';
create index if not exists trade_grid_slot_owner_idx on public.trade_grid_slots(tradesperson_id,starts_at desc);
alter table public.trade_grid_slots enable row level security;
drop policy if exists grid_slots_read on public.trade_grid_slots;
drop policy if exists grid_slots_insert on public.trade_grid_slots;
drop policy if exists grid_slots_update on public.trade_grid_slots;
drop policy if exists grid_slots_delete on public.trade_grid_slots;
create policy grid_slots_read on public.trade_grid_slots for select to authenticated using (
 tradesperson_id=(select auth.uid()) or (status='open' and starts_at>now())
);
create policy grid_slots_insert on public.trade_grid_slots for insert to authenticated with check(
 tradesperson_id=(select auth.uid()) and status='open' and starts_at>now()
);
create policy grid_slots_update on public.trade_grid_slots for update to authenticated
 using(tradesperson_id=(select auth.uid()))
 with check(tradesperson_id=(select auth.uid()));
create policy grid_slots_delete on public.trade_grid_slots for delete to authenticated using(tradesperson_id=(select auth.uid()));
grant select,insert,update,delete on public.trade_grid_slots to authenticated;

create table if not exists public.trade_grid_requests(
 id uuid primary key default gen_random_uuid(),
 slot_id uuid not null references public.trade_grid_slots(id) on delete cascade,
 customer_id uuid not null references auth.users(id) on delete cascade,
 summary text not null check(length(btrim(summary)) between 8 and 700),
 status text not null default 'pending' check(status in ('pending','accepted','declined','withdrawn')),
 created_at timestamptz not null default now(),
 unique(slot_id,customer_id)
);
create unique index if not exists trade_grid_one_accepted_per_slot on public.trade_grid_requests(slot_id) where status='accepted';
create index if not exists trade_grid_requests_customer_idx on public.trade_grid_requests(customer_id,created_at desc);
create index if not exists trade_grid_requests_slot_idx on public.trade_grid_requests(slot_id,created_at desc);
alter table public.trade_grid_requests enable row level security;
drop policy if exists grid_request_read on public.trade_grid_requests;
drop policy if exists grid_request_create on public.trade_grid_requests;
drop policy if exists grid_request_answer on public.trade_grid_requests;
create policy grid_request_read on public.trade_grid_requests for select to authenticated using(
 customer_id=(select auth.uid()) or exists(
  select 1 from public.trade_grid_slots g where g.id=slot_id and g.tradesperson_id=(select auth.uid())
 ));
create policy grid_request_create on public.trade_grid_requests for insert to authenticated with check(
 customer_id=(select auth.uid()) and status='pending' and exists(
 select 1 from public.trade_grid_slots g where g.id=slot_id and g.status='open' and g.starts_at>now())
);
create policy grid_request_answer on public.trade_grid_requests for update to authenticated
using(status='pending' and (
 customer_id=(select auth.uid()) or exists(select 1 from public.trade_grid_slots g
 where g.id=slot_id and g.tradesperson_id=(select auth.uid()))))
with check(
 (status='withdrawn' and customer_id=(select auth.uid()))
 or (status in('accepted','declined') and exists(select 1 from public.trade_grid_slots g
 where g.id=slot_id and g.tradesperson_id=(select auth.uid())))
);
grant select,insert on public.trade_grid_requests to authenticated;
grant update(status) on public.trade_grid_requests to authenticated;
create or replace function public.tradarr_grid_book_slot()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
 if new.status='accepted' then
  update public.trade_grid_slots set status='booked' where id=new.slot_id and status='open'
    and tradesperson_id=(select auth.uid()) and starts_at>now();
  if not found then raise exception 'This availability window is no longer open'; end if;
 end if;
 return new;
end $$;
revoke all on function public.tradarr_grid_book_slot() from public,anon,authenticated;
drop trigger if exists tradarr_grid_book_slot on public.trade_grid_requests;
create trigger tradarr_grid_book_slot after update on public.trade_grid_requests
for each row when(new.status='accepted') execute function public.tradarr_grid_book_slot();

create table if not exists public.customer_onejob_projects(
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(btrim(title)) between 3 and 160),
 address text check(address is null or length(address)<=300),
 brief text check(brief is null or length(brief)<=1500),
 stages jsonb not null default '[]'::jsonb check(jsonb_typeof(stages)='array' and jsonb_array_length(stages)<=20),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists onejob_customer_idx on public.customer_onejob_projects(customer_id,updated_at desc);
alter table public.customer_onejob_projects enable row level security;
drop policy if exists onejob_own on public.customer_onejob_projects;
create policy onejob_own on public.customer_onejob_projects for all to authenticated
 using(customer_id=(select auth.uid()))
 with check(customer_id=(select auth.uid()));
grant select,insert,update,delete on public.customer_onejob_projects to authenticated;

create table if not exists public.customer_firstfix_briefs(
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references auth.users(id) on delete cascade,
 trade text not null check(length(btrim(trade)) between 2 and 60),
 title text not null check(length(btrim(title)) between 3 and 160),
 symptoms text not null check(length(btrim(symptoms)) between 8 and 1200),
 appliance_model text check(appliance_model is null or length(appliance_model)<=160),
 access_notes text check(access_notes is null or length(access_notes)<=600),
 photo_paths text[] not null default '{}'::text[] check(cardinality(photo_paths)<=3),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists firstfix_customer_idx on public.customer_firstfix_briefs(customer_id,created_at desc);
alter table public.customer_firstfix_briefs enable row level security;
drop policy if exists firstfix_own on public.customer_firstfix_briefs;
create policy firstfix_own on public.customer_firstfix_briefs for all to authenticated
 using(customer_id=(select auth.uid()))
 with check(customer_id=(select auth.uid()));
grant select,insert,update,delete on public.customer_firstfix_briefs to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tradarr-firstfix','tradarr-firstfix',false,4194304,array['image/jpeg','image/png'])
on conflict (id) do nothing;
drop policy if exists firstfix_photo_read on storage.objects;
drop policy if exists firstfix_photo_insert on storage.objects;
drop policy if exists firstfix_photo_delete on storage.objects;
create policy firstfix_photo_read on storage.objects for select to authenticated
 using(bucket_id='tradarr-firstfix' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy firstfix_photo_insert on storage.objects for insert to authenticated
 with check(bucket_id='tradarr-firstfix' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy firstfix_photo_delete on storage.objects for delete to authenticated
 using(bucket_id='tradarr-firstfix' and (storage.foldername(name))[1]=(select auth.uid())::text);
