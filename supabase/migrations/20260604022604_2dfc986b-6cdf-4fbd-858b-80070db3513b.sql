
-- Backfill account_id in marketing_ad_sets from user
UPDATE public.marketing_ad_sets ms
SET account_id = u.account_id
FROM public.users u
WHERE ms.user_id = u.id
  AND ms.account_id IS NULL
  AND u.account_id IS NOT NULL;

-- Re-run rules for all accounts that have agencies
SELECT public.apply_agency_rules(account_id)
FROM (SELECT DISTINCT account_id FROM public.traffic_agencies WHERE account_id IS NOT NULL) s;
