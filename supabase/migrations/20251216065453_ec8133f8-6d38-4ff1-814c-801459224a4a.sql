-- Add V-NPS configuration columns to account_settings
ALTER TABLE public.account_settings
ADD COLUMN IF NOT EXISTS vnps_risk_weight_low INTEGER NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS vnps_risk_weight_medium INTEGER NOT NULL DEFAULT 15,
ADD COLUMN IF NOT EXISTS vnps_risk_weight_high INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS vnps_eligible_min_score DECIMAL(3,1) NOT NULL DEFAULT 9.0,
ADD COLUMN IF NOT EXISTS vnps_eligible_max_risk INTEGER NOT NULL DEFAULT 20,
ADD COLUMN IF NOT EXISTS vnps_eligible_min_escore INTEGER NOT NULL DEFAULT 60;