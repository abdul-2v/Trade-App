-- Tradarr Crew v1: adult-only work-finding introductions between users.
-- No payment processing, no employment/verification claims, and no exact location disclosure.
-- Honour both directions of user blocks despite the block table's owner-only RLS.
create function trade_private.crew_blocked(p_a uuid,p_b uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tradarr_user_blocks b where
  (b.blocker_id=p_a and b.blocked_id=p_b) or (b.blocker_id=p_b and b.blocked_id=p_a));
$$;
revoke all on function trade_private.crew_blocked(uuid,uuid) from public,anon;
grant execute on function trade_private.crew_blocked(uuid,uuid) to authenticated;
create table public.crew_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(btrim(display_name)) between 2 and 75),
 headline text not null check(length(btrim(headline)) between 5 and 100),
 trade text not null check(length(btrim(trade)) between 2 and 60),
 level text not null check(level in ('helper','skilled','apprentice')),
 area_label text not null check(length(btrim(area_label)) between 2 and 80),
 experience_years integer not null default 0 check(experience_years between 0 and 60),
 about text not null default '' check(length(about)<=800),
 availability_note text not null default '' check(length(availability_note)<=180),
 adult_confirmed boolean not null check(adult_confirmed),
 is_visible boolean not null default false,
 updated_at timestamptz not null default now()
);
create index crew_profiles_discover_idx on public.crew_profiles(trade,level,updated_at desc) where is_visible;
alter table public.crew_profiles enable row level security;
create policy crew_profiles_read on public.crew_profiles for select to authenticated using (
 user_id=(select auth.uid()) or (is_visible
 and not trade_private.tradarr_account_suspended(user_id)
 and not trade_private.tradarr_account_suspended((select auth.uid()))
 and exists(select 1 from public.tradesperson_profiles t where t.user_id=(select auth.uid()))
 and not trade_private.crew_blocked(user_id,(select auth.uid())))
);
create policy crew_profiles_insert on public.crew_profiles for insert to authenticated with check (
 user_id=(select auth.uid()) and adult_confirmed
 and not trade_private.tradarr_account_suspended((select auth.uid()))
);
create policy crew_profiles_update on public.crew_profiles for update to authenticated
 using(user_id=(select auth.uid()) and not trade_private.tradarr_account_suspended((select auth.uid())))
 with check(user_id=(select auth.uid()) and adult_confirmed);
grant select,insert on public.crew_profiles to authenticated;
grant update(display_name,headline,trade,level,area_label,experience_years,about,availability_note,is_visible,adult_confirmed,updated_at)
 on public.crew_profiles to authenticated;

create table public.crew_requests (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.tradesperson_profiles(user_id) on delete cascade,
 kind text not null check(kind in ('helper','skilled','apprentice')),
 title text not null check(length(btrim(title)) between 8 and 100),
 trade text not null check(length(btrim(trade)) between 2 and 60),
 area_label text not null check(length(btrim(area_label)) between 2 and 80),
 description text not null check(length(btrim(description)) between 30 and 1500),
 starts_at timestamptz,
 ends_at timestamptz,
 pay_amount numeric(10,2) not null check(pay_amount>0 and pay_amount<1000000),
 pay_unit text not null check(pay_unit in ('hour','day','year')),
 positions integer not null default 1 check(positions between 1 and 20),
 employment_basis text not null check(employment_basis in ('employment','self_employed','to_confirm')),
 status text not null default 'open' check(status in ('open','closed')),
 expires_at timestamptz not null default (now()+interval '30 days'),
 created_at timestamptz not null default now(),
 constraint crew_dates check((starts_at is null and ends_at is null) or (starts_at is not null and ends_at is not null and ends_at>starts_at)),
 constraint crew_apprentice_terms check(kind<>'apprentice' or (employment_basis='employment' and pay_unit in ('hour','year'))),
 constraint crew_expiry check(expires_at<=created_at+interval '90 days' and expires_at>created_at)
);
create index crew_requests_open_idx on public.crew_requests(kind,trade,created_at desc) where status='open';
create index crew_requests_owner_idx on public.crew_requests(owner_id,created_at desc);
alter table public.crew_requests enable row level security;
create policy crew_requests_read on public.crew_requests for select to authenticated using (
 owner_id=(select auth.uid()) or
 (status='open' and expires_at>now() and not trade_private.tradarr_account_suspended(owner_id)
 and not trade_private.tradarr_account_suspended((select auth.uid()))
 and (exists(select 1 from public.tradesperson_profiles t where t.user_id=(select auth.uid()))
  or exists(select 1 from public.crew_profiles p where p.user_id=(select auth.uid())))
 and not trade_private.crew_blocked(owner_id,(select auth.uid())))
);
create policy crew_requests_insert on public.crew_requests for insert to authenticated with check(
 owner_id=(select auth.uid()) and status='open'
 and not trade_private.tradarr_account_suspended((select auth.uid()))
 and not trade_private.tradarr_trade_paused((select auth.uid()))
 and expires_at>now()
);
create policy crew_requests_update on public.crew_requests for update to authenticated
 using(owner_id=(select auth.uid()) and not trade_private.tradarr_account_suspended((select auth.uid())))
 with check(owner_id=(select auth.uid()));
