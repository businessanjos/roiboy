ALTER TABLE public.hr_departments
  ADD COLUMN IF NOT EXISTS show_in_org_chart boolean NOT NULL DEFAULT true;

INSERT INTO public.hr_departments (account_id, name, color, show_in_org_chart)
SELECT DISTINCT c.account_id, 'Diretoria', 'slate', false
FROM public.hr_service_providers c
WHERE c.department = 'Diretoria'
  AND NOT EXISTS (
    SELECT 1 FROM public.hr_departments d
    WHERE d.account_id = c.account_id AND lower(d.name) = 'diretoria'
  );