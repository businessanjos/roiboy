UPDATE public.hr_jobs
SET description = regexp_replace(description, '\s*_Candidata em proposta:[^_]*_\s*', '', 'gi')
WHERE id = '0a4f6377-66e3-4610-a4c8-dfb2043dcbd9';