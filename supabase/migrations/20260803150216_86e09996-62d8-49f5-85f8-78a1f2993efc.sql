UPDATE public.hr_jobs j
SET status = 'closed',
    closed_at = COALESCE(j.closed_at, a.admitted_at, now()),
    updated_at = now()
FROM (
  SELECT job_id, MAX(admitted_at) AS admitted_at
  FROM public.hr_admissions
  WHERE stage = 'admitted' AND job_id IS NOT NULL
  GROUP BY job_id
) a
WHERE j.id = a.job_id AND j.status <> 'closed';