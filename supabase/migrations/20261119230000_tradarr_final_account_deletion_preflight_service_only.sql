-- Trusted edge service preflight for final Auth deletion. The API itself
-- cannot delete an account; it only reports whether a staged request is safe.
create or replace function public.tradarr_deletion_preflight(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid;v_status text;v_staff boolean;v_reasons jsonb:='[]'::jsonb;
begin
 if auth.role() is distinct from 'service_role' then
  raise exception 'Only the protected account privacy service may evaluate deletion' using errcode='42501';
 end if;
 select r.user_id,r.status into v_uid,v_status
 from public.tradarr_account_deletion_requests r
 where r.id=p_request_id;
 if v_uid is null then raise exception 'Deletion request not found' using errcode='22023';end if;
 select coalesce(u.raw_app_meta_data->>'tradarr_staff'='true',false)
 into v_staff from auth.users u where u.id=v_uid;
 if v_status<>'ready_for_deletion' then v_reasons:=v_reasons||jsonb_build_array('Request is not approved for final processing');end if;
 if v_staff then v_reasons:=v_reasons||jsonb_build_array('Staff accounts require separate administrative processing');end if;
 if exists(select 1 from public.jobs j where j.customer_id=v_uid
   or j.accepted_tradesperson_id=v_uid or j.preferred_tradesperson_id=v_uid) then
  v_reasons:=v_reasons||jsonb_build_array('Jobs or contractual history exists');end if;
 if exists(select 1 from public.urgent_requests r
   where r.customer_id=v_uid or r.accepted_tradesperson_id=v_uid) then
  v_reasons:=v_reasons||jsonb_build_array('Urgent job history exists');end if;
 if exists(select 1 from public.trade_appointments a
   where a.customer_id=v_uid or a.tradesperson_id=v_uid) then
  v_reasons:=v_reasons||jsonb_build_array('Appointment history exists');end if;
 if exists(select 1 from public.trade_invoices i where i.tradesperson_id=v_uid
   or i.customer_id=v_uid) or
   exists(select 1 from public.trade_quotes q where q.tradesperson_id=v_uid) then
  v_reasons:=v_reasons||jsonb_build_array('Quotes or invoices require retention review');end if;
 if exists(select 1 from public.trade_customer_proposals p
   where p.customer_id=v_uid or p.tradesperson_id=v_uid) then
  v_reasons:=v_reasons||jsonb_build_array('Customer proposal records exist');end if;
 if exists(select 1 from public.conversations c
   where c.customer_id=v_uid or c.tradesperson_id=v_uid) or
   exists(select 1 from public.messages m where m.sender_id=v_uid) then
  v_reasons:=v_reasons||jsonb_build_array('Conversation or message records exist');end if;
 if exists(select 1 from public.job_reviews r
   where r.customer_id=v_uid or r.tradesperson_id=v_uid) or
   exists(select 1 from public.market_job_reviews r
   where r.customer_id=v_uid or r.tradesperson_id=v_uid) then
  v_reasons:=v_reasons||jsonb_build_array('Review evidence exists');end if;
 if exists(select 1 from public.support_requests s where s.submitted_by=v_uid
   or s.assigned_to=v_uid) or
   exists(select 1 from public.tradarr_safety_reports r where r.reporter_id=v_uid
    or r.handled_by=v_uid) then
  v_reasons:=v_reasons||jsonb_build_array('Support or safety case records exist');end if;
 if exists(select 1 from public.trade_credential_submissions c
   where c.tradesperson_id=v_uid or c.reviewed_by=v_uid) then
  v_reasons:=v_reasons||jsonb_build_array('Verification documents require retention review');end if;
 if exists(select 1 from storage.objects o
   where o.owner_id=v_uid::text) then
  v_reasons:=v_reasons||jsonb_build_array('Owned private storage objects must be processed');end if;
 if exists(select 1 from public.tradarr_admin_audit a where a.actor_id=v_uid) then
  v_reasons:=v_reasons||jsonb_build_array('Administrative audit history exists');end if;
 return jsonb_build_object('request_id',p_request_id,'user_id',v_uid,
  'ready',v_status='ready_for_deletion',
  'eligible',jsonb_array_length(v_reasons)=0,'blockers',v_reasons);
end $$;
revoke all on function public.tradarr_deletion_preflight(uuid) from public,anon,authenticated;
grant execute on function public.tradarr_deletion_preflight(uuid) to service_role;
