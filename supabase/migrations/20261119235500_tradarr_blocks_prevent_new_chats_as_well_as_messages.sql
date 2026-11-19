-- Blocking must also prevent initiating a fresh chat, not only later messages.
-- Existing history remains available to participants for disputes and invoices.
create or replace function trade_private.tradarr_guard_blocked_conversation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.tradarr_user_blocks b
   where (b.blocker_id=new.customer_id and b.blocked_id=new.tradesperson_id)
      or (b.blocker_id=new.tradesperson_id and b.blocked_id=new.customer_id)) then
  raise exception 'A contact block prevents starting this conversation'
   using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function trade_private.tradarr_guard_blocked_conversation()
 from public,anon,authenticated;
drop trigger if exists tradarr_guard_blocked_conversation on public.conversations;
create trigger tradarr_guard_blocked_conversation
 before insert on public.conversations
 for each row execute function trade_private.tradarr_guard_blocked_conversation();
