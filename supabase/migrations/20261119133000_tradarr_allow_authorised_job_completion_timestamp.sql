create or replace function trade_private.tradarr_guard_client_job_update()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid := (select auth.uid()); internal_write boolean := current_user in ('postgres','service_role');
begin
 if internal_write then return new; end if;
 if actor is null then raise exception 'Sign in to modify a job' using errcode='42501'; end if;
 if new.id is distinct from old.id or new.customer_id is distinct from old.customer_id
  or new.trade is distinct from old.trade
  or new.accepted_at is distinct from old.accepted_at
  or new.appointment_id is distinct from old.appointment_id
  or new.requested_start is distinct from old.requested_start
  or new.requested_end is distinct from old.requested_end then
   raise exception 'Job ownership and confirmed scheduling fields cannot be changed directly'
    using errcode='42501';
 end if;
 if new.completed_at is distinct from old.completed_at then
  if new.status='completed' and old.status='in_progress'
    and actor=old.accepted_tradesperson_id then
    new.completed_at:=now();
  else
    raise exception 'Only completed jobs can receive a completion timestamp'
      using errcode='42501';
  end if;
 end if;
 if new.accepted_tradesperson_id is distinct from old.accepted_tradesperson_id and
    not (old.accepted_tradesperson_id is null and old.status in ('posted','offered')
         and new.status='accepted' and new.accepted_tradesperson_id=actor) then
   raise exception 'Assigned tradesperson cannot be changed' using errcode='42501';
 end if;
 if old.status not in ('posted','offered') and
    (new.issue is distinct from old.issue
     or new.job_mode is distinct from old.job_mode
     or new.timing is distinct from old.timing
     or new.latitude is distinct from old.latitude
     or new.longitude is distinct from old.longitude
     or new.location_label is distinct from old.location_label
     or new.standard_price is distinct from old.standard_price
     or new.route_price is distinct from old.route_price
     or new.detour_minutes is distinct from old.detour_minutes
     or new.preferred_tradesperson_id is distinct from old.preferred_tradesperson_id) then
   raise exception 'Accepted job details cannot be silently changed' using errcode='42501';
 end if;

 if new.status is distinct from old.status then
  if actor=old.customer_id and new.status='cancelled' and
   old.status in ('posted','offered','accepted','en_route') then return new; end if;
  if actor=old.accepted_tradesperson_id and
   ((old.status='accepted' and new.status='en_route') or
    (old.status='en_route' and new.status='arrived') or
    (old.status='arrived' and new.status='in_progress') or
    (old.status='in_progress' and new.status='completed')) then return new; end if;
  if old.accepted_tradesperson_id is null and actor=new.accepted_tradesperson_id and
     old.status in ('posted','offered') and new.status='accepted' then return new; end if;
  if actor=old.customer_id and old.status in ('posted','offered') and
      new.status in ('posted','offered') then return new; end if;
  raise exception 'Invalid job transition for this account' using errcode='42501';
 end if;
 return new;
end $$;
