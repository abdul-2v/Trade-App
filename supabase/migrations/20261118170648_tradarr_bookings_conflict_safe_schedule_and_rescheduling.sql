
-- Tradarr bookings: reserve real time windows, never silently double-book.
alter table public.jobs
  add column if not exists requested_start timestamptz,
  add column if not exists requested_end timestamptz,
  add column if not exists appointment_id uuid;
alter table public.trade_appointments
  add column if not exists job_id uuid references public.jobs(id) on delete set null;
create unique index if not exists trade_appointments_one_per_job
  on public.trade_appointments(job_id) where job_id is not null;
create index if not exists trade_appointments_trade_time_idx
  on public.trade_appointments(tradesperson_id, starts_at, ends_at)
  where status = 'scheduled';
do $$ begin
  if not exists (select 1 from pg_constraint where conname='jobs_requested_window_valid') then
    alter table public.jobs add constraint jobs_requested_window_valid
    check ((requested_start is null and requested_end is null)
      or (requested_start is not null and requested_end is not null
        and requested_end > requested_start
        and requested_end <= requested_start + interval '12 hours'));
  end if;
end $$;

create or replace function trade_private.tradarr_check_appointment_window()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.ends_at <= new.starts_at or new.ends_at > new.starts_at + interval '12 hours' then
   raise exception 'Appointment duration must be between 1 minute and 12 hours.' using errcode='22023';
 end if;
 if new.status = 'scheduled' then
   if new.starts_at < now() - interval '2 minutes' then
     raise exception 'Cannot schedule an appointment in the past.' using errcode='22023';
   end if;
   perform pg_advisory_xact_lock(hashtextextended(new.tradesperson_id::text,913));
   if exists (
     select 1 from public.trade_appointments a
     where a.tradesperson_id=new.tradesperson_id
       and a.status='scheduled'
       and a.id is distinct from new.id
       and a.starts_at < new.ends_at and a.ends_at > new.starts_at
   ) then
     raise exception 'This time overlaps an existing appointment. Please choose another time.'
       using errcode='23P01';
   end if;
 end if;
 return new;
end $$;
drop trigger if exists tradarr_appointment_check on public.trade_appointments;
create trigger tradarr_appointment_check before insert or update of starts_at,ends_at,status,tradesperson_id
on public.trade_appointments for each row execute function trade_private.tradarr_check_appointment_window();

-- A tradesperson's acceptance of a dated normal-job offer also reserves the slot.
-- Flexible/route requests without explicit times remain unconfirmed, never a fake booking.
create or replace function trade_private.tradarr_job_schedule_sync()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if new.status='accepted' and old.status is distinct from 'accepted'
    and new.accepted_tradesperson_id is not null and new.requested_start is not null then
   insert into public.trade_appointments
     (tradesperson_id,job_id,title,starts_at,ends_at,status,notes)
   values
     (new.accepted_tradesperson_id,new.id,substring(new.issue for 180),
      new.requested_start,new.requested_end,'scheduled',
      'Confirmed Tradarr job. Discuss access and pricing with the customer.')
   on conflict do nothing
   returning id into v_id;
   if v_id is null then
      select id into v_id from public.trade_appointments where job_id=new.id;
   end if;
   update public.jobs set appointment_id=v_id where id=new.id
     and appointment_id is distinct from v_id;
 elsif new.status in ('cancelled','completed') and old.status is distinct from new.status then
   update public.trade_appointments
      set status=case when new.status='cancelled' then 'cancelled' else 'completed' end,
          updated_at=now()
    where job_id=new.id and status='scheduled';
 end if;
 return null;
end $$;
revoke all on function trade_private.tradarr_job_schedule_sync() from public,anon,authenticated;
drop trigger if exists tradarr_job_schedule_sync on public.jobs;
create trigger tradarr_job_schedule_sync after update of status on public.jobs
for each row execute function trade_private.tradarr_job_schedule_sync();

