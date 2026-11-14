-- User-owned saved tradespeople. Bookmarks must reference real registered trade profiles.
create table if not exists public.saved_tradespeople (
  customer_id uuid not null references auth.users(id) on delete cascade,
  tradesperson_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, tradesperson_id),
  constraint saved_tradespeople_not_self check (customer_id <> tradesperson_id)
);
create index if not exists saved_tradespeople_trade_idx
  on public.saved_tradespeople (tradesperson_id);
alter table public.saved_tradespeople enable row level security;
create policy saved_tradespeople_read_own on public.saved_tradespeople
  for select to authenticated using (customer_id = (select auth.uid()));
create policy saved_tradespeople_insert_own on public.saved_tradespeople
  for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and exists (select 1 from public.tradesperson_profiles tp where tp.user_id = tradesperson_id)
  );
create policy saved_tradespeople_delete_own on public.saved_tradespeople
  for delete to authenticated using (customer_id = (select auth.uid()));
grant select, insert, delete on public.saved_tradespeople to authenticated;
