
-- Add commission_model and SDR-specific fields to commission_plans
ALTER TABLE public.commission_plans 
  ADD COLUMN IF NOT EXISTS commission_model text DEFAULT 'percent_tiers',
  ADD COLUMN IF NOT EXISTS sdr_value_per_call numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sdr_value_per_sale numeric DEFAULT 0;

-- Add sdr_user_id to deals to track which SDR originated the deal
ALTER TABLE public.deals 
  ADD COLUMN IF NOT EXISTS sdr_user_id uuid REFERENCES public.users(id);

-- Add index for SDR queries
CREATE INDEX IF NOT EXISTS idx_deals_sdr_user_id ON public.deals(sdr_user_id) WHERE sdr_user_id IS NOT NULL;
