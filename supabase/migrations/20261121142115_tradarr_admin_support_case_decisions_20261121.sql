-- This migration was applied to the shared Tradarr Supabase project as
-- 20261121142115_tradarr_admin_support_case_decisions_20261121.
-- Keeping the exact version in source prevents migration-history drift.
create or replace function public.tradarr_admin_support_decision(
 p_id uuid, p_status text, p_priority text, p_reason text
) returns uuid
language plpgsql security definer set search_path=''
as $fn$
declare v_previous public.support_requests%rowtype;
begin
 if (select auth.uid()) is null or not (select trade_private.tradarr_staff_authorised()) then
  raise exception 'Verified administrator and second factor required' using errcode='42501';
 end if;
 if p_id is null or p_status not in ('open','in_progress','resolved','closed')
   or p_priority not in ('normal','high','urgent')
   or char_length(btrim(coalesce(p_reason,'')))<12
   or char_length(coalesce(p_reason,''))>2000 then
  raise exception 'Choose a valid case state and a reason of 12-2000 characters' using errcode='22023';
 end if;
 select * into v_previous from public.support_requests where id=p_id for update;
 if not found then raise exception 'Support case not found' using errcode='22023'; end if;
 if v_previous.status=p_status and v_previous.priority=p_priority then
  raise exception 'No change to record; choose a different status or priority' using errcode='22023';
 end if;
 update public.support_requests
 set status=p_status, priority=p_priority,
     assigned_to=case when p_status='in_progress' then (select auth.uid()) else assigned_to end,
     resolution_note=case when p_status in ('resolved','closed') then btrim(p_reason) else resolution_note end
 where id=p_id;
 insert into public.tradarr_admin_audit
  (actor_id,action,target_type,target_id,reason,metadata)
 values
  ((select auth.uid()),'support_case_decision','case',p_id,btrim(p_reason),
   jsonb_build_object('previous_status',v_previous.status,'new_status',p_status,
    'previous_priority',v_previous.priority,'new_priority',p_priority));
 return p_id;
end
$fn$;
revoke all on function public.tradarr_admin_support_decision(uuid,text,text,text) from public, anon;
grant execute on function public.tradarr_admin_support_decision(uuid,text,text,text) to authenticated;
