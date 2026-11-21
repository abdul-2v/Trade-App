
-- Tradarr two-sided job assurance: ScopeGuard & FinishProof.
-- All records are private to real, assigned standard-job participants.
-- User-authored terms are not automated changes to invoices, certified work, or consumer-rights waivers.
create table if not exists public.tradarr_scope_changes (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.jobs(id) on delete cascade,
 customer_id uuid not null references public.profiles(id) on delete cascade,
 tradesperson_id uuid not null references public.tradesperson_profiles(user_id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 5 and 140),
 details text not null check(char_length(btrim(details)) between 12 and 1600),
 amount_delta_pence integer not null check(amount_delta_pence between -100000000 and 100000000),
 extra_minutes integer not null default 0 check(extra_minutes between 0 and 10080),
 status text not null default 'pending' check(status in ('pending','approved','declined','withdrawn')),
 customer_note text check(customer_note is null or char_length(customer_note)<=800),
 created_at timestamptz not null default now(),
 responded_at timestamptz,
 constraint scope_response_consistent check (
   (status='pending' and responded_at is null)
   or (status<>'pending' and responded_at is not null)
 )
);
create unique index if not exists tradarr_one_pending_scope_per_job
 on public.tradarr_scope_changes(job_id) where status='pending';
create index if not exists tradarr_scope_customer_recent
 on public.tradarr_scope_changes(customer_id,created_at desc);
create index if not exists tradarr_scope_trade_recent
 on public.tradarr_scope_changes(tradesperson_id,created_at desc);
alter table public.tradarr_scope_changes enable row level security;
revoke all on public.tradarr_scope_changes from public,anon,authenticated;
grant select on public.tradarr_scope_changes to authenticated;
create policy tradarr_scope_participants_read on public.tradarr_scope_changes
 for select to authenticated
 using ((select auth.uid())=customer_id or (select auth.uid())=tradesperson_id);

create table if not exists public.tradarr_job_handovers (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null unique references public.jobs(id) on delete cascade,
 customer_id uuid not null references public.profiles(id) on delete cascade,
 tradesperson_id uuid not null references public.tradesperson_profiles(user_id) on delete cascade,
 work_summary text not null check(char_length(btrim(work_summary)) between 12 and 2400),
 tested_where_applicable boolean not null default false,
 site_left_tidy boolean not null default false,
 customer_briefed boolean not null default false,
 outstanding_items text not null default '' check(char_length(outstanding_items)<=1200),
 aftercare_notes text not null default '' check(char_length(aftercare_notes)<=1600),
 photo_paths text[] not null default '{}'::text[] check(cardinality(photo_paths)<=3),
 status text not null default 'awaiting_customer' check(status in ('awaiting_customer','followup_requested','acknowledged')),
 created_at timestamptz not null default now(),
 responded_at timestamptz
);
create index if not exists tradarr_handover_customer_recent
 on public.tradarr_job_handovers(customer_id,created_at desc);
create index if not exists tradarr_handover_trade_recent
 on public.tradarr_job_handovers(tradesperson_id,created_at desc);
alter table public.tradarr_job_handovers enable row level security;
revoke all on public.tradarr_job_handovers from public,anon,authenticated;
grant select on public.tradarr_job_handovers to authenticated;
create policy tradarr_handover_participants_read on public.tradarr_job_handovers
 for select to authenticated
 using ((select auth.uid())=customer_id or (select auth.uid())=tradesperson_id);

create table if not exists public.tradarr_handover_updates (
 id uuid primary key default gen_random_uuid(),
 handover_id uuid not null references public.tradarr_job_handovers(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 2 and 1600),
 created_at timestamptz not null default now()
);
create index if not exists tradarr_handover_updates_thread
 on public.tradarr_handover_updates(handover_id,created_at asc);
alter table public.tradarr_handover_updates enable row level security;
revoke all on public.tradarr_handover_updates from public,anon,authenticated;
grant select on public.tradarr_handover_updates to authenticated;
create policy tradarr_handover_updates_participants_read on public.tradarr_handover_updates
 for select to authenticated using (exists (
  select 1 from public.tradarr_job_handovers h where h.id=handover_id
   and ((select auth.uid())=h.customer_id or (select auth.uid())=h.tradesperson_id)
 ));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tradarr-finishproof','tradarr-finishproof',false,4194304,
 array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,
 allowed_mime_types=excluded.allowed_mime_types;