-- Customer and provider negotiate rescheduling; proposer cannot approve own request.
create table if not exists public.trade_appointment_changes (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.jobs(id) on delete cascade,
 proposer_id uuid not null references auth.users(id) on delete cascade,
 proposed_start timestamptz not null,
 proposed_end timestamptz not null,
 status text not null default 'pending'
   check (status in ('pending','accepted','declined','withdrawn')),
 note text,
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 constraint tradarr_change_valid_window check (
   proposed_end > proposed_start
   and proposed_end <= proposed_start + interval '12 hours')
);
create unique index if not exists tradarr_one_pending_schedule_change
 on public.trade_appointment_changes(job_id) where status='pending';
create index if not exists tradarr_schedule_changes_job_idx
 on public.trade_appointment_changes(job_id,created_at desc);
alter table public.trade_appointment_changes enable row level security;
drop policy if exists tradarr_changes_participants_read on public.trade_appointment_changes;
create policy tradarr_changes_participants_read on public.trade_appointment_changes
 for select to authenticated using (
  exists (select 1 from public.jobs j where j.id=job_id
  and ((select auth.uid())=j.customer_id or (select auth.uid())=j.accepted_tradesperson_id))
 );
drop policy if exists tradarr_changes_participant_propose on public.trade_appointment_changes;
create policy tradarr_changes_participant_propose on public.trade_appointment_changes
 for insert to authenticated with check (
   proposer_id=(select auth.uid()) and status='pending'
   and proposed_start>now()
   and exists (select 1 from public.jobs j where j.id=job_id
      and j.status in ('accepted','en_route')
      and j.appointment_id is not null
      and ((select auth.uid())=j.customer_id or (select auth.uid())=j.accepted_tradesperson_id))
 );
drop policy if exists tradarr_changes_participant_review on public.trade_appointment_changes;
create policy tradarr_changes_participant_review on public.trade_appointment_changes
 for update to authenticated using (
  status='pending' and exists(select 1 from public.jobs j where j.id=job_id
   and ((select auth.uid())=j.customer_id or (select auth.uid())=j.accepted_tradesperson_id))
 ) with check (
  exists(select 1 from public.jobs j where j.id=job_id
   and ((select auth.uid())=j.customer_id or (select auth.uid())=j.accepted_tradesperson_id))
 );
grant select,insert,update on public.trade_appointment_changes to authenticated;

create or replace function trade_private.tradarr_appointment_change_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_job record;
begin
 if tg_op='UPDATE' then
   if old.status <> 'pending' or new.status not in ('accepted','declined','withdrawn')
     or row(new.id,new.job_id,new.proposer_id,new.proposed_start,new.proposed_end,new.note,new.created_at)
         is distinct from row(old.id,old.job_id,old.proposer_id,old.proposed_start,old.proposed_end,old.note,old.created_at) then
      raise exception 'Only the review decision may be changed' using errcode='42501';
   end if;
   if auth.uid() = old.proposer_id and new.status <> 'withdrawn' then
      raise exception 'Only the other participant can approve or decline a new time' using errcode='42501';
   end if;
   if auth.uid() <> old.proposer_id and new.status='withdrawn' then
      raise exception 'Only the proposer can withdraw their request' using errcode='42501';
   end if;
   select id,customer_id,accepted_tradesperson_id,appointment_id,status
     into v_job from public.jobs where id=new.job_id for update;
   if not found or auth.uid() not in (v_job.customer_id,v_job.accepted_tradesperson_id) then
     raise exception 'Not a participant in this booking' using errcode='42501';
   end if;
   if new.status='accepted' then
     if v_job.status not in ('accepted','en_route') or v_job.appointment_id is null then
       raise exception 'This booking can no longer be rescheduled' using errcode='23514';
     end if;
     update public.trade_appointments set starts_at=new.proposed_start,
       ends_at=new.proposed_end,updated_at=now()
       where id=v_job.appointment_id and status='scheduled';
     if not found then
       raise exception 'Booking appointment is not active' using errcode='23514';
     end if;
     update public.jobs set requested_start=new.proposed_start,
       requested_end=new.proposed_end,updated_at=now() where id=v_job.id;
   end if;
   new.reviewed_at:=now();
 end if;
 return new;
end $$;
revoke all on function trade_private.tradarr_appointment_change_review() from public,anon,authenticated;
drop trigger if exists tradarr_appointment_change_review on public.trade_appointment_changes;
create trigger tradarr_appointment_change_review before update on public.trade_appointment_changes
 for each row execute function trade_private.tradarr_appointment_change_review();

