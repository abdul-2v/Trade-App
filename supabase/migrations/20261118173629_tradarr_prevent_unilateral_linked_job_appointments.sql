
-- App users cannot unilaterally mark a matched job as booked by inserting a diary row.
-- Linked appointments must originate from a customer-approved time proposal,
-- existing accepted timed job, or accepted Grid request.
create or replace function trade_private.tradarr_guard_direct_appointment_link()
returns trigger language plpgsql set search_path='' as $$
begin
 if (new.job_id is not null or new.grid_request_id is not null)
   and pg_trigger_depth()<=1 then
   raise exception 'Linked appointments must be created by an accepted booking or mutual time approval'
     using errcode='42501';
 end if;
 return new;
end $$;
drop trigger if exists tradarr_guard_direct_appointment_link on public.trade_appointments;
create trigger tradarr_guard_direct_appointment_link before insert
on public.trade_appointments for each row
execute function trade_private.tradarr_guard_direct_appointment_link();

