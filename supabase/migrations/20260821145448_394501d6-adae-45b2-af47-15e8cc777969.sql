UPDATE public.clients c
SET education = 'Biomedicina'
WHERE c.education = 'Medicina'
  AND (
    c.education_specialty ILIKE '%iomed%'
    OR EXISTS (SELECT 1 FROM public.form_responses fr WHERE fr.client_id = c.id AND fr.responses::text ILIKE '%iomed%')
  );