CREATE OR REPLACE FUNCTION trade_private.tradarr_appointment_change_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_job record; v_plan record;
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
   select id,customer_id,accepted_tradesperson_id,appointment_id,status,issue,job_mode
     into v_job from public.jobs where id=new.job_id for update;
   if not found or auth.uid() not in(v_job.customer_id,v_job.accepted_tradesperson_id) then
     raise exception 'Not a participant in this job' using errcode='42501';
   end if;
   if new.status='accepted' then
     if v_job.status not in ('accepted','en_route') or v_job.accepted_tradesperson_id is null then
       raise exception 'Job no longer accepts appointment changes' using errcode='23514';
     end if;
     if v_job.job_mode in ('route','street_run') then
       select p.* into v_plan
         from public.job_offers o join public.trade_route_plans p on p.id=o.route_plan_id
         where o.job_id=v_job.id and o.tradesperson_id=v_job.accepted_tradesperson_id
           and o.status='accepted'
         order by o.offered_at desc limit 1;
       if not found then
         raise exception 'This flexible job has no accepted published journey' using errcode='23514';
       end if;
       if v_plan.status <> 'open' or v_plan.ends_at <= now()
          or not exists (
             select 1 from public.trade_appointments a
             where a.id=v_plan.anchor_appointment_id and a.status='scheduled'
          ) then
          raise exception 'The published journey has closed or its original appointment was cancelled'
            using errcode='23514';
       end if;
       if new.proposed_start < v_plan.starts_at
          or new.proposed_end > v_plan.ends_at then
         raise exception 'Visit must fit inside the published journey window' using errcode='23514';
       end if;
       if exists(
         select 1 from public.trade_appointments a
         where a.tradesperson_id=v_job.accepted_tradesperson_id
           and a.status='scheduled' and a.id is distinct from v_job.appointment_id
           and a.starts_at < new.proposed_end + interval '15 minutes'
           and a.ends_at > new.proposed_start - interval '15 minutes'
       ) then
         raise exception 'Route visits require at least 15 minutes between existing appointments'
           using errcode='23P01';
       end if;
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
end $function$
;

create or replace function trade_private.tradarr_prevent_linked_appointment_delete()
returns trigger language plpgsql set search_path='' as $$
begin
 if auth.uid() is not null and (old.job_id is not null or old.grid_request_id is not null) then
   raise exception 'Linked appointments must be cancelled through the job or booking workflow'
     using errcode='42501';
 end if;
 return old;
end $$;
drop trigger if exists tradarr_prevent_linked_appointment_delete on public.trade_appointments;
create trigger tradarr_prevent_linked_appointment_delete
 before delete on public.trade_appointments for each row
 execute function trade_private.tradarr_prevent_linked_appointment_delete();

