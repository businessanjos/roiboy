
ALTER TABLE public.sales_team_careers 
  ADD COLUMN area text NOT NULL DEFAULT 'Comercial',
  ADD COLUMN cargo text NOT NULL DEFAULT 'Vendedor';
