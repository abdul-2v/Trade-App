-- Server-controlled rate limit for billed Google Routes calls.
-- The client cannot read or spend its own quota directly.
create table if not exists public.tradarr_road_route_quota (
 user_id uuid not null, usage_day date not null,
 request_count integer not null default 0,
 last_requested_at timestamptz not null default now(),
 primary key (user_id,usage_day),
 constraint tradarr_road_route_request_count_nonnegative check (request_count>=0)
);
alter table public.tradarr_road_route_quota enable row level security;
revoke all on public.tradarr_road_route_quota from public,anon,authenticated;
grant select,insert,update on public.tradarr_road_route_quota to service_role;
create or replace function public.tradarr_consume_road_route_quota(p_user_id uuid)
returns boolean language plpgsql volatile security invoker
set search_path=public as $$
declare v_allowed boolean;
begin
 if p_user_id is null then return false; end if;
 insert into public.tradarr_road_route_quota
  (user_id,usage_day,request_count,last_requested_at)
 values (p_user_id,(now() at time zone 'UTC')::date,1,now())
 on conflict (user_id,usage_day) do update
  set request_count=tradarr_road_route_quota.request_count+1,
      last_requested_at=now()
  where tradarr_road_route_quota.request_count<20
    and tradarr_road_route_quota.last_requested_at<=now()-interval '60 seconds'
 returning true into v_allowed;
 return coalesce(v_allowed,false);
end
$$;
revoke all on function public.tradarr_consume_road_route_quota(uuid) from public,anon,authenticated;
grant execute on function public.tradarr_consume_road_route_quota(uuid) to service_role;
