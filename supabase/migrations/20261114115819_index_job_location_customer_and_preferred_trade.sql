-- Cover foreign keys used in customer-location lookup and preferred-tradesperson booking.
create index if not exists job_locations_customer_id_idx
  on public.job_locations (customer_id);
create index if not exists jobs_preferred_tradesperson_id_idx
  on public.jobs (preferred_tradesperson_id);
