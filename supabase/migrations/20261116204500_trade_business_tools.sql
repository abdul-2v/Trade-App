-- Tradarr business tools: customer book, estimates and private work diary.
-- All records are owned by a tradesperson and protected by RLS.

create table if not exists public.trade_customers (
  id uuid primary key default gen_random_uuid(),
  tradesperson_id uuid not null references public.tradesperson_profiles(user_id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trade_customers_owner_name_idx on public.trade_customers(tradesperson_id, name);

create table if not exists trade_private.quote_counters (
  tradesperson_id uuid primary key references public.tradesperson_profiles(user_id) on delete cascade,
  last_number integer not null default 0
);
create table if not exists public.trade_quotes (
  id uuid primary key default gen_random_uuid(),
  tradesperson_id uuid not null references public.tradesperson_profiles(user_id) on delete cascade,
  quote_no integer not null,
  customer_id uuid references public.trade_customers(id) on delete set null,
  business_name text not null check (length(btrim(business_name)) > 0),
  business_address text not null check (length(btrim(business_address)) > 0),
  business_email text,
  business_phone text,
  vat_number text,
  customer_name text not null check (length(btrim(customer_name)) > 0),
  customer_address text not null check (length(btrim(customer_address)) > 0),
  customer_email text,
  customer_phone text,
  title text not null check (length(btrim(title)) > 0),
  description text,
  items jsonb not null check (jsonb_typeof(items)='array' and jsonb_array_length(items)>0),
  quote_date date not null default current_date,
  valid_until date not null,
  vat_rate numeric(5,2) not null default 0 check (vat_rate in (0,5,20)),
  subtotal numeric(12,2) not null check (subtotal > 0),
  vat_amount numeric(12,2) not null default 0 check (vat_amount >= 0),
  total numeric(12,2) not null check (total > 0),
  notes text,
  status text not null default 'draft' check (status in ('draft','sent','accepted','declined','converted')),
  invoice_id uuid references public.trade_invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tradesperson_id, quote_no),
  unique(invoice_id),
  check(valid_until >= quote_date)
);
create index if not exists trade_quotes_owner_recent_idx on public.trade_quotes(tradesperson_id, created_at desc);
create index if not exists trade_quotes_owner_customer_idx on public.trade_quotes(tradesperson_id, customer_id);

create or replace function trade_private.assign_quote_no()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  if new.tradesperson_id is distinct from auth.uid() then
    raise exception 'Only the owner can create quotes';
  end if;
  insert into trade_private.quote_counters(tradesperson_id,last_number)
  values(new.tradesperson_id,1)
  on conflict(tradesperson_id)
  do update set last_number=trade_private.quote_counters.last_number+1
  returning last_number into new.quote_no;
  return new;
end;
$$;
revoke execute on function trade_private.assign_quote_no() from public, anon, authenticated;
drop trigger if exists quote_assign_number on public.trade_quotes;
create trigger quote_assign_number before insert on public.trade_quotes
for each row execute function trade_private.assign_quote_no();

create table if not exists public.trade_appointments (
  id uuid primary key default gen_random_uuid(),
  tradesperson_id uuid not null references public.tradesperson_profiles(user_id) on delete cascade,
  customer_id uuid references public.trade_customers(id) on delete set null,
  title text not null check(length(btrim(title)) between 1 and 240),
  customer_name text,
  address text,
  notes text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check(status in ('scheduled','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at > starts_at)
);
create index if not exists trade_appointments_owner_date_idx on public.trade_appointments(tradesperson_id, starts_at);

-- Add a quote reference so converted invoices can be traced back without duplicating work.
alter table public.trade_invoices
  add column if not exists quote_id uuid references public.trade_quotes(id) on delete set null;
create unique index if not exists trade_invoices_quote_once_idx
  on public.trade_invoices(quote_id) where quote_id is not null;

-- Client-recorded customer_id values may only point to a record the same owner controls.
create or replace function trade_private.same_owner_customer(p_customer_id uuid, p_owner uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_customer_id is null or exists(
    select 1 from public.trade_customers c where c.id=p_customer_id and c.tradesperson_id=p_owner
  );
$$;
revoke execute on function trade_private.same_owner_customer(uuid,uuid) from public, anon;
grant execute on function trade_private.same_owner_customer(uuid,uuid) to authenticated;

alter table public.trade_customers enable row level security;
alter table public.trade_quotes enable row level security;
alter table public.trade_appointments enable row level security;

drop policy if exists trade_customers_read on public.trade_customers;
drop policy if exists trade_customers_create on public.trade_customers;
drop policy if exists trade_customers_edit on public.trade_customers;
drop policy if exists trade_customers_delete on public.trade_customers;
create policy trade_customers_read on public.trade_customers for select to authenticated
using(tradesperson_id=(select auth.uid()));
create policy trade_customers_create on public.trade_customers for insert to authenticated
with check(tradesperson_id=(select auth.uid()));
create policy trade_customers_edit on public.trade_customers for update to authenticated
using(tradesperson_id=(select auth.uid())) with check(tradesperson_id=(select auth.uid()));
create policy trade_customers_delete on public.trade_customers for delete to authenticated
using(tradesperson_id=(select auth.uid()));

drop policy if exists trade_quotes_read on public.trade_quotes;
drop policy if exists trade_quotes_create on public.trade_quotes;
drop policy if exists trade_quotes_edit on public.trade_quotes;
create policy trade_quotes_read on public.trade_quotes for select to authenticated
using(tradesperson_id=(select auth.uid()));
create policy trade_quotes_create on public.trade_quotes for insert to authenticated
with check(
  tradesperson_id=(select auth.uid())
  and trade_private.same_owner_customer(customer_id, tradesperson_id)
);
create policy trade_quotes_edit on public.trade_quotes for update to authenticated
using(tradesperson_id=(select auth.uid()))
with check(tradesperson_id=(select auth.uid()));

drop policy if exists trade_appointments_read on public.trade_appointments;
drop policy if exists trade_appointments_create on public.trade_appointments;
drop policy if exists trade_appointments_edit on public.trade_appointments;
drop policy if exists trade_appointments_delete on public.trade_appointments;
create policy trade_appointments_read on public.trade_appointments for select to authenticated
using(tradesperson_id=(select auth.uid()));
create policy trade_appointments_create on public.trade_appointments for insert to authenticated
with check(
  tradesperson_id=(select auth.uid())
  and trade_private.same_owner_customer(customer_id,tradesperson_id)
);
create policy trade_appointments_edit on public.trade_appointments for update to authenticated
using(tradesperson_id=(select auth.uid()))
with check(
  tradesperson_id=(select auth.uid())
  and trade_private.same_owner_customer(customer_id,tradesperson_id)
);
create policy trade_appointments_delete on public.trade_appointments for delete to authenticated
using(tradesperson_id=(select auth.uid()));

grant select,insert,update,delete on public.trade_customers to authenticated;
grant select,insert,delete on public.trade_quotes to authenticated;
grant update(status,invoice_id,updated_at) on public.trade_quotes to authenticated;
grant select,insert,update,delete on public.trade_appointments to authenticated;

drop policy if exists "Invoices owner insert" on public.trade_invoices;
create policy "Invoices owner insert" on public.trade_invoices for insert to authenticated
with check (
  tradesperson_id = (select auth.uid())
  and exists (select 1 from public.tradesperson_profiles tp where tp.user_id = (select auth.uid()))
  and (quote_id is null or exists (
    select 1 from public.trade_quotes q where q.id=quote_id and q.tradesperson_id=(select auth.uid())
  ))
  and (
    (source = 'external' and app_job_id is null and urgent_request_id is null)
    or (source = 'app' and (
      (app_job_id is not null and exists (select 1 from public.jobs j
        where j.id=app_job_id and j.accepted_tradesperson_id=(select auth.uid())))
      or (urgent_request_id is not null and exists (select 1 from public.urgent_requests j
        where j.id=urgent_request_id and j.accepted_tradesperson_id=(select auth.uid())))
    ))
  )
);
