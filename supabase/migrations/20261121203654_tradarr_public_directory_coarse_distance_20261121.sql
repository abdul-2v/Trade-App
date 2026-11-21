-- Public location privacy refinement: only outward postcode district or generic area label;
-- distance is a five-mile bucket, not a triangulatable 0.1-mile coordinate estimate.
CREATE OR REPLACE FUNCTION public.tradarr_public_find_trades(p_lat double precision, p_lng double precision, p_trade text DEFAULT NULL::text, p_radius integer DEFAULT 15, p_limit integer DEFAULT 40)
 RETURNS TABLE(trader_id uuid, display_name text, trade text, summary text, work_area text, verified boolean, rating numeric, review_count integer, distance_miles numeric)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
 select
  t.user_id as trader_id,
  left(coalesce(nullif(btrim(t.business_name),''),nullif(btrim(t.display_name),''),'Trade business'),100) as display_name,
  t.primary_trade as trade,
  left(coalesce(t.bio,''),200) as summary,
  case when upper(btrim(coalesce(a.work_area_label,''))) ~ '^[A-Z]{1,2}[0-9]'
   then substring(upper(btrim(a.work_area_label)) from '^[A-Z]{1,2}[0-9][A-Z0-9]?')
   else 'UK work area'::text
  end as work_area,
  t.is_verified as verified,
  case when t.review_count>0 then round(t.rating,1) else null::numeric end as rating,
  greatest(t.review_count,0) as review_count,
  (greatest(1.0,ceil(d.miles/5.0))*5)::numeric as distance_miles
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
$function$
