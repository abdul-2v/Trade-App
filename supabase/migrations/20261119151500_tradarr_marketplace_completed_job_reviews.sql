-- Verified reviews of completed marketplace jobs, one per real job.
-- A review belongs to the completed job customer, never to a demo profile.
create table if not exists public.market_job_reviews (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null unique references public.jobs(id) on delete restrict,
 customer_id uuid not null references auth.users(id) on delete cascade,
 tradesperson_id uuid not null references public.tradesperson_profiles(user_id) on delete restrict,
 rating smallint not null check (rating between 1 and 5),
 comment text check (comment is null or length(comment) <= 500),
 created_at timestamptz not null default now(),
 constraint market_job_reviews_no_self_review check (customer_id <> tradesperson_id)
);
alter table public.market_job_reviews enable row level security;
revoke all on public.market_job_reviews from public,anon;
grant select,insert on public.market_job_reviews to authenticated;
drop policy if exists market_job_reviews_participants_read on public.market_job_reviews;
create policy market_job_reviews_participants_read
 on public.market_job_reviews for select to authenticated
 using (
  customer_id=(select auth.uid()) or tradesperson_id=(select auth.uid())
 );
drop policy if exists market_job_reviews_completed_customer_insert on public.market_job_reviews;
create policy market_job_reviews_completed_customer_insert
 on public.market_job_reviews for insert to authenticated
 with check (
  customer_id=(select auth.uid())
  and exists (
   select 1 from public.jobs j
   where j.id=market_job_reviews.job_id
    and j.customer_id=(select auth.uid())
    and j.accepted_tradesperson_id=market_job_reviews.tradesperson_id
    and j.status='completed'
  )
 );
create index if not exists market_job_reviews_trade_idx
 on public.market_job_reviews(tradesperson_id,created_at desc);

-- Both urgent-job and marketplace-job reviews count toward the public rating.
-- The existing job_reviews trigger already calls this private function.
create or replace function private.refresh_tradesperson_rating()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare v_trade_id uuid;
begin
  v_trade_id:=coalesce(new.tradesperson_id,old.tradesperson_id);
  update public.tradesperson_profiles tp set
    rating=coalesce((
      select round(avg(r.rating)::numeric,2)
      from (
        select rating::numeric from public.job_reviews where tradesperson_id=v_trade_id
        union all
        select rating::numeric from public.market_job_reviews where tradesperson_id=v_trade_id
      ) r
    ),0),
    review_count=(
      select count(*)::integer
      from (
        select 1 from public.job_reviews where tradesperson_id=v_trade_id
        union all
        select 1 from public.market_job_reviews where tradesperson_id=v_trade_id
      ) reviews
    ),
    updated_at=now()
  where tp.user_id=v_trade_id;
  return coalesce(new,old);
end $$;
revoke all on function private.refresh_tradesperson_rating() from public,anon,authenticated;
drop trigger if exists market_job_reviews_refresh_rating_trigger on public.market_job_reviews;
create trigger market_job_reviews_refresh_rating_trigger
 after insert or update or delete on public.market_job_reviews
 for each row execute function private.refresh_tradesperson_rating();
