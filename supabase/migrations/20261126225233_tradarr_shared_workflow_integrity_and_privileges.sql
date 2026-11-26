-- Shared Tradarr workflow hardening. No customer records are deleted or rewritten.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated, public;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from anon, authenticated;

-- Urgent requests must enter the same state machine on mobile and web.
create or replace function trade_private.tradarr_guard_urgent_request()
returns trigger language plpgsql set search_path='' as $$
declare actor uuid := (select auth.uid());
begin
 if tg_op='INSERT' then
  if current_user not in ('postgres','service_role') then
   if actor is null or new.customer_id is distinct from actor or new.status is distinct from 'searching'
      or new.accepted_tradesperson_id is not null or new.accepted_at is not null or new.estimated_arrival_minutes is not null then
    raise exception 'Start an urgent request before accepting it' using errcode='42501';
   end if;
  end if;
  new.latitude:=round(new.latitude::numeric,2)::double precision;
  new.longitude:=round(new.longitude::numeric,2)::double precision;
  return new;
 end if;
 if current_user in ('postgres','service_role') then return new; end if;
 if actor is null or (to_jsonb(new)-'status'-'updated_at') is distinct from (to_jsonb(old)-'status'-'updated_at') then
  raise exception 'Urgent request details and assignment cannot be changed directly' using errcode='42501';
 end if;
 if new.status is distinct from old.status and not (
  (actor=old.customer_id and old.status in ('searching','matched','en_route') and new.status='cancelled')
  or (actor=old.accepted_tradesperson_id and ((old.status='matched' and new.status='en_route') or (old.status='en_route' and new.status='arrived') or (old.status='arrived' and new.status='completed')))
 ) then raise exception 'Invalid urgent request transition' using errcode='42501'; end if;
 new.updated_at:=now();return new;
end $$;
revoke all on function trade_private.tradarr_guard_urgent_request() from public,anon,authenticated;
create trigger tradarr_guard_urgent_request before insert or update on public.urgent_requests
for each row execute function trade_private.tradarr_guard_urgent_request();

-- Public job search rows contain coarse coordinates, not door-level locations.
create or replace function trade_private.tradarr_coarsen_job_area()
returns trigger language plpgsql set search_path='' as $$
begin
 new.latitude:=round(new.latitude::numeric,2)::double precision;
 new.longitude:=round(new.longitude::numeric,2)::double precision;
 return new;
end $$;
revoke all on function trade_private.tradarr_coarsen_job_area() from public,anon,authenticated;
create trigger tradarr_coarsen_job_area before insert or update of latitude,longitude on public.jobs
for each row execute function trade_private.tradarr_coarsen_job_area();

-- Only the transactional offer-acceptance path may assign a standard job.
create or replace function trade_private.tradarr_require_offer_acceptance()
returns trigger language plpgsql set search_path='' as $$
begin
 if current_user not in ('postgres','service_role') and old.accepted_tradesperson_id is null
    and new.accepted_tradesperson_id is not null then
  raise exception 'Accept through the job offer so assignment and the conversation are saved together' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function trade_private.tradarr_require_offer_acceptance() from public,anon,authenticated;
create trigger tradarr_require_offer_acceptance before update of accepted_tradesperson_id on public.jobs
for each row execute function trade_private.tradarr_require_offer_acceptance();

-- Lock the identity and response of an urgent invitation; only the offered trader may respond.
create or replace function trade_private.tradarr_guard_urgent_offer()
returns trigger language plpgsql set search_path='' as $$
declare actor uuid := (select auth.uid());
begin
 if current_user in ('postgres','service_role') then return new; end if;
 if actor is null or actor is distinct from old.tradesperson_id
    or (to_jsonb(new)-'status'-'responded_at') is distinct from (to_jsonb(old)-'status'-'responded_at')
    or old.status<>'offered' or new.status not in ('accepted','declined') then
  raise exception 'Only an outstanding invitation can be accepted or declined by its recipient' using errcode='42501';
 end if;
 new.responded_at:=now();return new;
