-- Customer Price Lens and neighbourhood group-booking pilot.
create table if not exists public.customer_price_checks (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(btrim(title)) between 3 and 140),
 trade text not null check(length(btrim(trade)) between 2 and 70),
 quotes jsonb not null default '[]'::jsonb
  check(jsonb_typeof(quotes)='array' and jsonb_array_length(quotes)<=10),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists customer_price_checks_owner on public.customer_price_checks(customer_id,updated_at desc);
alter table public.customer_price_checks enable row level security;
drop policy if exists price_checks_owner on public.customer_price_checks;
create policy price_checks_owner on public.customer_price_checks for all to authenticated
 using(customer_id=(select auth.uid())) with check(customer_id=(select auth.uid()));
grant select,insert,update,delete on public.customer_price_checks to authenticated;

-- A price band is published only after eight separate jobs have been marked completed
-- and their invoices marked paid. These are observed job amounts, NOT price estimates
-- for a particular scope. No quote, address or contractor identifiers are returned.
create or replace function public.tradarr_observed_job_prices(p_trade text)
returns table(sample_size bigint,lower_quartile numeric,median numeric,upper_quartile numeric)
language sql stable security definer set search_path='' as $$
 with eligible as (
   select i.app_job_id, sum(i.subtotal)::numeric as job_amount
   from public.trade_invoices i
   join public.jobs j on j.id=i.app_job_id
   where i.status='paid' and j.status='completed'
     and i.source='app' and i.app_job_id is not null
     and lower(btrim(j.trade))=lower(btrim(p_trade))
     and i.subtotal>0
     and j.completed_at>=now()-interval '24 months'
   group by i.app_job_id
 ), stats as (
   select count(*)::bigint n,
    percentile_cont(0.25) within group(order by job_amount)::numeric q1,
    percentile_cont(0.5) within group(order by job_amount)::numeric median,
    percentile_cont(0.75) within group(order by job_amount)::numeric q3
   from eligible
 ) select n,round(q1,0),round(median,0),round(q3,0) from stats
 where n>=8 and length(btrim(p_trade)) between 2 and 70;
$$;
revoke all on function public.tradarr_observed_job_prices(text) from public,anon;
grant execute on function public.tradarr_observed_job_prices(text) to authenticated;

create table if not exists public.trade_collectives (
 id uuid primary key default gen_random_uuid(),
 organiser_id uuid not null references auth.users(id) on delete cascade,
 trade text not null check(length(btrim(trade)) between 2 and 60),
 service text not null check(length(btrim(service)) between 8 and 180),
 area_label text not null check(length(btrim(area_label)) between 2 and 50),
 desired_window text check(desired_window is null or length(desired_window)<=130),
 target_homes int not null default 5 check(target_homes between 2 and 25),
 member_count int not null default 0 check(member_count>=0),
 status text not null default 'open' check(status in('open','closed')),
 created_at timestamptz not null default now(),
 closes_at timestamptz not null default(now()+interval '30 days'),
 check(closes_at>created_at and closes_at<=created_at+interval '90 days')
);
create index if not exists trade_collectives_browse on public.trade_collectives(status,created_at desc);
create index if not exists trade_collectives_owner on public.trade_collectives(organiser_id,created_at desc);
alter table public.trade_collectives enable row level security;

create table if not exists public.trade_collective_members (
 collective_id uuid not null references public.trade_collectives(id) on delete cascade,
 customer_id uuid not null references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(),
 primary key(collective_id,customer_id)
);
create index if not exists trade_collective_members_owner on public.trade_collective_members(customer_id,joined_at desc);
alter table public.trade_collective_members enable row level security;
drop policy if exists collective_member_read on public.trade_collective_members;
drop policy if exists collective_member_insert on public.trade_collective_members;
drop policy if exists collective_member_delete on public.trade_collective_members;
-- Individual membership lists are never visible to the organiser or other members.
create policy collective_member_read on public.trade_collective_members for select to authenticated
 using(customer_id=(select auth.uid()));
create policy collective_member_insert on public.trade_collective_members for insert to authenticated
 with check(customer_id=(select auth.uid()) and exists(
 select 1 from public.trade_collectives g where g.id=collective_id
  and g.status='open' and g.closes_at>now()));
