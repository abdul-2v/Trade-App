-- Trade invoices: per-tradesperson numbering, snapshots, linked jobs and private RLS.
-- Deployed on 16 Nov 2026 to the Tradarr Supabase project.
create schema if not exists trade_private;
revoke all on schema trade_private from public, anon, authenticated;
create table if not exists trade_private.invoice_counters (
  tradesperson_id uuid primary key references public.tradesperson_profiles(user_id) on delete cascade,
  last_number integer not null default 0
);
create table if not exists public.trade_invoices (
  id uuid primary key default gen_random_uuid(),
  tradesperson_id uuid not null references public.tradesperson_profiles(user_id) on delete cascade,
  invoice_no integer not null,
  source text not null default 'external' check (source in ('external','app')),
  app_job_id uuid references public.jobs(id) on delete set null,
  urgent_request_id uuid references public.urgent_requests(id) on delete set null,
  business_name text not null check (char_length(trim(business_name)) > 0),
  business_legal_name text,
  business_address text not null check (char_length(trim(business_address)) > 0),
  business_email text,
  business_phone text,
  vat_number text,
  customer_name text not null check (char_length(trim(customer_name)) > 0),
  customer_address text not null check (char_length(trim(customer_address)) > 0),
  customer_email text,
  description text,
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  invoice_date date not null,
  service_date date not null,
  due_date date not null,
  vat_rate numeric(5,2) not null default 0 check (vat_rate in (0,5,20)),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  vat_amount numeric(12,2) not null default 0 check (vat_amount >= 0),
  total numeric(12,2) not null check (total >= 0),
  payment_details text,
  notes text,
  status text not null default 'draft' check (status in ('draft','sent','paid','void')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tradesperson_id, invoice_no),
  check (not (app_job_id is not null and urgent_request_id is not null))
);
create index if not exists trade_invoices_owner_created_idx on public.trade_invoices (tradesperson_id, created_at desc);
create or replace function trade_private.assign_invoice_no()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  if new.tradesperson_id is distinct from auth.uid() then
    raise exception 'Cannot create invoice for another tradesperson';
  end if;
  insert into trade_private.invoice_counters (tradesperson_id, last_number)
  values (new.tradesperson_id, 1)
  on conflict (tradesperson_id)
  do update set last_number = trade_private.invoice_counters.last_number + 1
  returning last_number into new.invoice_no;
  return new;
end;
$$;
revoke execute on function trade_private.assign_invoice_no() from public, anon, authenticated;
drop trigger if exists trade_invoice_assign_number on public.trade_invoices;
create trigger trade_invoice_assign_number
before insert on public.trade_invoices
for each row execute function trade_private.assign_invoice_no();

alter table public.trade_invoices enable row level security;
drop policy if exists "Invoices owner read" on public.trade_invoices;
drop policy if exists "Invoices owner insert" on public.trade_invoices;
drop policy if exists "Invoices owner update" on public.trade_invoices;
create policy "Invoices owner read" on public.trade_invoices
for select to authenticated using (tradesperson_id = (select auth.uid()));
create policy "Invoices owner insert" on public.trade_invoices
for insert to authenticated with check (
  tradesperson_id = (select auth.uid())
  and exists (select 1 from public.tradesperson_profiles tp where tp.user_id = (select auth.uid()))
  and (
    source = 'external' and app_job_id is null and urgent_request_id is null
    or
    source = 'app' and (
      (app_job_id is not null and exists (
        select 1 from public.jobs j where j.id = app_job_id
        and j.accepted_tradesperson_id = (select auth.uid())
      ))
      or
      (urgent_request_id is not null and exists (
        select 1 from public.urgent_requests j where j.id = urgent_request_id
        and j.accepted_tradesperson_id = (select auth.uid())
      ))
    )
  )
);
create policy "Invoices owner update" on public.trade_invoices
for update to authenticated using (tradesperson_id = (select auth.uid()))
with check (tradesperson_id = (select auth.uid()));
grant select, insert, update on public.trade_invoices to authenticated;