end $$;
revoke all on function trade_private.tradarr_guard_urgent_offer() from public,anon,authenticated;
create trigger tradarr_guard_urgent_offer before update on public.urgent_request_offers
for each row execute function trade_private.tradarr_guard_urgent_offer();

-- Do not accept forged offer statuses or create invitations on closed jobs.
create or replace function trade_private.tradarr_guard_new_invitation()
returns trigger language plpgsql set search_path='' as $$
declare actor uuid := (select auth.uid()); owner_id uuid; job_status text; assigned_id uuid;
begin
 if current_user in ('postgres','service_role') then return new; end if;
 if tg_table_name='urgent_request_offers' then
  select customer_id,status,accepted_tradesperson_id into owner_id,job_status,assigned_id from public.urgent_requests where id=new.request_id;
 else
  select customer_id,status,accepted_tradesperson_id into owner_id,job_status,assigned_id from public.jobs where id=new.job_id;
 end if;
 if actor is null or owner_id is distinct from actor or assigned_id is not null
   or job_status not in ('searching','posted','offered') or new.status is distinct from 'offered'
   or new.responded_at is not null or new.tradesperson_id=actor
   or trade_private.crew_blocked(actor,new.tradesperson_id)
   or trade_private.tradarr_account_suspended(new.tradesperson_id)
   or trade_private.tradarr_trade_paused(new.tradesperson_id) then
  raise exception 'Cannot send this invitation' using errcode='42501';
 end if;
 new.offered_at:=now();return new;
end $$;
revoke all on function trade_private.tradarr_guard_new_invitation() from public,anon,authenticated;
create trigger tradarr_guard_new_invitation before insert on public.urgent_request_offers
for each row execute function trade_private.tradarr_guard_new_invitation();
create trigger tradarr_guard_new_invitation before insert on public.job_offers
for each row execute function trade_private.tradarr_guard_new_invitation();

-- Expire pending invitations when a request is cancelled/expired, retaining its history.
create or replace function trade_private.tradarr_close_pending_invitations()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('cancelled','expired') and old.status is distinct from new.status then
  if tg_table_name='urgent_requests' then
   update public.urgent_request_offers set status='expired',responded_at=now() where request_id=new.id and status='offered';
  else
   update public.job_offers set status='expired',responded_at=now() where job_id=new.id and status='offered';
  end if;
 end if;
 return null;
end $$;
revoke all on function trade_private.tradarr_close_pending_invitations() from public,anon,authenticated;
create trigger tradarr_close_pending_invitations after update of status on public.urgent_requests
for each row execute function trade_private.tradarr_close_pending_invitations();
create trigger tradarr_close_pending_invitations after update of status on public.jobs
for each row execute function trade_private.tradarr_close_pending_invitations();

-- Urgent offers, acceptance, arrival, completion and cancellation use the existing outbox.
create or replace function trade_private.tradarr_notify_urgent_workflow()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid; event_kind text; heading text; event_id text; request_id uuid; screen text;
begin
 if tg_table_name='urgent_request_offers' then
  if tg_op='INSERT' and new.status='offered' then
   recipient:=new.tradesperson_id;event_kind:='job_offer';heading:='New urgent job request';event_id:='urgent-offer:'||new.id;
   request_id:=new.request_id;screen:='tradeJobs';
  end if;
 elsif tg_op='UPDATE' and old.status is distinct from new.status then
  request_id:=new.id;recipient:=new.customer_id;screen:='requests';
  event_kind:=case when new.status='matched' then 'job_accepted' else 'job_status' end;
  heading:=case new.status when 'matched' then 'Urgent request accepted' when 'en_route' then 'Tradesperson on the way'
    when 'arrived' then 'Tradesperson has arrived' when 'completed' then 'Urgent job completed'
    when 'cancelled' then 'Urgent request cancelled' when 'expired' then 'Urgent request expired' else null end;
  event_id:='urgent-status:'||new.id||':'||new.status;
  if new.status='cancelled' and new.accepted_tradesperson_id is not null then
   insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
   values(new.accepted_tradesperson_id,event_id||':provider','job_status','Urgent booking cancelled','Check the updated request in Tradarr.',jsonb_build_object('screen','tradeJobs','jobId',new.id))
   on conflict(recipient_id,event_key) do nothing;
  end if;
 end if;
 if recipient is not null and heading is not null then
  insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
  values(recipient,event_id,event_kind,heading,'Open Tradarr to view the request.',jsonb_build_object('screen',screen,'jobId',request_id))
  on conflict(recipient_id,event_key) do nothing;
 end if;
 return null;
