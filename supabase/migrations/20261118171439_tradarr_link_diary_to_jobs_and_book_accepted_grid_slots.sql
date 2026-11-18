
alter table public.trade_appointments
 add column if not exists grid_request_id uuid references public.trade_grid_requests(id) on delete set null;
create unique index if not exists tradarr_diary_one_per_grid_request
 on public.trade_appointments(grid_request_id) where grid_request_id is not null;

create or replace function trade_private.tradarr_appointment_link_guard()
returns trigger language plpgsql set search_path='' as $$
declare v_job record;
begin
 if tg_op='UPDATE' and old.job_id is not null then
   if new.job_id is distinct from old.job_id or new.tradesperson_id is distinct from old.tradesperson_id then
     raise exception 'Cannot reassign an accepted booking' using errcode='42501';
   end if;
   if (new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at
       or new.status is distinct from old.status) and pg_trigger_depth() <= 1 then
     raise exception 'A confirmed Tradarr booking must be changed through the agreed request or job status'
       using errcode='42501';
   end if;
 end if;
 if new.job_id is not null then
   select accepted_tradesperson_id,status into v_job from public.jobs where id=new.job_id;
   if not found or v_job.accepted_tradesperson_id is distinct from new.tradesperson_id
     or v_job.status not in ('accepted','en_route','arrived','in_progress','completed') then
     raise exception 'This job is not accepted by the appointment owner' using errcode='42501';
   end if;
 end if;
 return new;
end $$;
drop trigger if exists tradarr_appointment_link_guard on public.trade_appointments;
create trigger tradarr_appointment_link_guard
before insert or update on public.trade_appointments
for each row execute function trade_private.tradarr_appointment_link_guard();

create or replace function trade_private.tradarr_link_diary_to_accepted_job()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.job_id is not null then
  update public.jobs set appointment_id=new.id,requested_start=new.starts_at,
    requested_end=new.ends_at,updated_at=now()
    where id=new.job_id and accepted_tradesperson_id=new.tradesperson_id
      and appointment_id is distinct from new.id;
 end if;
 return null;
end $$;
revoke all on function trade_private.tradarr_link_diary_to_accepted_job() from public,anon,authenticated;
drop trigger if exists tradarr_link_diary_to_accepted_job on public.trade_appointments;
create trigger tradarr_link_diary_to_accepted_job after insert on public.trade_appointments
for each row execute function trade_private.tradarr_link_diary_to_accepted_job();

-- Grid slot acceptance is a genuine reserved appointment, not just a status change.
create or replace function public.tradarr_grid_book_slot()
returns trigger language plpgsql set search_path='' as $$
declare v_slot record;
begin
 if new.status='accepted' and old.status is distinct from 'accepted' then
  update public.trade_grid_slots set status='booked'
    where id=new.slot_id and status='open'
      and tradesperson_id=(select auth.uid()) and starts_at>now()
   returning * into v_slot;
  if not found then raise exception 'This availability window is no longer open' using errcode='23514'; end if;
  insert into public.trade_appointments
   (tradesperson_id,grid_request_id,title,starts_at,ends_at,status,notes)
  values (v_slot.tradesperson_id,new.id,
   substring(coalesce(nullif(new.summary,''),'Grid visit') for 180),
   v_slot.starts_at,v_slot.ends_at,'scheduled',
   'Accepted Grid booking. Confirm exact address and price directly with the customer.');
 end if;
 return new;
end $$;

