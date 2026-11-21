-- Cover selected high-traffic foreign keys used by user safety, support and
-- account-deletion operations. No content is changed, and no permissions are granted.
create index if not exists crew_saved_worker_fk_idx
 on public.crew_saved(worker_id);
create index if not exists customer_home_records_property_customer_fk_idx
 on public.customer_home_records(property_id,customer_id);
create index if not exists market_job_reviews_customer_fk_idx
 on public.market_job_reviews(customer_id);
create index if not exists support_case_evidence_uploader_fk_idx
 on public.support_case_evidence(uploader_id);
create index if not exists support_case_updates_author_fk_idx
 on public.support_case_updates(author_id);
create index if not exists support_requests_assigned_fk_idx
 on public.support_requests(assigned_to);
create index if not exists tradarr_deletion_requests_handler_fk_idx
 on public.tradarr_account_deletion_requests(handled_by);
create index if not exists tradarr_account_moderation_reviewer_fk_idx
 on public.tradarr_account_moderation(reviewed_by);
