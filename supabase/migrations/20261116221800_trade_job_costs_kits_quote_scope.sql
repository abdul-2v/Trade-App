-- Tradarr: private per-job expenses, materials kits, quote scope and optional upgrades.
create table if not exists public.trade_job_costs (
 id uuid primary key default gen_random_uuid(),
 tradesperson_id uuid not null references public.tradesperson_profiles(user_id) on delete cascade,
 invoice_id uuid references public.trade_invoices(id) on delete set null,
 quote_id uuid references public.trade_quotes(id) on delete set null,
 project_label text,
 category text not null check(category in ('materials','labour','travel','subcontractor','other')),
 description text not null check(char_length(btrim(description)) between 1 and 300),
 amount numeric(12,2) not null check(amount >= 0 and amount <= 1000000),
 spent_on date not null default current_date,
 created_at timestamptz not null default now(),
 check(not(invoice_id is not null and quote_id is not null))
);
create index if not exists trade_job_costs_owner_idx on public.trade_job_costs(tradesperson_id,spent_on desc);
create index if not exists trade_job_costs_invoice_idx on public.trade_job_costs(invoice_id);
create index if not exists trade_job_costs_quote_idx on public.trade_job_costs(quote_id);
create table if not exists public.trade_material_kits(
 id uuid primary key default gen_random_uuid(),
 tradesperson_id uuid not null references public.tradesperson_profiles(user_id) on delete cascade,
 name text not null check(char_length(btrim(name)) between 1 and 200),
 job_address text,
 items jsonb not null default '[]'::jsonb check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=150),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists trade_material_kits_owner_idx on public.trade_material_kits(tradesperson_id,created_at desc);
alter table public.trade_quotes add column if not exists scope_included text;
alter table public.trade_quotes add column if not exists scope_excluded text;
alter table public.trade_quotes add column if not exists estimated_duration text;
alter table public.trade_quotes add column if not exists deposit_percent numeric(5,2) not null default 0 check(deposit_percent between 0 and 100);
alter table public.trade_quotes add column if not exists optional_extras jsonb not null default '[]'::jsonb check(jsonb_typeof(optional_extras)='array' and jsonb_array_length(optional_extras)<=15);
alter table public.trade_quotes add column if not exists estimated_cost numeric(12,2);
alter table public.trade_quotes add column if not exists target_margin numeric(5,2);
alter table public.trade_quotes add constraint trade_quotes_estimated_cost_valid check(estimated_cost is null or estimated_cost>=0);
alter table public.trade_quotes add constraint trade_quotes_target_margin_valid check(target_margin is null or target_margin between 0 and 90);
alter table public.trade_job_costs enable row level security;
alter table public.trade_material_kits enable row level security;
drop policy if exists "Owner sees expenses" on public.trade_job_costs;
drop policy if exists "Owner creates expenses" on public.trade_job_costs;
drop policy if exists "Owner deletes expenses" on public.trade_job_costs;
create policy "Owner sees expenses" on public.trade_job_costs for select to authenticated using(tradesperson_id=(select auth.uid()));
create policy "Owner creates expenses" on public.trade_job_costs for insert to authenticated
 with check(tradesperson_id=(select auth.uid())
 and (invoice_id is null or exists(select 1 from public.trade_invoices i where i.id=invoice_id and i.tradesperson_id=(select auth.uid())))
 and (quote_id is null or exists(select 1 from public.trade_quotes q where q.id=quote_id and q.tradesperson_id=(select auth.uid()))));
create policy "Owner deletes expenses" on public.trade_job_costs for delete to authenticated using(tradesperson_id=(select auth.uid()));
grant select,insert,delete on public.trade_job_costs to authenticated;
drop policy if exists "Owner sees kits" on public.trade_material_kits;
drop policy if exists "Owner creates kits" on public.trade_material_kits;
drop policy if exists "Owner edits kits" on public.trade_material_kits;
drop policy if exists "Owner deletes kits" on public.trade_material_kits;
create policy "Owner sees kits" on public.trade_material_kits for select to authenticated using(tradesperson_id=(select auth.uid()));
create policy "Owner creates kits" on public.trade_material_kits for insert to authenticated with check(tradesperson_id=(select auth.uid()));
create policy "Owner edits kits" on public.trade_material_kits for update to authenticated
 using(tradesperson_id=(select auth.uid())) with check(tradesperson_id=(select auth.uid()));
create policy "Owner deletes kits" on public.trade_material_kits for delete to authenticated using(tradesperson_id=(select auth.uid()));
grant select,insert,update,delete on public.trade_material_kits to authenticated;

-- Tie a shopping checklist back to the source quote, with one list per quote.
alter table public.trade_material_kits add column if not exists source_quote_id uuid references public.trade_quotes(id) on delete set null;
create unique index if not exists trade_material_kits_quote_unique on public.trade_material_kits(tradesperson_id,source_quote_id) where source_quote_id is not null;
drop policy if exists "Owner creates kits" on public.trade_material_kits;
create policy "Owner creates kits" on public.trade_material_kits for insert to authenticated
with check(tradesperson_id=(select auth.uid())
 and (source_quote_id is null or exists(select 1 from public.trade_quotes q
  where q.id=source_quote_id and q.tradesperson_id=(select auth.uid()))));
drop policy if exists "Owner edits kits" on public.trade_material_kits;
create policy "Owner edits kits" on public.trade_material_kits for update to authenticated
using(tradesperson_id=(select auth.uid()))
with check(tradesperson_id=(select auth.uid())
 and (source_quote_id is null or exists(select 1 from public.trade_quotes q
  where q.id=source_quote_id and q.tradesperson_id=(select auth.uid()))));
