UPDATE public.hr_collaborators
SET pda_level = NULL,
    pda_dominant_profile = NULL,
    pda_thermometer = NULL,
    pda_sectors = NULL,
    salary_with_charges = NULL
WHERE full_name ILIKE 'Camila Menaldo%';

DELETE FROM public.hr_pda_field_history
WHERE person_id IN (SELECT id FROM public.hr_collaborators WHERE full_name ILIKE 'Camila Menaldo%')
  AND created_at > now() - interval '2 hours';