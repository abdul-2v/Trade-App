-- Receipt polling is server-side; the untrusted app cannot claim requests.
alter table public.tradarr_push_outbox
 add column if not exists receipt_check_attempts integer not null default 0,
 add column if not exists receipt_complete_at timestamptz;
create index if not exists tradarr_pending_push_receipts_idx
 on public.tradarr_push_outbox(processed_at,receipt_checked_at)
 where status='sent' and receipt_complete_at is null;
create or replace function public.tradarr_claim_push_receipts(p_limit integer default 10)
returns table(outbox_id uuid,recipient_id uuid,tickets jsonb,check_attempts integer)
language sql volatile security invoker set search_path=public as $$
 with picked as (
  select o.id from public.tradarr_push_outbox o
  where o.status='sent' and o.receipt_complete_at is null
   and jsonb_typeof(o.ticket_details)='array'
   and o.processed_at between now()-interval '23 hours' and now()-interval '15 minutes'
   and (o.receipt_checked_at is null or o.receipt_checked_at<now()-interval '10 minutes')
   and o.receipt_check_attempts<4
  order by o.processed_at asc
  limit least(greatest(coalesce(p_limit,10),1),15)
  for update skip locked
 )
 update public.tradarr_push_outbox o
 set receipt_checked_at=now(),receipt_check_attempts=o.receipt_check_attempts+1
 from picked p where o.id=p.id
 returning o.id,o.recipient_id,o.ticket_details,o.receipt_check_attempts
$$;
revoke all on function public.tradarr_claim_push_receipts(integer) from public,anon,authenticated;
grant execute on function public.tradarr_claim_push_receipts(integer) to service_role;
