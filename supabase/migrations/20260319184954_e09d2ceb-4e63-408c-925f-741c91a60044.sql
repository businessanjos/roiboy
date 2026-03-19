
ALTER TABLE public.sales_call_analyses
ADD COLUMN deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL;

CREATE INDEX idx_sales_call_analyses_deal_id ON public.sales_call_analyses(deal_id);