create policy collective_member_delete on public.trade_collective_members for delete to authenticated
 using(customer_id=(select auth.uid()));
grant select,insert,delete on public.trade_collective_members to authenticated;

drop policy if exists collective_group_read on public.trade_collectives;
drop policy if exists collective_group_insert on public.trade_collectives;
drop policy if exists collective_group_update on public.trade_collectives;
create policy collective_group_read on public.trade_collectives for select to authenticated using(
 status='open' or organiser_id=(select auth.uid()) or exists(
 select 1 from public.trade_collective_members m where m.collective_id=id and m.customer_id=(select auth.uid()))
);
create policy collective_group_insert on public.trade_collectives for insert to authenticated
 with check(organiser_id=(select auth.uid()) and status='open' and member_count=0);
create policy collective_group_update on public.trade_collectives for update to authenticated
 using(organiser_id=(select auth.uid())) with check(organiser_id=(select auth.uid()));
grant select,insert on public.trade_collectives to authenticated;
grant update(status) on public.trade_collectives to authenticated;

-- Count participants without disclosing identities or letting clients forge the count.
create or replace function trade_private.tradarr_collective_member_count()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 v_id:=case when tg_op='DELETE' then old.collective_id else new.collective_id end;
 update public.trade_collectives
 set member_count=(select count(*) from public.trade_collective_members where collective_id=v_id)
 where id=v_id;
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function trade_private.tradarr_collective_member_count() from public,anon,authenticated;
drop trigger if exists tradarr_collective_member_count on public.trade_collective_members;
create trigger tradarr_collective_member_count after insert or delete
on public.trade_collective_members for each row execute function trade_private.tradarr_collective_member_count();

-- Creators are automatically the first participant.
create or replace function trade_private.tradarr_collective_join_organiser()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.trade_collective_members(collective_id,customer_id)
 values(new.id,new.organiser_id);
 return new;
end $$;
revoke all on function trade_private.tradarr_collective_join_organiser() from public,anon,authenticated;
drop trigger if exists tradarr_collective_join_organiser on public.trade_collectives;
create trigger tradarr_collective_join_organiser after insert on public.trade_collectives
 for each row execute function trade_private.tradarr_collective_join_organiser();

create table if not exists public.trade_collective_offers (
 id uuid primary key default gen_random_uuid(),
 collective_id uuid not null references public.trade_collectives(id) on delete cascade,
 tradesperson_id uuid not null references public.tradesperson_profiles(user_id) on delete cascade,
 price_per_home numeric(12,2) not null check(price_per_home>0 and price_per_home<1000000),
 includes_vat boolean not null default false,
 terms text not null check(length(btrim(terms)) between 15 and 750),
 earliest_date date,
 status text not null default 'active' check(status in('active','withdrawn')),
 created_at timestamptz not null default now(),
 unique(collective_id,tradesperson_id)
);
create index if not exists trade_collective_offers_group on public.trade_collective_offers(collective_id,created_at desc);
alter table public.trade_collective_offers enable row level security;
drop policy if exists collective_offer_read on public.trade_collective_offers;
drop policy if exists collective_offer_insert on public.trade_collective_offers;
drop policy if exists collective_offer_update on public.trade_collective_offers;
create policy collective_offer_read on public.trade_collective_offers for select to authenticated
 using(tradesperson_id=(select auth.uid()) or exists(
 select 1 from public.trade_collective_members m where m.collective_id=trade_collective_offers.collective_id
 and m.customer_id=(select auth.uid())));
create policy collective_offer_insert on public.trade_collective_offers for insert to authenticated
 with check(tradesperson_id=(select auth.uid()) and status='active' and exists(
 select 1 from public.trade_collectives g where g.id=collective_id
 and g.status='open' and g.closes_at>now()));
create policy collective_offer_update on public.trade_collective_offers for update to authenticated
 using(tradesperson_id=(select auth.uid())) with check(tradesperson_id=(select auth.uid()));
grant select,insert on public.trade_collective_offers to authenticated;
grant update(status) on public.trade_collective_offers to authenticated;
