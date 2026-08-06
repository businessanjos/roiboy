ALTER TABLE public.mi_competitors
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'nao_verificado',
  ADD COLUMN IF NOT EXISTS verification_note text,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE public.mi_competitors
  DROP CONSTRAINT IF EXISTS mi_competitors_verification_status_check;

ALTER TABLE public.mi_competitors
  ADD CONSTRAINT mi_competitors_verification_status_check
  CHECK (verification_status IN ('nao_verificado','verificado','contestado','removido'));

CREATE INDEX IF NOT EXISTS mi_competitors_verification_status_idx
  ON public.mi_competitors (account_id, verification_status);