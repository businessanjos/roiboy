UPDATE public.zapp_conversations c
   SET phone_e164 = '+' || regexp_replace(c.external_thread_id, '\D', '', 'g')
 WHERE c.is_group = false
   AND length(regexp_replace(c.phone_e164, '\D', '', 'g')) BETWEEN 8 AND 11
   AND c.external_thread_id IS NOT NULL
   AND c.external_thread_id NOT LIKE '%@lid'
   AND length(regexp_replace(c.external_thread_id, '\D', '', 'g')) BETWEEN 12 AND 15
   AND NOT EXISTS (
     SELECT 1 FROM public.zapp_conversations o
      WHERE o.id <> c.id
        AND o.account_id = c.account_id
        AND o.integration_id IS NOT DISTINCT FROM c.integration_id
        AND o.phone_e164 = '+' || regexp_replace(c.external_thread_id, '\D', '', 'g')
   );