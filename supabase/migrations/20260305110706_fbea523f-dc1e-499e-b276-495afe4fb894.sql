ALTER TABLE public.insights_dashboards ADD COLUMN IF NOT EXISTS sector TEXT NOT NULL DEFAULT 'vendas';
CREATE INDEX IF NOT EXISTS idx_insights_dashboards_sector ON public.insights_dashboards(sector);