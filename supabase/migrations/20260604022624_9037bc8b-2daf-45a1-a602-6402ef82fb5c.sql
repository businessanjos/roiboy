
UPDATE public.marketing_ad_sets ms
SET account_id = u.account_id
FROM public.users u
WHERE u.auth_user_id = ms.user_id
  AND ms.account_id IS NULL
  AND u.account_id IS NOT NULL;

SELECT public.apply_agency_rules(account_id)
FROM (SELECT DISTINCT account_id FROM public.traffic_agencies WHERE account_id IS NOT NULL) s;
