-- Public, limited browsing of published trade work areas for the Tradarr website.
-- SECURITY INVOKER preserves the existing RLS policy on both joined tables.
-- Do not expose exact coordinates, street addresses, private account phone numbers or GPS.
create or replace function public.tradarr_public_find_trades(
 p_lat double precision,
 p_lng double precision,
 p_trade text default null,
 p_radius integer default 15,
 p_limit integer default 40
)
returns table (
 trader_id uuid,
 display_name text,
 trade text,
 summary text,
 work_area text,
 verified boolean,
 rating numeric,
 review_count integer,
 distance_miles numeric
)
language sql
stable
security invoker
set search_path to ''
as $function$
 select
  t.user_id as trader_id,
  left(coalesce(nullif(btrim(t.business_name),''),nullif(btrim(t.display_name),''),'Trade business'),100) as display_name,
  t.primary_trade as trade,
  left(coalesce(t.bio,''),200) as summary,
  case when upper(btrim(coalesce(a.work_area_label,''))) ~ '^[A-Z]{1,2}[0-9]'
   then substring(upper(btrim(a.work_area_label)) from '^[A-Z]{1,2}[0-9][A-Z0-9]?')
   else left(btrim(a.work_area_label),40)
  end as work_area,
  t.is_verified as verified,
  case when t.review_count>0 then round(t.rating,1) else null::numeric end as rating,
  greatest(t.review_count,0) as review_count,
  round((d.miles)::numeric,1) as distance_miles
 from public.tradesperson_profiles t
 join public.trade_availability a on a.user_id=t.user_id
 cross join lateral (
   select (3958.7613*acos(least(1.0,greatest(-1.0,
    sin(radians(p_lat))*sin(radians(a.work_area_latitude))
    +cos(radians(p_lat))*cos(radians(a.work_area_latitude))
     *cos(radians(a.work_area_longitude-p_lng))
   )))) as miles
 ) d
 where p_lat between 49.5 and 59.5
   and p_lng between -8.8 and 2.5
   and p_radius in (5,10,15,25,50)
   and p_limit between 1 and 40
   and a.location_mode='work_area'
   and a.work_area_latitude between 49.5 and 59.5
   and a.work_area_longitude between -8.8 and 2.5
   and nullif(btrim(a.work_area_label),'') is not null
   and nullif(btrim(t.primary_trade),'') is not null
   and (p_trade is null or p_trade='All trades' or t.primary_trade=p_trade)
   and d.miles<=least(p_radius::double precision,a.service_radius_miles::double precision)
 order by d.miles asc,t.is_verified desc,t.user_id
 limit p_limit;
$function$;
revoke all on function public.tradarr_public_find_trades(
 double precision,double precision,text,integer,integer) from public;
grant execute on function public.tradarr_public_find_trades(
 double precision,double precision,text,integer,integer) to anon,authenticated;
