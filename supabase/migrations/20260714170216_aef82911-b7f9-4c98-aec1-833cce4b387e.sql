
WITH pipe AS (
  SELECT '6a7ba647-37bb-4996-815c-f95025676a13'::uuid AS pipeline_id
), stage AS (
  SELECT id FROM public.deal_stages
  WHERE pipeline_id = (SELECT pipeline_id FROM pipe)
  ORDER BY display_order ASC LIMIT 1
)
INSERT INTO public.deals (account_id, lead_id, pipeline_id, stage_id, title, contact_email, contact_phone, source)
SELECT l.account_id, l.id, (SELECT pipeline_id FROM pipe), (SELECT id FROM stage), l.full_name, NULLIF(l.email,''), l.phone, 'typeform-backfill'
FROM public.leads l
WHERE l.id IN ('defbbe80-997e-4821-8c7f-adeca5ef9623','7c5932dc-e91a-471d-a11d-df250fc1b64d')
  AND NOT EXISTS (SELECT 1 FROM public.deals d WHERE d.lead_id = l.id);
