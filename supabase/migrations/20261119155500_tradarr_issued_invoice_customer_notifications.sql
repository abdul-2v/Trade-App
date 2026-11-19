-- An invoice that becomes issued or paid notifies the correct customer.
-- Draft invoices and unrelated external jobs remain private to the professional.
alter table public.tradarr_notifications
 drop constraint if exists tradarr_notifications_kind_check;
alter table public.tradarr_notifications
 add constraint tradarr_notifications_kind_check
 check(kind in ('message','job_offer','job_accepted','job_status',
  'appointment','appointment_change','route_match','quote_update',
  'appointment_reminder','invoice_update'));

create or replace function trade_private.tradarr_customer_invoice_alert()
returns trigger language plpgsql security definer set search_path=''
as $$
declare recipient uuid;
begin
 if new.source<>'app' or new.status not in ('sent','paid') then return null; end if;
 if tg_op='UPDATE' and new.status is not distinct from old.status then return null; end if;
 if new.app_job_id is not null then
  select j.customer_id into recipient from public.jobs j
   where j.id=new.app_job_id and j.accepted_tradesperson_id=new.tradesperson_id;
 elsif new.urgent_request_id is not null then
  select r.customer_id into recipient from public.urgent_requests r
   where r.id=new.urgent_request_id and r.accepted_tradesperson_id=new.tradesperson_id;
 end if;
 if recipient is null then return null; end if;
 insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
 values(recipient,'invoice-status:'||new.id||':'||new.status,
  'invoice_update',
  case when new.status='paid' then 'Invoice marked paid' else 'Invoice available' end,
  case when new.status='paid' then 'Your tradesperson marked an invoice as paid. Review your records in Tradarr.'
       else 'An invoice for your Tradarr job is available to view or save.' end,
  jsonb_build_object('screen','customerInvoices','invoiceId',new.id,
   'jobId',coalesce(new.app_job_id,new.urgent_request_id)))
 on conflict(recipient_id,event_key) do nothing;
 return null;
end $$;
revoke all on function trade_private.tradarr_customer_invoice_alert() from public,anon,authenticated;
drop trigger if exists tradarr_customer_invoice_activity on public.trade_invoices;
create trigger tradarr_customer_invoice_activity
 after insert or update of status on public.trade_invoices
 for each row execute function trade_private.tradarr_customer_invoice_alert();
