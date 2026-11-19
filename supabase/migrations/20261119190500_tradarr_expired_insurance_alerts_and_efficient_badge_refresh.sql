-- Avoid rewriting every reviewed profile each morning and alert on genuine loss
-- of an insured badge after evidence expiry.
create or replace function trade_private.tradarr_recompute_trade_badges(p_trade_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.trade_credential_submissions
               where tradesperson_id=p_trade_id) then return; end if;
 with flags as (
  select
   exists(select 1 from public.trade_credential_submissions c
    where c.tradesperson_id=p_trade_id and c.kind in ('identity','business')
      and c.status='approved') as verified,
   exists(select 1 from public.trade_credential_submissions c
    where c.tradesperson_id=p_trade_id and c.kind='insurance'
      and c.status='approved' and c.valid_until>=current_date) as insured
 )
 update public.tradesperson_profiles tp set
  is_verified=flags.verified,is_insured=flags.insured,updated_at=now()
 from flags where tp.user_id=p_trade_id
  and (tp.is_verified is distinct from flags.verified
       or tp.is_insured is distinct from flags.insured);
end $$;
revoke all on function trade_private.tradarr_recompute_trade_badges(uuid)
 from public,anon,authenticated;

create or replace function trade_private.tradarr_expire_credential_badges()
returns void language plpgsql security definer set search_path='' as $$
declare v_trade_id uuid;was_insured boolean;is_still_insured boolean;
begin
 for v_trade_id in
  select distinct c.tradesperson_id
  from public.trade_credential_submissions c
  join public.tradesperson_profiles tp on tp.user_id=c.tradesperson_id
  where c.kind='insurance' and c.status='approved' and c.valid_until<current_date
    and tp.is_insured=true
 loop
   select is_insured into was_insured
   from public.tradesperson_profiles where user_id=v_trade_id;
   perform trade_private.tradarr_recompute_trade_badges(v_trade_id);
   select is_insured into is_still_insured
   from public.tradesperson_profiles where user_id=v_trade_id;
   if was_insured and not coalesce(is_still_insured,false) then
     insert into public.tradarr_notifications
       (recipient_id,event_key,kind,title,body,data)
     values(v_trade_id,'insurance-expired:'||v_trade_id||':'||current_date,
       'verification_update','Insurance evidence expired',
       'Your insurance badge is no longer active. Submit your renewed policy for staff review.',
       jsonb_build_object('screen','tradeTrust'))
     on conflict(recipient_id,event_key) do nothing;
   end if;
 end loop;
end $$;
revoke all on function trade_private.tradarr_expire_credential_badges()
 from public,anon,authenticated;
;