-- Staging files belong to the assigned tradesperson, and may only be uploaded after completion.
create policy tradarr_finishproof_upload on storage.objects for insert to authenticated
with check (
 bucket_id='tradarr-finishproof'
 and split_part(name,'/',1)=(select auth.uid())::text
 and split_part(name,'/',3) ~ '^[a-zA-Z0-9_-]{8,64}[.](jpg|png|webp)$'
 and split_part(name,'/',4)=''
 and exists(select 1 from public.jobs j where j.id::text=split_part(name,'/',2)
  and j.accepted_tradesperson_id=(select auth.uid()) and j.status='completed')
);
create policy tradarr_finishproof_read on storage.objects for select to authenticated
using (
 bucket_id='tradarr-finishproof' and (
  split_part(name,'/',1)=(select auth.uid())::text or
  exists(select 1 from public.tradarr_job_handovers h
   where name=any(h.photo_paths) and h.customer_id=(select auth.uid()))
 )
);
create policy tradarr_finishproof_cleanup on storage.objects for delete to authenticated
using (
 bucket_id='tradarr-finishproof'
 and split_part(name,'/',1)=(select auth.uid())::text
 and not exists(select 1 from public.tradarr_job_handovers h where name=any(h.photo_paths))
);

create or replace function public.tradarr_scope_propose(
 p_job_id uuid, p_title text, p_details text, p_amount_delta_pence integer, p_extra_minutes integer default 0
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare j public.jobs%rowtype; v_id uuid;
begin
 if (select auth.uid()) is null or
   (select trade_private.tradarr_account_suspended((select auth.uid()))) then
  raise exception 'Sign in with an active account to propose a change' using errcode='42501';
 end if;
 if p_job_id is null or char_length(btrim(coalesce(p_title,''))) not between 5 and 140
  or char_length(btrim(coalesce(p_details,''))) not between 12 and 1600
  or p_amount_delta_pence is null or p_amount_delta_pence not between -100000000 and 100000000
  or p_extra_minutes is null or p_extra_minutes not between 0 and 10080 then
  raise exception 'Add a clear title, scope, extra time and valid change in price' using errcode='22023';
 end if;
 select * into j from public.jobs where id=p_job_id for update;
 if not found or j.accepted_tradesperson_id is distinct from (select auth.uid())
  or j.status not in ('accepted','en_route','arrived','in_progress') then
  raise exception 'Only the assigned trader can propose changes on an active job' using errcode='42501';
 end if;
 if exists(select 1 from public.tradarr_scope_changes
    where job_id=p_job_id and status='pending') then
  raise exception 'A change is already awaiting the customer. Resolve it first.' using errcode='23505';
 end if;
 insert into public.tradarr_scope_changes
  (job_id,customer_id,tradesperson_id,title,details,amount_delta_pence,extra_minutes)
 values(p_job_id,j.customer_id,(select auth.uid()),btrim(p_title),btrim(p_details),
  p_amount_delta_pence,p_extra_minutes)
 returning id into v_id;
 insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
 values(j.customer_id,'scope:'||v_id,'job_status','Review a proposed job change',
  'Your tradesperson has proposed a change to the work, cost or timing. Review before agreeing.',
  jsonb_build_object('screen','jobs','jobId',p_job_id,'scopeId',v_id))
 on conflict(recipient_id,event_key) do nothing;
 return v_id;
end $function$;

create or replace function public.tradarr_scope_decide(
 p_id uuid,p_decision text,p_customer_note text default ''
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare s public.tradarr_scope_changes%rowtype;j public.jobs%rowtype;
begin
 if (select auth.uid()) is null or
   (select trade_private.tradarr_account_suspended((select auth.uid()))) then
  raise exception 'Active account required' using errcode='42501';
 end if;
 if p_id is null or p_decision not in ('approved','declined','withdrawn')
  or char_length(coalesce(p_customer_note,''))>800 then
  raise exception 'Choose a valid change decision' using errcode='22023';
 end if;
 select * into s from public.tradarr_scope_changes where id=p_id for update;
 if not found or s.status<>'pending' then
  raise exception 'This proposal is no longer awaiting a decision' using errcode='23514';
 end if;
 select * into j from public.jobs where id=s.job_id for share;
 if not found or j.accepted_tradesperson_id is distinct from s.tradesperson_id
   or j.status in ('cancelled','expired') then
  raise exception 'The job assignment is no longer valid' using errcode='23514';
 end if;
 if p_decision='withdrawn' then
  if (select auth.uid()) is distinct from s.tradesperson_id then
   raise exception 'Only the proposer can withdraw this request' using errcode='42501';end if;
 else
  if (select auth.uid()) is distinct from s.customer_id then
   raise exception 'Only the customer can approve or decline a change' using errcode='42501';end if;
  if j.status='completed' then
   raise exception 'A completed job cannot receive a new scope approval' using errcode='23514';end if;
 end if;
 update public.tradarr_scope_changes set status=p_decision,
  customer_note=case when p_decision='withdrawn' then null else nullif(btrim(p_customer_note),'') end,
  responded_at=now() where id=p_id;
 insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
 values(case when p_decision='withdrawn' then s.customer_id else s.tradesperson_id end,
  'scope:'||s.id||':'||p_decision,'job_status',
  case when p_decision='approved' then 'Job change approved'
   when p_decision='declined' then 'Job change declined' else 'Job change withdrawn' end,
  'A proposed change has been '||p_decision||'. Open your job record for details.',
  jsonb_build_object('screen','jobs','jobId',s.job_id,'scopeId',s.id))
 on conflict(recipient_id,event_key) do nothing;
 return p_id;
end $function$;

create or replace function public.tradarr_finishproof_submit(
 p_job_id uuid,p_summary text,p_tested boolean,p_tidy boolean,p_briefed boolean,
 p_outstanding text default '',p_aftercare text default '',p_photo_paths text[] default '{}'::text[]
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare j public.jobs%rowtype;v_id uuid;v_path text;
begin
 if (select auth.uid()) is null or
    (select trade_private.tradarr_account_suspended((select auth.uid()))) then
  raise exception 'Active trade account required' using errcode='42501';end if;
 if p_job_id is null or char_length(btrim(coalesce(p_summary,''))) not between 12 and 2400
  or char_length(coalesce(p_outstanding,''))>1200
  or char_length(coalesce(p_aftercare,''))>1600
  or cardinality(coalesce(p_photo_paths,'{}'::text[]))>3
  or p_tested is null or p_tidy is null or p_briefed is null then
  raise exception 'Complete the work summary and checklist (maximum three images)' using errcode='22023';
 end if;
 select * into j from public.jobs where id=p_job_id for update;
 if not found or j.accepted_tradesperson_id is distinct from (select auth.uid())
   or j.status<>'completed' then
  raise exception 'Only the assigned trader can hand over a completed job' using errcode='42501';
 end if;
 if exists(select 1 from public.tradarr_job_handovers where job_id=p_job_id) then
  raise exception 'A handover already exists for this job' using errcode='23505';end if;
 foreach v_path in array coalesce(p_photo_paths,'{}'::text[]) loop
  if v_path is null or v_path !~ ('^'||(select auth.uid())::text||'/'||
     p_job_id::text||'/[A-Za-z0-9_-]{8,64}[.](jpg|png|webp)$')
   or not exists (select 1 from storage.objects o
       where o.bucket_id='tradarr-finishproof' and o.name=v_path) then
   raise exception 'One or more job photo uploads could not be verified' using errcode='22023';
  end if;
 end loop;
 if (select count(distinct x) from unnest(coalesce(p_photo_paths,'{}'::text[])) x)
     <> cardinality(coalesce(p_photo_paths,'{}'::text[])) then
  raise exception 'Do not attach the same photo twice' using errcode='22023';end if;
 insert into public.tradarr_job_handovers(job_id,customer_id,tradesperson_id,
  work_summary,tested_where_applicable,site_left_tidy,customer_briefed,
  outstanding_items,aftercare_notes,photo_paths)
 values(p_job_id,j.customer_id,(select auth.uid()),btrim(p_summary),
  p_tested,p_tidy,p_briefed,btrim(coalesce(p_outstanding,'')),
  btrim(coalesce(p_aftercare,'')),coalesce(p_photo_paths,'{}'::text[]))
 returning id into v_id;
 insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
 values(j.customer_id,'handover:'||v_id,'job_status','Your job handover is ready',
  'Your tradesperson has shared the completed-work summary and aftercare notes.',
  jsonb_build_object('screen','jobs','jobId',p_job_id,'handoverId',v_id))
 on conflict(recipient_id,event_key) do nothing;
 return v_id;
end $function$;

create or replace function public.tradarr_finishproof_respond(
 p_id uuid,p_decision text,p_note text default ''
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare h public.tradarr_job_handovers%rowtype;v_note text:=btrim(coalesce(p_note,''));
begin
 if (select auth.uid()) is null or
   (select trade_private.tradarr_account_suspended((select auth.uid()))) then
  raise exception 'Active account required' using errcode='42501';end if;
 if p_id is null or p_decision not in ('acknowledged','followup_requested')
  or char_length(v_note)>1600
  or (p_decision='followup_requested' and char_length(v_note)<10) then
  raise exception 'Explain any outstanding issue in at least ten characters' using errcode='22023';end if;
 select * into h from public.tradarr_job_handovers where id=p_id for update;
 if not found or h.customer_id is distinct from (select auth.uid()) then
  raise exception 'Only the customer can respond to their handover' using errcode='42501';end if;
 if h.status='acknowledged' or
   (h.status='followup_requested' and p_decision='followup_requested') then
  raise exception 'This response is already recorded' using errcode='23514';end if;
 update public.tradarr_job_handovers set status=p_decision,responded_at=now() where id=p_id;
 if v_note<>'' then
  insert into public.tradarr_handover_updates(handover_id,author_id,body)
  values(p_id,(select auth.uid()),v_note);
 end if;
 insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
 values(h.tradesperson_id,'handover:'||p_id||':'||p_decision,'job_status',
  case when p_decision='acknowledged' then 'Handover acknowledged' else 'Customer requests follow-up' end,
  case when p_decision='acknowledged' then
   'The customer has acknowledged your work record. Statutory rights are unaffected.'
   else 'The customer has flagged an item to discuss in the job aftercare thread.' end,
  jsonb_build_object('screen','jobs','jobId',h.job_id,'handoverId',p_id))
 on conflict(recipient_id,event_key) do nothing;
 return p_id;
end $function$;

create or replace function public.tradarr_finishproof_message(
 p_id uuid,p_body text
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare h public.tradarr_job_handovers%rowtype;v_id uuid;
begin
 if (select auth.uid()) is null or
    (select trade_private.tradarr_account_suspended((select auth.uid()))) then
  raise exception 'Active account required' using errcode='42501';end if;
 if p_id is null or char_length(btrim(coalesce(p_body,''))) not between 2 and 1600 then
  raise exception 'Write an aftercare message of 2–1,600 characters' using errcode='22023';end if;
 select * into h from public.tradarr_job_handovers where id=p_id;
 if not found or (select auth.uid()) not in (h.customer_id,h.tradesperson_id) then
  raise exception 'Only job participants can discuss aftercare' using errcode='42501';end if;
 insert into public.tradarr_handover_updates(handover_id,author_id,body)
 values(p_id,(select auth.uid()),btrim(p_body)) returning id into v_id;
 insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
 values(case when (select auth.uid())=h.customer_id then h.tradesperson_id else h.customer_id end,
  'handover-message:'||v_id,'job_status','New job aftercare message',
  'There is a new message in your completed job handover.',
  jsonb_build_object('screen','jobs','jobId',h.job_id,'handoverId',p_id))
 on conflict(recipient_id,event_key) do nothing;
 return v_id;
end $function$;

revoke all on function public.tradarr_scope_propose(uuid,text,text,integer,integer) from public,anon;
revoke all on function public.tradarr_scope_decide(uuid,text,text) from public,anon;
revoke all on function public.tradarr_finishproof_submit(uuid,text,boolean,boolean,boolean,text,text,text[]) from public,anon;
revoke all on function public.tradarr_finishproof_respond(uuid,text,text) from public,anon;
revoke all on function public.tradarr_finishproof_message(uuid,text) from public,anon;
grant execute on function public.tradarr_scope_propose(uuid,text,text,integer,integer) to authenticated;
grant execute on function public.tradarr_scope_decide(uuid,text,text) to authenticated;
grant execute on function public.tradarr_finishproof_submit(uuid,text,boolean,boolean,boolean,text,text,text[]) to authenticated;
grant execute on function public.tradarr_finishproof_respond(uuid,text,text) to authenticated;
grant execute on function public.tradarr_finishproof_message(uuid,text) to authenticated;
