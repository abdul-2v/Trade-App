-- Account enforcement and member-to-member blocking.
-- Suspensions preserve job and invoice records and never grant access to other accounts.
create table if not exists public.tradarr_account_moderation(
 user_id uuid primary key references auth.users(id) on delete cascade,
 suspended boolean not null default false,
 reason text not null check(char_length(btrim(reason)) between 12 and 2000),
 reviewed_by uuid not null references auth.users(id),
 reviewed_at timestamptz not null default now()
);
alter table public.tradarr_account_moderation enable row level security;
revoke all on public.tradarr_account_moderation from public,anon;
grant select on public.tradarr_account_moderation to authenticated;
drop policy if exists tradarr_account_moderation_staff_or_owner on public.tradarr_account_moderation;
create policy tradarr_account_moderation_staff_or_owner
 on public.tradarr_account_moderation for select to authenticated using(
  user_id=(select auth.uid()) or (select trade_private.tradarr_staff_authorised())
 );

create or replace function trade_private.tradarr_account_suspended(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tradarr_account_moderation m
  where m.user_id=p_id and m.suspended=true);
$$;
revoke all on function trade_private.tradarr_account_suspended(uuid) from public,anon,authenticated;
grant execute on function trade_private.tradarr_account_suspended(uuid) to authenticated;

create or replace function public.tradarr_admin_moderate_account(
 p_user_id uuid,p_action text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_state boolean;new_state boolean;
begin
 if (select auth.uid()) is null or not (select trade_private.tradarr_staff_authorised()) then
  raise exception 'Staff MFA required' using errcode='42501';
 end if;
 if p_user_id is null or p_user_id=(select auth.uid())
   or exists(select 1 from auth.users where id=p_user_id and raw_app_meta_data->>'tradarr_staff'='true') then
  raise exception 'Cannot moderate this administrative account' using errcode='42501';
 end if;
 if not exists(select 1 from auth.users where id=p_user_id) then
  raise exception 'User not found' using errcode='22023';
 end if;
 if p_action not in ('suspend','reinstate')
   or char_length(btrim(coalesce(p_reason,'')))<12 or char_length(p_reason)>2000 then
  raise exception 'Select suspend/reinstate and provide a reason' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,8121));
 select coalesce((select suspended from public.tradarr_account_moderation where user_id=p_user_id),false)
 into old_state;
 new_state:=(p_action='suspend');
 if old_state=new_state then raise exception 'Account already has that state' using errcode='23514';end if;
 insert into public.tradarr_account_moderation(user_id,suspended,reason,reviewed_by,reviewed_at)
 values(p_user_id,new_state,btrim(p_reason),(select auth.uid()),now())
 on conflict(user_id) do update set suspended=excluded.suspended,reason=excluded.reason,
  reviewed_by=excluded.reviewed_by,reviewed_at=now();
 if new_state then
  update public.trade_availability set is_available=false,available_until=now(),updated_at=now()
  where user_id=p_user_id;
 end if;
 insert into public.tradarr_admin_audit(actor_id,action,target_type,target_id,reason,metadata)
 values((select auth.uid()),
  case when new_state then 'account_suspended' else 'account_reinstated' end,
  'user',p_user_id,btrim(p_reason),jsonb_build_object('previous',old_state,'suspended',new_state));
 insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
 values(p_user_id,'account-moderation:'||gen_random_uuid(),'support_update',
  case when new_state then 'Account activity restricted' else 'Account access restored' end,
  case when new_state then 'Your Tradarr account cannot initiate new marketplace actions. Existing records and support remain accessible. You can appeal in Account.'
  else 'Your Tradarr marketplace access has been restored.' end,
  jsonb_build_object('screen','accountSafety'))
 on conflict(recipient_id,event_key) do nothing;
 return jsonb_build_object('user_id',p_user_id,'suspended',new_state);
end $$;
revoke all on function public.tradarr_admin_moderate_account(uuid,text,text) from public,anon;
grant execute on function public.tradarr_admin_moderate_account(uuid,text,text) to authenticated;

-- Write-only operational gates: retained user can still read records and contact support.
create or replace function trade_private.tradarr_block_suspended_writes()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (select auth.uid()) is not null
   and trade_private.tradarr_account_suspended((select auth.uid())) then
   raise exception 'Account restricted: you may review records and request an appeal, but cannot initiate marketplace activity'
    using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function trade_private.tradarr_block_suspended_writes() from public,anon,authenticated;
do $$
declare target_table text;
begin
 foreach target_table in array array[
 'messages','conversations','jobs','urgent_requests','job_offers',
 'trade_quotes','trade_invoices','trade_customer_proposals','trade_appointments',
 'trade_availability','trade_route_plans','trade_grid_requests',
 'trade_grid_slots','trade_collectives','trade_collective_offers',
 'trade_collective_members'
 ]
 loop
  execute format('drop trigger if exists tradarr_suspended_user_write on public.%I',target_table);
  execute format('create trigger tradarr_suspended_user_write before insert or update on public.%I for each row execute function trade_private.tradarr_block_suspended_writes()',target_table);
 end loop;
end $$;

-- Public listing suppression prevents a suspension from leaving location markers visible.
create or replace function trade_private.tradarr_trade_paused(p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tradarr_trade_moderation m
  where m.tradesperson_id=p_user_id and m.is_paused=true)
  or exists(select 1 from public.tradarr_account_moderation a
  where a.user_id=p_user_id and a.suspended=true);
$$;
revoke all on function trade_private.tradarr_trade_paused(uuid) from public;
grant execute on function trade_private.tradarr_trade_paused(uuid) to anon,authenticated;

create table if not exists public.tradarr_user_blocks(
 blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id),
 check(blocker_id<>blocked_id)
);
alter table public.tradarr_user_blocks enable row level security;
revoke all on public.tradarr_user_blocks from public,anon;
grant select,insert,delete on public.tradarr_user_blocks to authenticated;
drop policy if exists tradarr_blocks_owner_select on public.tradarr_user_blocks;
create policy tradarr_blocks_owner_select on public.tradarr_user_blocks
 for select to authenticated using(blocker_id=(select auth.uid()));
drop policy if exists tradarr_blocks_owner_insert on public.tradarr_user_blocks;
create policy tradarr_blocks_owner_insert on public.tradarr_user_blocks
 for insert to authenticated with check(blocker_id=(select auth.uid()));
drop policy if exists tradarr_blocks_owner_delete on public.tradarr_user_blocks;
create policy tradarr_blocks_owner_delete on public.tradarr_user_blocks
 for delete to authenticated using(blocker_id=(select auth.uid()));

create or replace function trade_private.tradarr_guard_blocked_message()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid;customer uuid;trader uuid;
begin
 select c.customer_id,c.tradesperson_id into customer,trader
 from public.conversations c where c.id=new.conversation_id;
 if customer is null then return new;end if;
 recipient:=case when new.sender_id=customer then trader else customer end;
 if exists(select 1 from public.tradarr_user_blocks b
   where (b.blocker_id=new.sender_id and b.blocked_id=recipient)
      or (b.blocker_id=recipient and b.blocked_id=new.sender_id)) then
    raise exception 'Messaging is blocked between these accounts' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function trade_private.tradarr_guard_blocked_message() from public,anon,authenticated;
drop trigger if exists tradarr_guard_blocked_message on public.messages;
create trigger tradarr_guard_blocked_message before insert on public.messages
 for each row execute function trade_private.tradarr_guard_blocked_message();
