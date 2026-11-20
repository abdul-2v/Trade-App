-- Prepare an idempotent, private app-store event ledger.
-- No purchase endpoint or store billing is enabled by this schema.
ALTER TABLE public.tradarr_billing_controls
  DROP CONSTRAINT IF EXISTS tradarr_checkout_requires_verifier;
ALTER TABLE public.tradarr_billing_controls
  ADD CONSTRAINT tradarr_checkout_requires_verifier
  CHECK (NOT checkout_live OR receipt_verifier_ready);

CREATE TABLE IF NOT EXISTS public.tradarr_verified_purchase_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK(provider IN ('apple','google')),
  provider_event_id text NOT NULL CHECK(length(provider_event_id) BETWEEN 6 AND 200),
  event_type text NOT NULL CHECK(length(event_type) BETWEEN 3 AND 100),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_transaction_id text,
  verified_at timestamptz NOT NULL,
  processed_at timestamptz,
  payload_sha256 text CHECK(payload_sha256 IS NULL OR payload_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,provider_event_id)
);
CREATE INDEX IF NOT EXISTS tradarr_purchase_events_user_idx
  ON public.tradarr_verified_purchase_events(user_id,created_at DESC)
  WHERE user_id IS NOT NULL;
ALTER TABLE public.tradarr_verified_purchase_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tradarr_verified_purchase_events FROM public,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.tradarr_verified_purchase_events TO service_role;
-- Service-only. Apple/Google provider responses must be validated BEFORE writing.
-- Store raw receipts in no user-readable table and never trust client-provided tier.
