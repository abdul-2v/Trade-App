-- Tradarr Pro launch preparation. This migration DOES NOT charge users or
-- impose job restrictions: every feature switch defaults to false.
-- Both ordinary/flexible and urgent acceptances must share the same quota.
ALTER TABLE public.tradarr_billing_controls
  ADD COLUMN IF NOT EXISTS receipt_verifier_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boosts_live boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_monthly_accepts integer NOT NULL DEFAULT 3;
ALTER TABLE public.tradarr_billing_controls
  DROP CONSTRAINT IF EXISTS tradarr_enforcement_requires_verifier;
ALTER TABLE public.tradarr_billing_controls
  ADD CONSTRAINT tradarr_enforcement_requires_verifier
  CHECK (NOT enforcement_live OR (checkout_live AND receipt_verifier_ready));
ALTER TABLE public.tradarr_billing_controls
  DROP CONSTRAINT IF EXISTS tradarr_boosts_require_verifier;
ALTER TABLE public.tradarr_billing_controls
  ADD CONSTRAINT tradarr_boosts_require_verifier
  CHECK (NOT boosts_live OR (checkout_live AND receipt_verifier_ready));
ALTER TABLE public.tradarr_billing_controls
  DROP CONSTRAINT IF EXISTS tradarr_free_accepts_limit_valid;
ALTER TABLE public.tradarr_billing_controls
  ADD CONSTRAINT tradarr_free_accepts_limit_valid
  CHECK (free_monthly_accepts BETWEEN 0 AND 20);

-- UTC month shared by all platforms and job types; atomic increments prevent
-- concurrent acceptances exceeding the published free allowance.
CREATE TABLE IF NOT EXISTS public.tradarr_pro_accept_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_start date NOT NULL,
  accepted_count integer NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,month_start)
);
ALTER TABLE public.tradarr_pro_accept_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tradarr_pro_accept_usage FROM public,anon,authenticated;
GRANT SELECT ON public.tradarr_pro_accept_usage TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.tradarr_pro_accept_usage TO service_role;
DROP POLICY IF EXISTS tradarr_pro_usage_owner_read ON public.tradarr_pro_accept_usage;
CREATE POLICY tradarr_pro_usage_owner_read ON public.tradarr_pro_accept_usage
 FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));

-- A boost can only be granted following a genuine store verification, using a
-- server credential. There is deliberately no client INSERT/UPDATE/DELETE.
CREATE TABLE IF NOT EXISTS public.tradarr_profile_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK(provider IN ('apple','google')),
  product_id text NOT NULL CHECK(length(product_id) BETWEEN 3 AND 160),
  verified_transaction_id text NOT NULL CHECK(length(verified_transaction_id) BETWEEN 8 AND 200),
  verified_at timestamptz NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tradarr_boost_valid_duration CHECK(ends_at > starts_at AND ends_at <= starts_at + interval '90 days'),
  UNIQUE(provider,verified_transaction_id)
);
CREATE INDEX IF NOT EXISTS tradarr_boost_active_owner_idx
 ON public.tradarr_profile_boosts(user_id,ends_at DESC)
 WHERE status='active';
ALTER TABLE public.tradarr_profile_boosts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tradarr_profile_boosts FROM public,anon,authenticated;
GRANT SELECT ON public.tradarr_profile_boosts TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.tradarr_profile_boosts TO service_role;
DROP POLICY IF EXISTS tradarr_boost_owner_read ON public.tradarr_profile_boosts;
CREATE POLICY tradarr_boost_owner_read ON public.tradarr_profile_boosts
 FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));

