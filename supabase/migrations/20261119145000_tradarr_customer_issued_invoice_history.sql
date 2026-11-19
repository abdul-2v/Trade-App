-- Customer invoice history is only visible for real, assigned Tradarr jobs.
-- The trade_invoices.customer_id field refers to a private address-book record,
-- not the authenticated customer; ownership must be checked through the job.
alter table public.trade_invoices enable row level security;
drop policy if exists tradarr_customer_issued_invoice_read on public.trade_invoices;
create policy tradarr_customer_issued_invoice_read
 on public.trade_invoices for select to authenticated
 using (
  source = 'app'
  and status in ('sent','paid')
  and (
    (
      app_job_id is not null and exists (
        select 1 from public.jobs j
        where j.id = trade_invoices.app_job_id
          and j.customer_id = (select auth.uid())
          and j.accepted_tradesperson_id = trade_invoices.tradesperson_id
      )
    ) or (
      urgent_request_id is not null and exists (
        select 1 from public.urgent_requests r
        where r.id = trade_invoices.urgent_request_id
          and r.customer_id = (select auth.uid())
          and r.accepted_tradesperson_id = trade_invoices.tradesperson_id
    )
  ))
 );
create index if not exists tradarr_customer_invoice_job_lookup
 on public.trade_invoices(app_job_id,status) where app_job_id is not null;
create index if not exists tradarr_customer_invoice_urgent_lookup
 on public.trade_invoices(urgent_request_id,status) where urgent_request_id is not null;