grant select,insert on public.crew_requests to authenticated;
grant update(status) on public.crew_requests to authenticated;

create table public.crew_applications (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.crew_requests(id) on delete cascade,
 worker_id uuid not null references public.crew_profiles(user_id) on delete cascade,
 note text not null check(length(btrim(note)) between 10 and 800),
 status text not null default 'applied' check(status in ('applied','shortlisted','accepted','declined','withdrawn')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(request_id,worker_id)
);
create index crew_applications_request_idx on public.crew_applications(request_id,created_at desc);
create index crew_applications_worker_idx on public.crew_applications(worker_id,created_at desc);
alter table public.crew_applications enable row level security;
create policy crew_applications_read on public.crew_applications for select to authenticated using(
 worker_id=(select auth.uid()) or exists(select 1 from public.crew_requests r
 where r.id=request_id and r.owner_id=(select auth.uid()))
);
create policy crew_applications_apply on public.crew_applications for insert to authenticated with check(
 worker_id=(select auth.uid()) and status='applied'
 and not trade_private.tradarr_account_suspended((select auth.uid()))
 and exists(select 1 from public.crew_requests r
   where r.id=request_id and r.owner_id<>worker_id and r.status='open'
    and not trade_private.crew_blocked(worker_id,r.owner_id)
    and exists(select 1 from public.crew_profiles p where p.user_id=worker_id and p.is_visible)
    and r.expires_at>now() and not trade_private.tradarr_account_suspended(r.owner_id))
);
grant select,insert on public.crew_applications to authenticated;

-- Only the worker may withdraw; only the hirer may shortlist, accept or decline.
-- Lock the request to prevent accepting more workers than positions.
create function public.crew_set_application_status(p_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare v_app public.crew_applications%rowtype;
 v_request public.crew_requests%rowtype;
 v_actor uuid := auth.uid();
begin
 if v_actor is null or trade_private.tradarr_account_suspended(v_actor) then
  raise exception 'Sign in to an active account' using errcode='42501';
 end if;
 select * into v_app from public.crew_applications where id=p_id for update;
 if not found then raise exception 'Application not found' using errcode='P0002'; end if;
 select * into v_request from public.crew_requests where id=v_app.request_id for update;
 if v_actor=v_app.worker_id and p_status='withdrawn' and v_app.status in ('applied','shortlisted','accepted') then
  null;
 elsif v_actor=v_request.owner_id and p_status in ('shortlisted','accepted','declined')
  and v_app.status in ('applied','shortlisted')
  and not trade_private.tradarr_trade_paused(v_actor)
  and not trade_private.crew_blocked(v_request.owner_id,v_app.worker_id)
  and not trade_private.tradarr_account_suspended(v_app.worker_id) then
  if p_status='accepted' and
   (select count(*) from public.crew_applications
     where request_id=v_request.id and status='accepted')>=v_request.positions then
   raise exception 'All places are already filled';
  end if;
 else
  raise exception 'Application transition not allowed' using errcode='42501';
 end if;
 update public.crew_applications set status=p_status,updated_at=now() where id=p_id;
end $$;
revoke all on function public.crew_set_application_status(uuid,text) from public,anon;
grant execute on function public.crew_set_application_status(uuid,text) to authenticated;

create table public.crew_saved (
 owner_id uuid not null references public.tradesperson_profiles(user_id) on delete cascade,
 worker_id uuid not null references public.crew_profiles(user_id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(owner_id,worker_id),
 check(owner_id<>worker_id)
);
alter table public.crew_saved enable row level security;
create policy crew_saved_read on public.crew_saved for select to authenticated using(owner_id=(select auth.uid()));
create policy crew_saved_insert on public.crew_saved for insert to authenticated with check(
 owner_id=(select auth.uid()) and not trade_private.tradarr_account_suspended((select auth.uid()))
 and exists(select 1 from public.crew_profiles p where p.user_id=worker_id and p.is_visible)
);
create policy crew_saved_delete on public.crew_saved for delete to authenticated using(owner_id=(select auth.uid()));
grant select,insert,delete on public.crew_saved to authenticated;

create table public.crew_messages (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.crew_applications(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(length(btrim(body)) between 1 and 1500),
 created_at timestamptz not null default now()
);
create index crew_messages_thread_idx on public.crew_messages(application_id,created_at);
alter table public.crew_messages enable row level security;
create policy crew_messages_read on public.crew_messages for select to authenticated using(
 exists(select 1 from public.crew_applications a join public.crew_requests r on r.id=a.request_id
 where a.id=application_id and (a.worker_id=(select auth.uid()) or r.owner_id=(select auth.uid())))
);
create policy crew_messages_post on public.crew_messages for insert to authenticated with check(
 sender_id=(select auth.uid()) and not trade_private.tradarr_account_suspended((select auth.uid()))
 and exists(select 1 from public.crew_applications a join public.crew_requests r on r.id=a.request_id
 where a.id=application_id and a.status not in ('declined','withdrawn')
 and (a.worker_id=(select auth.uid()) or r.owner_id=(select auth.uid()))
 and not trade_private.tradarr_account_suspended(a.worker_id)
 and not trade_private.tradarr_account_suspended(r.owner_id)
 and not trade_private.crew_blocked(a.worker_id,r.owner_id))
);
grant select,insert on public.crew_messages to authenticated;
-- Publish only this participant-protected table for live in-app threads.
alter publication supabase_realtime add table public.crew_messages;

-- Crew alerts use the existing in-app/push delivery pipeline.
alter table public.tradarr_notifications drop constraint tradarr_notifications_kind_check;
alter table public.tradarr_notifications add constraint tradarr_notifications_kind_check check(
 kind in ('message','job_offer','job_accepted','job_status','appointment',
 'appointment_change','route_match','quote_update','appointment_reminder','invoice_update',
 'verification_update','support_update','admin_notice','crew_update')
);
create function trade_private.crew_send_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_to uuid;v_kind text;v_title text;v_body text;v_key text;v_owner uuid;
begin
 if tg_table_name='crew_applications' then
  select owner_id into v_owner from public.crew_requests where id=new.request_id;
  if tg_op='INSERT' then
   v_to:=v_owner;v_title:='New Crew application';v_body:='Someone has applied to help with your Crew request.';
   v_key:='crew-application:'||new.id::text;
  elsif new.status is distinct from old.status then
   v_to:=case when new.status='withdrawn' then v_owner else new.worker_id end;
   v_title:='Crew application updated';v_body:='Your Crew application has a new status: '||new.status||'.';
   v_key:='crew-status:'||new.id::text||':'||new.status;
  end if;
  v_kind:='crew_update';
 elsif tg_table_name='crew_messages' then
  -- Do not place private message bodies in notifications.
  select r.owner_id,a.worker_id into v_owner,v_to
   from public.crew_applications a join public.crew_requests r on r.id=a.request_id
   where a.id=new.application_id;
  v_to:=case when new.sender_id=v_owner then v_to else v_owner end;
  v_title:='New Crew message';v_body:='You have a message about a Crew opportunity.';
  v_key:='crew-message:'||new.id::text;v_kind:='crew_update';
 end if;
 if v_to is not null and v_to<>(select auth.uid()) then
  insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
  values(v_to,v_key,v_kind,v_title,v_body,jsonb_build_object('screen','tradeCrew'))
  on conflict(recipient_id,event_key) do nothing;
 end if;
 return new;
end $$;
revoke all on function trade_private.crew_send_notification() from public,anon,authenticated;
create trigger crew_applications_notify after insert or update of status on public.crew_applications
 for each row execute function trade_private.crew_send_notification();
create trigger crew_messages_notify after insert on public.crew_messages
 for each row execute function trade_private.crew_send_notification();

comment on table public.crew_requests is 'Introductions only: matching does not create employment, verify right to work, or manage apprentice training.';
