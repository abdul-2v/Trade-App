-- Confirmed Tradarr journeys communicate a manual ETA, not a GPS tracking feed.
alter table public.jobs add column if not exists estimated_arrival_minutes integer;
alter table public.jobs add column if not exists eta_updated_at timestamptz;
alter table public.jobs drop constraint if exists jobs_eta_range;
alter table public.jobs add constraint jobs_eta_range check (
 estimated_arrival_minutes is null or estimated_arrival_minutes between 5 and 240
);
create or replace function trade_private.tradarr_guard_job_eta()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.estimated_arrival_minutes is distinct from old.estimated_arrival_minutes then
    if (select auth.uid()) is distinct from old.accepted_tradesperson_id
      or old.status not in ('accepted','en_route') or new.status <> 'en_route' then
      raise exception 'Only the assigned tradesperson can update an active arrival estimate'
        using errcode='42501';
    end if;
    if new.job_mode in ('route','street_run') and new.appointment_id is null then
      raise exception 'Agree a confirmed appointment before starting this journey'
        using errcode='23514';
    end if;
    new.eta_updated_at:=case when new.estimated_arrival_minutes is null
      then null else now() end;
  elsif new.eta_updated_at is distinct from old.eta_updated_at then
    raise exception 'ETA timestamps cannot be set directly' using errcode='42501';
  end if;

  if old.status is distinct from new.status then
    if new.status='en_route' and old.status='accepted'
      and new.job_mode in ('route','street_run') and new.appointment_id is null then
      raise exception 'Confirm the route job booking before starting travel'
        using errcode='23514';
    end if;
    if new.status in ('arrived','in_progress','completed','cancelled','expired') then
      new.estimated_arrival_minutes:=null;
      new.eta_updated_at:=null;
    end if;
  end if;
  return new;
end $$;
revoke all on function trade_private.tradarr_guard_job_eta() from public,anon,authenticated;
drop trigger if exists tradarr_guard_job_eta on public.jobs;
create trigger tradarr_guard_job_eta before update of status,estimated_arrival_minutes,eta_updated_at on public.jobs
 for each row execute function trade_private.tradarr_guard_job_eta();

create or replace function trade_private.tradarr_eta_change_notification()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='en_route' and old.status='en_route'
     and new.estimated_arrival_minutes is distinct from old.estimated_arrival_minutes
     and new.estimated_arrival_minutes is not null then
    insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
    values(new.customer_id,
      'journey-eta:'||new.id||':'||extract(epoch from new.eta_updated_at)::text,
      'job_status','Arrival estimate updated',
      'Your tradesperson estimates about '||new.estimated_arrival_minutes||' minutes to arrival.',
      jsonb_build_object('screen','requests','jobId',new.id))
    on conflict(recipient_id,event_key) do nothing;
  end if;
  return null;
end $$;
revoke all on function trade_private.tradarr_eta_change_notification() from public,anon,authenticated;
drop trigger if exists tradarr_eta_change_notification on public.jobs;
create trigger tradarr_eta_change_notification after update of estimated_arrival_minutes
 on public.jobs for each row execute function trade_private.tradarr_eta_change_notification();
