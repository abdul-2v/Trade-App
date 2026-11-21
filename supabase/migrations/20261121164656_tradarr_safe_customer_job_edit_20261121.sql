-- Safely edit a standard UK job only until the first invitation has been sent.
-- SECURITY INVOKER preserves existing customer-only UPDATE and SELECT RLS.
create or replace function public.tradarr_customer_edit_uninvited_job(
 p_job_id uuid,p_issue text,p_location_label text,p_latitude double precision,
 p_longitude double precision,p_timing text,p_requested_start timestamptz,
 p_requested_end timestamptz
) returns uuid language plpgsql security invoker set search_path=''
as $function$
declare v_updated uuid;
begin
 if (select auth.uid()) is null then
  raise exception 'Sign in to edit your job' using errcode='42501';
 end if;
 if p_job_id is null
  or char_length(btrim(coalesce(p_issue,''))) not between 17 and 1000
  or char_length(btrim(coalesce(p_location_label,''))) not between 4 and 12
  or p_latitude is null or p_latitude not between -90 and 90
  or p_longitude is null or p_longitude not between -180 and 180
  or p_timing not in ('ASAP','Flexible','Scheduled')
 then
  raise exception 'Enter a valid description, postcode, and timing' using errcode='22023';
 end if;
 if p_timing='Scheduled' then
  if p_requested_start is null or p_requested_end is null
   or p_requested_start < now() + interval '15 minutes'
   or p_requested_end <> p_requested_start + interval '2 hours' then
   raise exception 'Choose a two-hour request window at least 15 minutes ahead'
    using errcode='22023';
  end if;
 elsif p_requested_start is not null or p_requested_end is not null then
  raise exception 'Flexible and urgent requests cannot carry a reserved date'
   using errcode='22023';
 end if;
 update public.jobs j set
  issue=btrim(p_issue),location_label=upper(btrim(p_location_label)),
  latitude=p_latitude,longitude=p_longitude,timing=p_timing,
  requested_start=p_requested_start,requested_end=p_requested_end,updated_at=now()
 where j.id=p_job_id
  and j.customer_id=(select auth.uid())
  and j.job_mode='normal'
  and j.status='posted'
  and j.accepted_tradesperson_id is null
  and not exists(select 1 from public.job_offers o where o.job_id=j.id)
 returning j.id into v_updated;
 if v_updated is null then
  raise exception 'This job cannot be edited after invitations have been sent. Cancel it and post a new request.'
   using errcode='42501';
 end if;
 return v_updated;
end $function$;
revoke all on function public.tradarr_customer_edit_uninvited_job(
 uuid,text,text,double precision,double precision,text,timestamptz,timestamptz)
 from public,anon;
grant execute on function public.tradarr_customer_edit_uninvited_job(
 uuid,text,text,double precision,double precision,text,timestamptz,timestamptz)
 to authenticated;