-- Reusable server-side guard. Does nothing in the development/beta phase.
-- When enabled, count only NEW acceptance events; never block declined offers,
-- accepted-job messaging, progress updates, existing bookings or safety access.
CREATE OR REPLACE FUNCTION trade_private.tradarr_guard_pro_acceptance()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_controls record;
  v_allowed boolean;
  v_trader uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     OR NEW.status <> 'accepted' OR OLD.status <> 'offered' THEN
    RETURN NEW;
  END IF;
  SELECT enforcement_live,free_monthly_accepts INTO v_controls
   FROM public.tradarr_billing_controls WHERE singleton=true;
  IF v_controls.enforcement_live IS DISTINCT FROM true THEN RETURN NEW; END IF;

  v_trader := NEW.tradesperson_id;
  IF v_trader IS NULL THEN
    RAISE EXCEPTION 'Missing tradesperson for this offer' USING ERRCODE='22023';
  END IF;
  -- Server-verified memberships are the only way to obtain unlimited access.
  IF EXISTS(
    SELECT 1 FROM public.tradarr_memberships m
    WHERE m.user_id=v_trader
      AND m.tier IN ('pro','business')
      AND m.status IN ('trial','active','grace','cancelled')
      AND m.valid_until>now()
  ) THEN RETURN NEW; END IF;

  INSERT INTO public.tradarr_pro_accept_usage
   (user_id,month_start,accepted_count,updated_at)
  VALUES (v_trader,date_trunc('month',now() AT TIME ZONE 'UTC')::date,1,now())
  ON CONFLICT(user_id,month_start) DO UPDATE SET
    accepted_count=public.tradarr_pro_accept_usage.accepted_count+1,
    updated_at=now()
  WHERE public.tradarr_pro_accept_usage.accepted_count < v_controls.free_monthly_accepts
  RETURNING true INTO v_allowed;

  IF v_allowed IS DISTINCT FROM true OR v_controls.free_monthly_accepts=0 THEN
    RAISE EXCEPTION 'Free job acceptance allowance reached. Your existing bookings remain accessible.'
      USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION trade_private.tradarr_guard_pro_acceptance() FROM public,anon,authenticated;
DROP TRIGGER IF EXISTS tradarr_pro_guard_market_accepts ON public.job_offers;
CREATE TRIGGER tradarr_pro_guard_market_accepts
 BEFORE UPDATE OF status ON public.job_offers
 FOR EACH ROW WHEN (OLD.status='offered' AND NEW.status='accepted')
 EXECUTE FUNCTION trade_private.tradarr_guard_pro_acceptance();
DROP TRIGGER IF EXISTS tradarr_pro_guard_urgent_accepts ON public.urgent_request_offers;
CREATE TRIGGER tradarr_pro_guard_urgent_accepts
 BEFORE UPDATE OF status ON public.urgent_request_offers
 FOR EACH ROW WHEN (OLD.status='offered' AND NEW.status='accepted')
 EXECUTE FUNCTION trade_private.tradarr_guard_pro_acceptance();

-- Read-only dashboard. Readable by each signed-in trader only under RLS.
-- A staged monthly limit is informational, NOT a current restriction.
CREATE OR REPLACE FUNCTION public.tradarr_my_pro_dashboard()
RETURNS TABLE(
 tier text,membership_status text,expires_at timestamptz,pro_access boolean,
 checkout_live boolean,enforcement_live boolean,free_monthly_accepts integer,
 accepts_used integer,accepts_remaining integer,boosts_live boolean,
 active_boosts integer,next_boost_expires_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public
AS $$
 WITH me AS (SELECT (SELECT auth.uid()) AS uid),
 billing AS (SELECT * FROM public.tradarr_billing_controls WHERE singleton=true)
 SELECT COALESCE(m.tier,'free')::text,
   COALESCE(m.status,'inactive')::text,
   m.valid_until,
   COALESCE(m.tier IN ('pro','business')
     AND m.status IN ('trial','active','grace','cancelled')
     AND m.valid_until>now(),false),
   COALESCE(b.checkout_live,false),
   COALESCE(b.enforcement_live,false),
   COALESCE(b.free_monthly_accepts,3),
   COALESCE(u.accepted_count,0),
   GREATEST(COALESCE(b.free_monthly_accepts,3)-COALESCE(u.accepted_count,0),0),
   COALESCE(b.boosts_live,false),
   (SELECT COUNT(*)::integer FROM public.tradarr_profile_boosts z
     WHERE z.user_id=me.uid AND z.status='active'
     AND z.starts_at<=now() AND z.ends_at>now()
     AND b.boosts_live=true),
   (SELECT MIN(z.ends_at) FROM public.tradarr_profile_boosts z
     WHERE z.user_id=me.uid AND z.status='active'
     AND z.starts_at<=now() AND z.ends_at>now()
     AND b.boosts_live=true)
 FROM me
 CROSS JOIN billing b
 LEFT JOIN public.tradarr_memberships m ON m.user_id=me.uid
 LEFT JOIN public.tradarr_pro_accept_usage u ON u.user_id=me.uid
   AND u.month_start=date_trunc('month',now() AT TIME ZONE 'UTC')::date
 WHERE me.uid IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.tradarr_my_pro_dashboard() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.tradarr_my_pro_dashboard() TO authenticated;
