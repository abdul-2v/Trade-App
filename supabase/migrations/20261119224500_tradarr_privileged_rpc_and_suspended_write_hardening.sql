-- Tighten remaining operational write paths and the legacy privileged RPC endpoints.
do $$
declare t text;
begin
 foreach t in array array[
 'urgent_request_offers','trade_locations','trade_map_presence',
 'trade_working_hours','trade_appointment_changes','trade_customers',
 'trade_job_costs','trade_material_kits','customer_properties',
 'customer_home_records','customer_firstfix_briefs','customer_price_checks',
 'customer_onejob_projects','saved_tradespeople','job_reviews','market_job_reviews',
 'job_locations','urgent_request_locations'
 ] loop
  execute format('drop trigger if exists tradarr_suspended_user_write on public.%I',t);
  execute format('create trigger tradarr_suspended_user_write before insert or update on public.%I for each row execute function trade_private.tradarr_block_suspended_writes()',t);
 end loop;
end $$;

-- Force all privileged legacy APIs to be authenticated rather than inherited PUBLIC.
revoke all on function public.tradarr_observed_job_prices(text) from public,anon;
revoke all on function public.tradarr_suggest_booking_slots(uuid,date,integer) from public,anon;
revoke all on function public.trade_invoice_customer_details() from public,anon;
grant execute on function public.tradarr_observed_job_prices(text) to authenticated;
grant execute on function public.tradarr_suggest_booking_slots(uuid,date,integer) to authenticated;
grant execute on function public.trade_invoice_customer_details() to authenticated;

-- Billing details are legitimately visible only to the trade that accepted the
-- specific job. Do not return broad customer profile listings.
create or replace function public.trade_invoice_customer_details()
returns table(source_kind text, source_id uuid, customer_name text, billing_address text)
language sql stable security definer set search_path='' as $$
 select 'job'::text, j.id,
  trim(concat_ws(' ',nullif(p.first_name,''),nullif(p.last_name,'')))::text,
  coalesce(nullif(p.default_address,''),j.location_label,'')::text
 from public.jobs j join public.profiles p on p.id=j.customer_id
 where (select auth.uid()) is not null
  and j.accepted_tradesperson_id=(select auth.uid())
  and j.status in ('accepted','en_route','arrived','in_progress','completed')
 union all
 select 'urgent'::text,r.id,
  trim(concat_ws(' ',nullif(p.first_name,''),nullif(p.last_name,'')))::text,
  coalesce(nullif(p.default_address,''),r.location_label,'')::text
 from public.urgent_requests r join public.profiles p on p.id=r.customer_id
 where (select auth.uid()) is not null
  and r.accepted_tradesperson_id=(select auth.uid())
  and r.status in ('matched','en_route','arrived','completed');
$$;
revoke all on function public.trade_invoice_customer_details() from public,anon;
grant execute on function public.trade_invoice_customer_details() to authenticated;

-- Minimum cohort of eight and a fixed published trade category. Suppress
-- unknown categories to avoid arbitrary data probing through invoice aggregates.
create or replace function public.tradarr_observed_job_prices(p_trade text)
returns table(sample_size bigint,lower_quartile numeric,median numeric,upper_quartile numeric)
language sql stable security definer set search_path='' as $$
 with eligible as (
  select i.app_job_id,sum(i.subtotal)::numeric job_amount
  from public.trade_invoices i join public.jobs j on j.id=i.app_job_id
  where (select auth.uid()) is not null and i.status='paid'
   and j.status='completed' and i.source='app' and i.app_job_id is not null
   and lower(btrim(j.trade))=lower(btrim(p_trade))
   and btrim(p_trade) in ('Plumber','Electrician','Builder','Heating','Locksmith','Carpenter','Roofer')
   and i.subtotal>0 and j.completed_at>=now()-interval '24 months'
  group by i.app_job_id
 ),stats as (
  select count(*)::bigint n,
   percentile_cont(0.25) within group(order by job_amount)::numeric q1,
   percentile_cont(0.5) within group(order by job_amount)::numeric mid,
   percentile_cont(0.75) within group(order by job_amount)::numeric q3
  from eligible
 ) select n,round(q1,0),round(mid,0),round(q3,0) from stats where n>=8;
$$;
revoke all on function public.tradarr_observed_job_prices(text) from public,anon;
grant execute on function public.tradarr_observed_job_prices(text) to authenticated;
