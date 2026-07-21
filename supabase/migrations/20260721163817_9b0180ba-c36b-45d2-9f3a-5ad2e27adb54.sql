
UPDATE public.clients
SET city = NULL, state = NULL, country = NULL
WHERE coalesce(zip_code, business_zip_code) IN (
  '04542000','04551060','04578000','04538133','01415002','04534012','01311200'
) AND city ILIKE 'são paulo' AND state = 'SP';
