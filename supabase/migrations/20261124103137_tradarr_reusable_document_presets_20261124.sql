-- Shared work and document preset library. User-owned and private by default.
-- The corresponding version has already been applied in production on 2026-11-24.
create table if not exists public.trade_document_presets (
 id uuid primary key default gen_random_uuid(),
 tradesperson_id uuid not null references auth.users(id) on delete cascade,
 scope text not null check (scope in ('line','invoice','quote','document')),
 document_kind text not null default '',
 name text not null check (length(btrim(name)) between 1 and 120),
 payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=32000),
 pinned boolean not null default false,
 usage_count integer not null default 0 check (usage_count between 0 and 1000000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists trade_document_presets_owner_scope_idx on public.trade_document_presets (tradesperson_id,scope,pinned desc,updated_at desc);
alter table public.trade_document_presets enable row level security;
revoke all on public.trade_document_presets from anon;
grant select,insert,update,delete on public.trade_document_presets to authenticated;
drop policy if exists "Saved document presets owner select" on public.trade_document_presets;
drop policy if exists "Saved document presets owner insert" on public.trade_document_presets;
drop policy if exists "Saved document presets owner update" on public.trade_document_presets;
drop policy if exists "Saved document presets owner delete" on public.trade_document_presets;
create policy "Saved document presets owner select" on public.trade_document_presets for select to authenticated using (tradesperson_id=(select auth.uid()));
create policy "Saved document presets owner insert" on public.trade_document_presets for insert to authenticated with check (tradesperson_id=(select auth.uid()));
create policy "Saved document presets owner update" on public.trade_document_presets for update to authenticated using (tradesperson_id=(select auth.uid())) with check (tradesperson_id=(select auth.uid()));
create policy "Saved document presets owner delete" on public.trade_document_presets for delete to authenticated using (tradesperson_id=(select auth.uid()));
-- Support customer-created documents as well as trade documents; auth.uid() is the owner in both cases.
alter table public.trade_document_presets rename column tradesperson_id to owner_id;
alter index if exists public.trade_document_presets_owner_scope_idx rename to trade_document_presets_user_scope_idx;
comment on table public.trade_document_presets is 'Private per-account reusable work prices and document field sets';
