UPDATE public.form_responses fr
SET client_id = c.id
FROM public.clients c
WHERE fr.client_id IS NULL
  AND fr.client_phone IS NOT NULL
  AND length(regexp_replace(fr.client_phone, '\D', '', 'g')) >= 8
  AND c.account_id = fr.account_id
  AND c.phone_e164 IS NOT NULL
  AND RIGHT(regexp_replace(c.phone_e164, '\D', '', 'g'), 8)
      = RIGHT(regexp_replace(fr.client_phone, '\D', '', 'g'), 8);