-- Restore the minimum authenticated-client table grants for TradeHub.
-- Applied to the connected Supabase project on 2026-11-14.
-- All affected tables have RLS enabled; their existing policies still apply.

-- Auth registration triggers provision the account and trade-profile rows.
-- The client may modify only ordinary profile fields, not account type,
-- verification flags, insurance, rating or review-count statistics.
grant update (
  first_name, last_name, phone, default_address,
  notifications_enabled, updated_at
) on table public.profiles to authenticated;

grant update (
  display_name, business_name, primary_trade, bio,
  public_phone, avatar_url, updated_at
) on table public.tradesperson_profiles to authenticated;

-- Users manage only their own availability and location through RLS.
grant insert, update on table public.trade_availability to authenticated;
grant insert, update on table public.trade_locations to authenticated;
grant insert, update on table public.trade_map_presence to authenticated;

-- Conversations and messages are insert-only for mobile clients.
-- Message contents/sender IDs cannot be edited after sending.
grant insert on table public.conversations to authenticated;
grant insert on table public.messages to authenticated;
