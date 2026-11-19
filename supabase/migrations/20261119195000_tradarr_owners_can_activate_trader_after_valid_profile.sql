-- Only enable professional account access after a genuine profile is saved.
-- This is a limited column grant, not broad profiles UPDATE permission.
grant update(account_type) on public.profiles to authenticated;

create or replace function trade_private.tradarr_guard_trade_role_activation()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.account_type is distinct from old.account_type then
  if old.account_type <> 'customer' or new.account_type <> 'tradesperson' then
   raise exception 'Account role changes are restricted' using errcode='42501';
  end if;
  if not exists (
   select 1 from public.tradesperson_profiles t
    where t.user_id=old.id
      and char_length(btrim(t.display_name))>=2
      and char_length(btrim(coalesce(t.primary_trade,'')))>=3
      and btrim(coalesce(t.primary_trade,''))<>'Tradesperson'
  ) then
   raise exception 'Complete your professional profile before enabling tradesperson mode'
    using errcode='23514';
  end if;
 end if;
 return new;
end $$;
revoke all on function trade_private.tradarr_guard_trade_role_activation() from public,anon,authenticated;
drop trigger if exists tradarr_guard_trade_role_activation on public.profiles;
create trigger tradarr_guard_trade_role_activation
 before update of account_type on public.profiles
 for each row execute function trade_private.tradarr_guard_trade_role_activation();
