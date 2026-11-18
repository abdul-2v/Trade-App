
-- An accepted flexible job is a match, not a booking. Its first time must
-- be proposed by one participant and accepted by the other.
drop policy if exists tradarr_changes_participant_propose on public.trade_appointment_changes;
create policy tradarr_changes_participant_propose on public.trade_appointment_changes
for insert to authenticated with check (
  proposer_id=(select auth.uid()) and status='pending'
  and proposed_start>now()+interval '5 minutes'
  and exists (
    select 1 from public.jobs j where j.id=job_id
    and j.status in ('accepted','en_route')
    and ((select auth.uid())=j.customer_id or (select auth.uid())=j.accepted_tradesperson_id)
  )
);

create or replace function trade_private.tradarr_appointment_change_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_job record;
begin
 if tg_op='UPDATE' then
   if old.status <> 'pending' or new.status not in ('accepted','declined','withdrawn')
     or row(new.id,new.job_id,new.proposer_id,new.proposed_start,new.proposed_end,new.note,new.created_at)
       is distinct from row(old.id,old.job_id,old.proposer_id,old.proposed_start,old.proposed_end,old.note,old.created_at)
   then
     raise exception 'Only the review decision may be changed' using errcode='42501';
   end if;
   if auth.uid()=old.proposer_id and new.status<>'withdrawn' then
     raise exception 'The other participant must approve a new booking time' using errcode='42501';
   end if;
   if auth.uid()<>old.proposer_id and new.status='withdrawn' then
     raise exception 'Only the proposer may withdraw' using errcode='42501';
   end if;
   select id,customer_id,accepted_tradesperson_id,appointment_id,status,issue
     into v_job from public.jobs where id=new.job_id for update;
   if not found or auth.uid() not in(v_job.customer_id,v_job.accepted_tradesperson_id) then
     raise exception 'Not a participant in this job' using errcode='42501';
   end if;
   if new.status='accepted' then
     if v_job.status not in ('accepted','en_route') or v_job.accepted_tradesperson_id is null then
       raise exception 'Job no longer accepts appointment changes' using errcode='23514';
     end if;
     if v_job.appointment_id is not null then
       update public.trade_appointments a
          set starts_at=new.proposed_start, ends_at=new.proposed_end,updated_at=now()
        where a.id=v_job.appointment_id and a.job_id=v_job.id and a.status='scheduled';
       if not found then
         raise exception 'Existing appointment no longer available' using errcode='23514';
       end if;
     else
       insert into public.trade_appointments
         (tradesperson_id,job_id,title,starts_at,ends_at,status,notes)
       values
         (v_job.accepted_tradesperson_id,v_job.id,substring(v_job.issue for 180),
          new.proposed_start,new.proposed_end,'scheduled',
          'Appointment time mutually approved in Tradarr. Confirm the full address and price before visiting.');
     end if;
     update public.jobs
       set requested_start=new.proposed_start,requested_end=new.proposed_end,updated_at=now()
       where id=v_job.id;
   end if;
   new.reviewed_at=now();
 end if;
 return new;
end $$;
revoke all on function trade_private.tradarr_appointment_change_review() from public,anon,authenticated;

-- Avoid executing two redundant conversation-updating triggers per new message.
drop trigger if exists tradarr_touch_conversation_on_message on public.messages;
drop function if exists trade_private.tradarr_touch_conversation_on_message();

