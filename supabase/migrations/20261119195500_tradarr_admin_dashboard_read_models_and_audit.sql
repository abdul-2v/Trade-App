-- Administrative read models. All routines enforce live staff role + MFA.
-- No service role credentials enter the mobile application.
create table if not exists public.tradarr_admin_audit (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references auth.users(id),
 action text not null check(char_length(action) between 3 and 80),
 target_type text not null check(char_length(target_type) between 3 and 50),
 target_id uuid,
 reason text not null check(char_length(btrim(reason)) between 10 and 2000),
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists tradarr_admin_audit_recent_idx
 on public.tradarr_admin_audit(created_at desc);
alter table public.tradarr_admin_audit enable row level security;
revoke all on public.tradarr_admin_audit from public,anon,authenticated;
grant select on public.tradarr_admin_audit to authenticated;
drop policy if exists tradarr_admin_audit_staff_read on public.tradarr_admin_audit;
create policy tradarr_admin_audit_staff_read on public.tradarr_admin_audit
 for select to authenticated using ((select trade_private.tradarr_staff_authorised()));

create or replace function public.tradarr_admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb;
begin
 if (select auth.uid()) is null or not (select trade_private.tradarr_staff_authorised()) then
  raise exception 'Verified administrator and second factor required' using errcode='42501';
 end if;
 select jsonb_build_object(
  'users', (select count(*) from auth.users),
  'new_users_7d',(select count(*) from auth.users where created_at >= now()-interval '7 days'),
  'traders',(select count(*) from public.tradesperson_profiles),
  'verified_traders',(select count(*) from public.tradesperson_profiles where is_verified),
  'insured_traders',(select count(*) from public.tradesperson_profiles where is_insured),
  'available_traders',(select count(*) from public.trade_availability where is_available is true and (available_until is null or available_until>now())),
  'jobs',(select count(*) from public.jobs),
  'active_jobs',(select count(*) from public.jobs where status in ('accepted','en_route','arrived','in_progress')),
  'new_jobs_7d',(select count(*) from public.jobs where created_at>=now()-interval '7 days'),
  'urgent_jobs',(select count(*) from public.urgent_requests),
  'open_urgent',(select count(*) from public.urgent_requests where status not in ('completed','cancelled','expired')),
  'appointments_7d',(select count(*) from public.trade_appointments
    where starts_at between now() and now()+interval '7 days'
     and status not in ('cancelled','declined')),
  'quotes',(select count(*) from public.trade_quotes),
  'pending_approvals',(select count(*) from public.trade_customer_proposals where decision='pending'),
  'invoices',(select count(*) from public.trade_invoices),
  'issued_invoice_total_gbp',(select coalesce(sum(total),0) from public.trade_invoices where status in ('sent','paid')),
  'unpaid_invoice_total_gbp',(select coalesce(sum(total),0) from public.trade_invoices where status='sent'),
  'open_support',(select count(*) from public.support_requests where status in ('open','in_progress')),
  'urgent_support',(select count(*) from public.support_requests where priority='urgent' and status in ('open','in_progress')),
  'credential_queue',(select count(*) from public.trade_credential_submissions where status in ('submitted','reviewing')),
  'reviews',(select (select count(*) from public.job_reviews)+(select count(*) from public.market_job_reviews)),
  'audit_events_7d',(select count(*) from public.tradarr_admin_audit where created_at>=now()-interval '7 days'),
  'generated_at',now()
 ) into result;
 return result;
end $$;
revoke all on function public.tradarr_admin_dashboard() from public,anon;
grant execute on function public.tradarr_admin_dashboard() to authenticated;

create or replace function public.tradarr_admin_browse(
 p_section text, p_search text default '', p_limit int default 30
)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb := '[]'::jsonb;
 v_limit int := greatest(1,least(coalesce(p_limit,30),60));
 v_search text := lower(left(btrim(coalesce(p_search,'')),80));
begin
 if (select auth.uid()) is null or not (select trade_private.tradarr_staff_authorised()) then
  raise exception 'Verified administrator and second factor required' using errcode='42501';
 end if;
 case p_section
 when 'users' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
   select u.id,u.email,concat_ws(' ',nullif(p.first_name,''),nullif(p.last_name,'')) display_name,
    p.account_type,u.email_confirmed_at is not null email_verified,
    (t.user_id is not null) has_trade_profile,u.created_at
   from auth.users u
   left join public.profiles p on p.id=u.id
   left join public.tradesperson_profiles t on t.user_id=u.id
   where v_search='' or position(v_search in lower(coalesce(u.email,'')))>0
    or position(v_search in lower(concat_ws(' ',p.first_name,p.last_name)))>0
    or position(v_search in u.id::text)>0
   order by u.created_at desc limit v_limit
  ) x;
 when 'traders' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
   select t.user_id as id,t.display_name,t.primary_trade,t.is_verified,t.is_insured,
    t.rating,t.review_count,t.created_at,u.email,
    coalesce(a.is_available,false) is_available,
    coalesce(a.work_area_label,'') service_area
   from public.tradesperson_profiles t
   left join auth.users u on u.id=t.user_id
   left join public.trade_availability a on a.user_id=t.user_id
   where v_search='' or position(v_search in lower(coalesce(t.display_name,'')))>0
    or position(v_search in lower(coalesce(t.primary_trade,'')))>0
    or position(v_search in lower(coalesce(u.email,'')))>0
    or position(v_search in t.user_id::text)>0
   order by t.created_at desc limit v_limit
  ) x;
 when 'jobs' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
   select s.id,s.job_kind,s.trade,left(coalesce(s.issue,''),180) title,s.status,
    s.customer_id,s.accepted_tradesperson_id,s.job_mode,s.created_at
   from (
    select j.id,'standard'::text as job_kind,j.trade,j.issue,j.status,
      j.customer_id,j.accepted_tradesperson_id,j.job_mode,j.created_at
    from public.jobs j
    union all
    select r.id,'urgent'::text,r.trade,r.issue,r.status,
      r.customer_id,r.accepted_tradesperson_id,'urgent'::text,r.created_at
    from public.urgent_requests r
   ) s
   where v_search='' or position(v_search in lower(coalesce(s.issue,'')))>0
    or position(v_search in lower(coalesce(s.trade,'')))>0
    or position(v_search in s.id::text)>0
   order by s.created_at desc limit v_limit
  ) x;
 when 'finance' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
   select f.id,f.document_type,f.status,f.business_name,f.total,f.tradesperson_id,
     f.job_id,f.created_at
   from (
    select q.id,'quote'::text document_type,q.status,q.business_name,q.total,
     q.tradesperson_id,null::uuid as job_id,q.created_at
    from public.trade_quotes q
    union all
    select i.id,'invoice'::text,i.status,i.business_name,i.total,
     i.tradesperson_id,coalesce(i.app_job_id,i.urgent_request_id),i.created_at
    from public.trade_invoices i
   ) f
   where v_search='' or position(v_search in lower(coalesce(f.business_name,'')))>0
    or position(v_search in f.id::text)>0 or position(v_search in f.tradesperson_id::text)>0
   order by f.created_at desc limit v_limit
  ) x;
 when 'appointments' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
   select a.id,left(coalesce(a.title,''),140) title,a.status,a.tradesperson_id,
    a.customer_id,a.job_id,a.starts_at,a.ends_at,a.created_at
   from public.trade_appointments a
   where v_search='' or position(v_search in lower(coalesce(a.title,'')))>0
    or position(v_search in a.id::text)>0
   order by a.starts_at desc limit v_limit
  ) x;
 when 'reviews' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
   select r.id,r.review_type,r.job_id,r.customer_id,r.tradesperson_id,
     r.rating,left(coalesce(r.comment,''),250) comment,r.created_at
   from (
    select j.id,'urgent'::text review_type,j.request_id job_id,j.customer_id,
      j.tradesperson_id,j.rating,j.comment,j.created_at
    from public.job_reviews j
    union all
    select m.id,'standard'::text,m.job_id,m.customer_id,m.tradesperson_id,
      m.rating,m.comment,m.created_at
    from public.market_job_reviews m
   ) r
   where v_search='' or position(v_search in lower(coalesce(r.comment,'')))>0
    or position(v_search in r.job_id::text)>0 or position(v_search in r.tradesperson_id::text)>0
   order by r.created_at desc limit v_limit
  ) x;
 when 'cases' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
   select c.id,c.category,left(c.subject,150) subject,c.status,c.priority,
    c.submitted_by,c.assigned_to,c.created_at
   from public.support_requests c
   where v_search='' or position(v_search in lower(coalesce(c.subject,'')))>0
    or position(v_search in c.id::text)>0
   order by c.created_at desc limit v_limit
  ) x;
 when 'audit' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
   select a.id,a.action,a.target_type,a.target_id,a.actor_id,a.reason,a.created_at
   from public.tradarr_admin_audit a
   where v_search='' or position(v_search in lower(a.action))>0
    or position(v_search in lower(a.reason))>0
    or position(v_search in coalesce(a.target_id::text,''))>0
   order by a.created_at desc limit v_limit
  ) x;
 else
  raise exception 'Unsupported admin section' using errcode='22023';
 end case;
 return result;
end $$;
revoke all on function public.tradarr_admin_browse(text,text,int) from public,anon;
grant execute on function public.tradarr_admin_browse(text,text,int) to authenticated;

create or replace function public.tradarr_admin_record_note(
 p_target_type text,p_target_id uuid,p_reason text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare created_id uuid;
begin
 if (select auth.uid()) is null or not (select trade_private.tradarr_staff_authorised()) then
  raise exception 'Verified administrator and second factor required' using errcode='42501';
 end if;
 if p_target_type not in ('user','trader','job','invoice','quote','review','case') or p_target_id is null
   or char_length(btrim(coalesce(p_reason,'')))<10
   or char_length(p_reason)>2000 then
  raise exception 'Choose a valid entity and enter at least 10 characters' using errcode='22023';
 end if;
 insert into public.tradarr_admin_audit(actor_id,action,target_type,target_id,reason)
  values((select auth.uid()),'admin_note',p_target_type,p_target_id,btrim(p_reason))
  returning id into created_id;
 return created_id;
end $$;
revoke all on function public.tradarr_admin_record_note(text,uuid,text) from public,anon;
grant execute on function public.tradarr_admin_record_note(text,uuid,text) to authenticated;
