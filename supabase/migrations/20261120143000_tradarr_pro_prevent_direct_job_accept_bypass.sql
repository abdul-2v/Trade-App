-- Guard against bypassing offer acceptance quota by updating jobs directly.
-- Existing normal acceptance goes job_offers -> private.handle_job_offer_response()
-- (a trusted security-definer function). Only enforce after launch switch.
CREATE OR REPLACE FUNCTION trade_private.tradarr_pro_block_direct_job_accept()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF OLD.status IN ('posted','offered')
     AND NEW.status = 'accepted'
     AND OLD.accepted_tradesperson_id IS NULL
     AND NEW.accepted_tradesperson_id IS NOT NULL
     AND current_user NOT IN ('postgres','service_role')
     AND EXISTS(
       SELECT 1 FROM public.tradarr_billing_controls
       WHERE singleton=true AND enforcement_live=true
     )
  THEN
    RAISE EXCEPTION
      'Accept this job through its offered job card so your membership allowance is checked'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION trade_private.tradarr_pro_block_direct_job_accept()
 FROM public,anon,authenticated;
DROP TRIGGER IF EXISTS tradarr_pro_prevent_direct_job_accept ON public.jobs;
CREATE TRIGGER tradarr_pro_prevent_direct_job_accept
 BEFORE UPDATE OF status,accepted_tradesperson_id ON public.jobs
 FOR EACH ROW
 EXECUTE FUNCTION trade_private.tradarr_pro_block_direct_job_accept();
