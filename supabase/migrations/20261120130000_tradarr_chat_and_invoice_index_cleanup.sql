-- Invoice quote_id uniqueness is still enforced by tradarr_invoice_once_per_quote.
drop index if exists public.trade_invoices_quote_once_idx;
-- Improve participant cleanup and message maintenance at higher account counts.
create index if not exists conversation_typing_user_lookup_idx
 on public.conversation_typing(user_id);
create index if not exists crew_messages_sender_lookup_idx
 on public.crew_messages(sender_id);
