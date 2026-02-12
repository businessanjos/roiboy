
-- Add display_order column to insights_dashboards
ALTER TABLE public.insights_dashboards 
ADD COLUMN display_order integer NOT NULL DEFAULT 0;

-- Initialize display_order based on existing created_at order per account
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY created_at ASC) - 1 AS rn
  FROM public.insights_dashboards
)
UPDATE public.insights_dashboards d
SET display_order = o.rn
FROM ordered o
WHERE d.id = o.id;
