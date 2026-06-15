DELETE FROM public.tech_project_snapshots
WHERE snapshot_date = CURRENT_DATE
  AND source = 'endpoint'
  AND project_id IN (SELECT id FROM public.tech_projects WHERE name ILIKE '%RYKA%');