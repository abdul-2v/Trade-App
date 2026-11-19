-- Preserve issued invoice amounts, customer details and document history.
-- An accepted-quote invoice always matches its quote snapshot, even as a draft.
-- Corrections require a new invoice; status updates stay available.
create or replace function trade_private.tradarr_issued_invoice_guard()
returns trigger language plpgsql set search_path=''
as $$
begin
 if old.status in ('sent','paid','void') or old.quote_id is not null then
   if (to_jsonb(new)-'status'-'updated_at')
      is distinct from (to_jsonb(old)-'status'-'updated_at') then
     raise exception 'Issued and quote-linked invoice contents are immutable; issue a corrected invoice'
      using errcode='42501';
   end if;
 end if;
 if new.status is distinct from old.status and not (
   (old.status='draft' and new.status in ('sent','void')) or
   (old.status='sent' and new.status in ('paid','void'))
 ) then
   raise exception 'Invalid invoice status change; issue before marking paid'
    using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function trade_private.tradarr_issued_invoice_guard() from public,anon,authenticated;
drop trigger if exists tradarr_issued_invoice_guard on public.trade_invoices;
create trigger tradarr_issued_invoice_guard before update on public.trade_invoices
 for each row execute function trade_private.tradarr_issued_invoice_guard();
