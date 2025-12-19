-- Update existing accounts that don't have trial_ends_at set
UPDATE public.accounts 
SET trial_ends_at = now() + interval '7 days'
WHERE trial_ends_at IS NULL 
  AND subscription_status IN ('trial', NULL)
  AND plan_id IS NULL;