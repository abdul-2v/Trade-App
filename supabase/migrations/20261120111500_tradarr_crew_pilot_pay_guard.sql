-- Paid Crew listings: conservative 2026/27 UK NMW checks.
-- Apprentices may need a higher rate based on age/year. These checks are a floor,
-- not certification that a role's employment status or pay is lawful.
-- Reassess/update this function before 1 April 2027.
create or replace function trade_private.crew_pay_guard()
returns trigger language plpgsql security invoker set search_path='' as $crew$
declare
 v_floor numeric;
 v_hours numeric;
begin
 if new.status<>'open' then return new; end if;
 if current_date>=date '2027-04-01' then
  raise exception 'Crew wage rates require review before publishing listings from April 2027'
   using errcode='23514';
 end if;
 v_floor:=case when new.kind='apprentice' then 8.00::numeric else 12.71::numeric end;
 if new.pay_unit='year' then
  raise exception 'Annual salaries need contracted hours. Advertise hourly pay in Crew pilot.'
   using errcode='23514';
 end if;
 if new.kind='apprentice' and new.pay_unit<>'hour' then
  raise exception 'Apprenticeships must advertise hourly pay during the Crew pilot.'
   using errcode='23514';
 end if;
 if new.pay_unit='hour' and new.pay_amount<v_floor then
  raise exception 'The advertised hourly rate is below the Crew 2026/27 pilot minimum'
   using errcode='23514';
 end if;
 if new.pay_unit='day' then
  if new.starts_at is null or new.ends_at is null then
   raise exception 'Daily pay requires a start and end time to check the effective hourly rate'
    using errcode='23514';
  end if;
  v_hours:=extract(epoch from(new.ends_at-new.starts_at))/3600;
  if v_hours<=0 or v_hours>24 then
   raise exception 'Daily pay covers one shift of 24 hours or less'
    using errcode='23514';
  end if;
  if new.pay_amount<v_hours*v_floor then
   raise exception 'Daily pay does not meet the Crew 2026/27 pilot hourly-pay check'
    using errcode='23514';
  end if;
 end if;
 return new;
end;
$crew$;
revoke all on function trade_private.crew_pay_guard() from public,anon,authenticated;
drop trigger if exists crew_pay_guard on public.crew_requests;
create trigger crew_pay_guard before insert or update of pay_amount,pay_unit,kind,starts_at,ends_at,status
 on public.crew_requests for each row execute function trade_private.crew_pay_guard();
