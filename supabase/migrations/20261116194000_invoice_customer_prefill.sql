-- Restrict prefill of job customer identity/address to the accepted tradesperson.
-- Do not broaden the profiles SELECT RLS policy.
create or replace function public.trade_invoice_customer_details()
returns table (
  source_kind text,
  source_id uuid,
  customer_name text,
  billing_address text
)
language sql stable security definer
set search_path = ''
as $$
  select 'job'::text, j.id,
    trim(concat_ws(' ', nullif(p.first_name, ''), nullif(p.last_name, '')))::text,
    coalesce(nullif(p.default_address, ''), j.location_label, '')::text
  from public.jobs j
  join public.profiles p on p.id = j.customer_id
  where j.accepted_tradesperson_id = (select auth.uid())
  union all
  select 'urgent'::text, r.id,
    trim(concat_ws(' ', nullif(p.first_name, ''), nullif(p.last_name, '')))::text,
    coalesce(nullif(p.default_address, ''), r.location_label, '')::text
  from public.urgent_requests r
  join public.profiles p on p.id = r.customer_id
  where r.accepted_tradesperson_id = (select auth.uid());
$$;
revoke all on function public.trade_invoice_customer_details() from public, anon;
grant execute on function public.trade_invoice_customer_details() to authenticated;
