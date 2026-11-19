-- Quotes, signed-off customer proposals, jobs and invoices share one authoritative link.
-- A quote can generate at most one invoice, even during simultaneous taps.
create unique index if not exists tradarr_invoice_once_per_quote
 on public.trade_invoices(quote_id) where quote_id is not null;

create or replace function trade_private.tradarr_guard_delivered_quote()
returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.trade_customer_proposals p where p.quote_id=old.id)
  and (to_jsonb(new)-'status'-'invoice_id'-'updated_at')
      is distinct from (to_jsonb(old)-'status'-'invoice_id'-'updated_at') then
    raise exception 'An issued quotation cannot be edited; create a revised quote instead'
      using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function trade_private.tradarr_guard_delivered_quote() from public,anon,authenticated;
drop trigger if exists tradarr_guard_delivered_quote on public.trade_quotes;
create trigger tradarr_guard_delivered_quote before update on public.trade_quotes
 for each row execute function trade_private.tradarr_guard_delivered_quote();

create or replace function trade_private.tradarr_link_proposal_decision()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
   update public.trade_quotes q set status='sent',updated_at=now()
   where q.id=new.quote_id and q.tradesperson_id=new.tradesperson_id
    and q.status in ('draft','accepted');
 elsif tg_op='UPDATE' and old.decision is distinct from new.decision then
   update public.trade_quotes q set
     status=case new.decision when 'accepted' then 'accepted'
       when 'declined' then 'declined' else 'sent' end,updated_at=now()
   where q.id=new.quote_id and q.tradesperson_id=new.tradesperson_id
     and q.status<>'converted';
 end if;
 return null;
end $$;
revoke all on function trade_private.tradarr_link_proposal_decision() from public,anon,authenticated;
drop trigger if exists tradarr_link_proposal_decision on public.trade_customer_proposals;
create trigger tradarr_link_proposal_decision after insert or update of decision
 on public.trade_customer_proposals for each row execute function trade_private.tradarr_link_proposal_decision();

create or replace function trade_private.tradarr_invoice_immutable_link()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.quote_id is distinct from old.quote_id
   or new.app_job_id is distinct from old.app_job_id
   or new.urgent_request_id is distinct from old.urgent_request_id
   or new.tradesperson_id is distinct from old.tradesperson_id
   or new.source is distinct from old.source then
   raise exception 'Invoice source and job links cannot be reassigned' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function trade_private.tradarr_invoice_immutable_link() from public,anon,authenticated;
drop trigger if exists tradarr_invoice_immutable_link on public.trade_invoices;
create trigger tradarr_invoice_immutable_link before update on public.trade_invoices
 for each row execute function trade_private.tradarr_invoice_immutable_link();

create or replace function public.tradarr_convert_quote_to_invoice(p_quote_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare q public.trade_quotes%rowtype;
        delivery public.trade_customer_proposals%rowtype;
        v_invoice_id uuid;
begin
 if (select auth.uid()) is null then
  raise exception 'Sign in before invoicing' using errcode='42501';
 end if;
 select * into q from public.trade_quotes
 where id=p_quote_id and tradesperson_id=(select auth.uid()) for update;
 if not found then
  raise exception 'Quote is unavailable or not owned by this account' using errcode='42501';
 end if;
 if q.invoice_id is not null then return q.invoice_id; end if;
 select i.id into v_invoice_id from public.trade_invoices i
 where i.quote_id=q.id and i.tradesperson_id=q.tradesperson_id limit 1;
 if v_invoice_id is not null then
  update public.trade_quotes set invoice_id=v_invoice_id,status='converted',updated_at=now()
   where id=q.id;
  return v_invoice_id;
 end if;
 select * into delivery from public.trade_customer_proposals where quote_id=q.id;
 if found and delivery.decision<>'accepted' then
  raise exception 'The customer must accept the in-app quotation before an invoice can be created'
    using errcode='23514';
 end if;
 if q.status='declined' then
  raise exception 'A declined quote cannot become an invoice' using errcode='23514';
 end if;
 insert into public.trade_invoices(
  tradesperson_id,invoice_no,source,app_job_id,urgent_request_id,quote_id,customer_id,
  business_name,business_legal_name,business_address,business_email,business_phone,vat_number,
  customer_name,customer_email,customer_address,description,items,invoice_date,service_date,
  due_date,vat_rate,subtotal,vat_amount,total,payment_details,notes,status)
 values(
  q.tradesperson_id,0,case when delivery.id is null then 'external' else 'app' end,
  delivery.job_id,delivery.urgent_request_id,q.id,q.customer_id,
  q.business_name,null,q.business_address,q.business_email,q.business_phone,q.vat_number,
  q.customer_name,q.customer_email,q.customer_address,
  q.title||case when q.description is null then '' else E'\n'||q.description end,
  q.items,current_date,current_date,current_date+14,q.vat_rate,q.subtotal,q.vat_amount,
  q.total,null,q.notes,'draft')
 returning id into v_invoice_id;
 update public.trade_quotes set invoice_id=v_invoice_id,status='converted',updated_at=now()
  where id=q.id;
 return v_invoice_id;
end $$;
revoke all on function public.tradarr_convert_quote_to_invoice(uuid) from public,anon;
grant execute on function public.tradarr_convert_quote_to_invoice(uuid) to authenticated;
