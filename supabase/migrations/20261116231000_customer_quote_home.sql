-- Customer-side tools: account-linked proposals and personal home records.
-- A delivery contains only public quote fields, never private estimated costs/margins.
create table if not exists public.trade_customer_proposals (
 id uuid primary key default gen_random_uuid(),
 quote_id uuid not null unique references public.trade_quotes(id) on delete restrict,
 tradesperson_id uuid not null references public.tradesperson_profiles(user_id) on delete cascade,
 customer_id uuid not null references auth.users(id) on delete cascade,
 job_id uuid references public.jobs(id) on delete restrict,
 urgent_request_id uuid references public.urgent_requests(id) on delete restrict,
 document jsonb not null default '{}'::jsonb,
 decision text not null default 'pending' check(decision in ('pending','accepted','changes_requested','declined')),
 feedback text,
 delivered_at timestamptz not null default now(),
 responded_at timestamptz,
 check ((job_id is not null)::int + (urgent_request_id is not null)::int = 1),
 check (feedback is null or length(feedback)<=1500)
);
create index if not exists tc_proposals_customer_recent on public.trade_customer_proposals(customer_id,delivered_at desc);
create index if not exists tc_proposals_trade_recent on public.trade_customer_proposals(tradesperson_id,delivered_at desc);

create or replace function public.tradarr_prepare_customer_proposal()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare q public.trade_quotes%rowtype;
begin
 if new.tradesperson_id is distinct from (select auth.uid()) then raise exception 'Only the quote owner can deliver'; end if;
 select * into q from public.trade_quotes where id=new.quote_id and tradesperson_id=new.tradesperson_id;
 if not found then raise exception 'Quote not found or not owned'; end if;
 -- Generate the only customer-visible snapshot server-side, excluding estimated_cost and target_margin.
 new.document := jsonb_build_object(
  'quote_no', q.quote_no, 'quote_date',q.quote_date,'valid_until',q.valid_until,
  'business_name',q.business_name,'business_address',q.business_address,
  'business_email',q.business_email,'business_phone',q.business_phone,'vat_number',q.vat_number,
  'customer_name',q.customer_name,'title',q.title,'description',q.description,
  'scope_included',q.scope_included,'scope_excluded',q.scope_excluded,
  'estimated_duration',q.estimated_duration,'items',q.items,'subtotal',q.subtotal,
  'vat_rate',q.vat_rate,'vat_amount',q.vat_amount,'total',q.total,
  'deposit_percent',q.deposit_percent,'optional_extras',q.optional_extras,
  'notes',q.notes
 );
 return new;
end $$;
revoke all on function public.tradarr_prepare_customer_proposal() from public,anon,authenticated;
drop trigger if exists tradarr_customer_proposal_snapshot on public.trade_customer_proposals;
create trigger tradarr_customer_proposal_snapshot before insert on public.trade_customer_proposals
for each row execute function public.tradarr_prepare_customer_proposal();

create or replace function public.tradarr_set_proposal_response_time()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
 if old.decision <> 'pending' then raise exception 'Proposal already answered'; end if;
 if new.decision not in ('accepted','declined','changes_requested') then raise exception 'Choose a valid decision'; end if;
 new.responded_at := now();
 return new;
end $$;
revoke all on function public.tradarr_set_proposal_response_time() from public,anon,authenticated;
drop trigger if exists tradarr_proposal_response_stamp on public.trade_customer_proposals;
create trigger tradarr_proposal_response_stamp before update on public.trade_customer_proposals
for each row execute function public.tradarr_set_proposal_response_time();

alter table public.trade_customer_proposals enable row level security;
drop policy if exists tc_proposal_read on public.trade_customer_proposals;
drop policy if exists tc_proposal_send on public.trade_customer_proposals;
drop policy if exists tc_proposal_decide on public.trade_customer_proposals;
create policy tc_proposal_read on public.trade_customer_proposals for select to authenticated
using(customer_id=(select auth.uid()) or tradesperson_id=(select auth.uid()));
create policy tc_proposal_send on public.trade_customer_proposals for insert to authenticated
with check(
 tradesperson_id=(select auth.uid()) and decision='pending'
 and exists(select 1 from public.trade_quotes q where q.id=quote_id and q.tradesperson_id=(select auth.uid()))
 and (
  (job_id is not null and urgent_request_id is null and exists(
   select 1 from public.jobs j where j.id=job_id and j.customer_id=trade_customer_proposals.customer_id
   and j.accepted_tradesperson_id=(select auth.uid())
  ))
  or
  (urgent_request_id is not null and job_id is null and exists(
   select 1 from public.urgent_requests r where r.id=urgent_request_id and r.customer_id=trade_customer_proposals.customer_id
   and r.accepted_tradesperson_id=(select auth.uid())
  ))
 )
);
create policy tc_proposal_decide on public.trade_customer_proposals for update to authenticated
using(customer_id=(select auth.uid()) and decision='pending')
with check(customer_id=(select auth.uid()) and decision in ('accepted','declined','changes_requested'));
grant select,insert on public.trade_customer_proposals to authenticated;
grant update(decision,feedback) on public.trade_customer_proposals to authenticated;

create table if not exists public.customer_properties (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references auth.users(id) on delete cascade,
 label text not null check(length(btrim(label)) between 1 and 100),
 address text not null check(length(btrim(address)) between 1 and 500),
 created_at timestamptz not null default now(),
 unique (id,customer_id)
);
create index if not exists customer_properties_customer_idx on public.customer_properties(customer_id,created_at);
create table if not exists public.customer_home_records (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references auth.users(id) on delete cascade,
 property_id uuid not null,
 title text not null check(length(btrim(title)) between 1 and 200),
 category text not null default 'repair' check(category in ('repair','service','inspection','warranty','other')),
 completed_on date,
 next_due date,
 notes text check(notes is null or length(notes)<=3000),
 created_at timestamptz not null default now(),
 foreign key(property_id,customer_id) references public.customer_properties(id,customer_id) on delete cascade
);
create index if not exists customer_home_records_owner_idx on public.customer_home_records(customer_id,created_at desc);
create index if not exists customer_home_records_due_idx on public.customer_home_records(customer_id,next_due) where next_due is not null;
alter table public.customer_properties enable row level security;
alter table public.customer_home_records enable row level security;

drop policy if exists cp_owner_select on public.customer_properties;
drop policy if exists cp_owner_insert on public.customer_properties;
drop policy if exists cp_owner_delete on public.customer_properties;
create policy cp_owner_select on public.customer_properties for select to authenticated using(customer_id=(select auth.uid()));
create policy cp_owner_insert on public.customer_properties for insert to authenticated with check(customer_id=(select auth.uid()));
create policy cp_owner_delete on public.customer_properties for delete to authenticated using(customer_id=(select auth.uid()));
grant select,insert,delete on public.customer_properties to authenticated;

drop policy if exists chr_owner_select on public.customer_home_records;
drop policy if exists chr_owner_insert on public.customer_home_records;
drop policy if exists chr_owner_delete on public.customer_home_records;
create policy chr_owner_select on public.customer_home_records for select to authenticated using(customer_id=(select auth.uid()));
create policy chr_owner_insert on public.customer_home_records for insert to authenticated
with check(customer_id=(select auth.uid()) and exists(
 select 1 from public.customer_properties p where p.id=property_id and p.customer_id=(select auth.uid())
));
create policy chr_owner_delete on public.customer_home_records for delete to authenticated using(customer_id=(select auth.uid()));
grant select,insert,delete on public.customer_home_records to authenticated;