end $$;
revoke all on function trade_private.tradarr_notify_urgent_workflow() from public,anon,authenticated;
create trigger tradarr_notify_urgent_offer after insert on public.urgent_request_offers for each row execute function trade_private.tradarr_notify_urgent_workflow();
create trigger tradarr_notify_urgent_status after update of status on public.urgent_requests for each row execute function trade_private.tradarr_notify_urgent_workflow();

-- A Grid request is a snapshot: a responder cannot swap its customer, slot or time.
create or replace function trade_private.tradarr_guard_grid_request()
returns trigger language plpgsql set search_path='' as $$
begin
 if current_user not in ('postgres','service_role') and
    (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') then
  raise exception 'The original Grid request and slot cannot be changed' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function trade_private.tradarr_guard_grid_request() from public,anon,authenticated;
create trigger tradarr_guard_grid_request before update on public.trade_grid_requests
for each row execute function trade_private.tradarr_guard_grid_request();

-- A customer may see their own accepted Grid appointment, but not other diary entries.
create policy tradarr_grid_customer_appointment_read on public.trade_appointments
for select to authenticated using (grid_request_id is not null and exists (
 select 1 from public.trade_grid_requests g where g.id=trade_appointments.grid_request_id
 and g.customer_id=(select auth.uid()) and g.status='accepted'));

-- Apply the same block rule to free-text aftercare as to Inbox.
create or replace function trade_private.tradarr_guard_handover_message()
returns trigger language plpgsql security definer set search_path='' as $$
declare h public.tradarr_job_handovers%rowtype;
begin
 select * into h from public.tradarr_job_handovers where id=new.handover_id;
 if found and trade_private.crew_blocked(h.customer_id,h.tradesperson_id) then
  raise exception 'Messaging is blocked between these accounts' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function trade_private.tradarr_guard_handover_message() from public,anon,authenticated;
create trigger tradarr_guard_handover_message before insert on public.tradarr_handover_updates
for each row execute function trade_private.tradarr_guard_handover_message();

-- Protect saved business presets and manual payment writes consistently with core tools.
create trigger tradarr_suspended_user_write before insert or update on public.trade_document_presets
for each row execute function trade_private.tradarr_block_suspended_writes();
create trigger tradarr_suspended_user_write before insert or update on public.trade_invoice_payments
for each row execute function trade_private.tradarr_block_suspended_writes();

-- Index existing foreign keys, keeping all existing indexes and avoiding duplicates.
do $$
declare fk record; cols text; idx text;
begin
 for fk in select c.oid,c.conrelid,c.conkey,c.conname
 from pg_constraint c where c.contype='f' and c.connamespace='public'::regnamespace
 and not exists(select 1 from pg_index i where i.indrelid=c.conrelid and i.indisvalid
  and i.indpred is null and (i.indkey::smallint[])[0:cardinality(c.conkey)-1] @> c.conkey)
 loop
  select string_agg(quote_ident(a.attname),',' order by k.ord) into cols
  from unnest(fk.conkey) with ordinality k(att,ord) join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=k.att;
  idx:='tradarr_fk_'||substr(md5(fk.conrelid::text||':'||fk.conname),1,24);
  execute format('create index if not exists %I on %s (%s)',idx,fk.conrelid::regclass,cols);
 end loop;
end $$;
