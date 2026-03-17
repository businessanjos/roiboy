
-- Create pipelines table
CREATE TABLE public.pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view pipelines of their account"
  ON public.pipelines FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert pipelines for their account"
  ON public.pipelines FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update pipelines of their account"
  ON public.pipelines FOR UPDATE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete pipelines of their account"
  ON public.pipelines FOR DELETE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

-- Add pipeline_id to deal_stages
ALTER TABLE public.deal_stages ADD COLUMN pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE CASCADE;

-- Add pipeline_id to deals
ALTER TABLE public.deals ADD COLUMN pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE SET NULL;

-- Create a default pipeline for each account that has deal_stages, and link existing data
DO $$
DECLARE
  acc RECORD;
  new_pipeline_id UUID;
BEGIN
  FOR acc IN SELECT DISTINCT account_id FROM public.deal_stages LOOP
    INSERT INTO public.pipelines (account_id, name, description, display_order)
    VALUES (acc.account_id, 'Pipeline Principal', 'Funil de vendas padrão', 0)
    RETURNING id INTO new_pipeline_id;

    UPDATE public.deal_stages SET pipeline_id = new_pipeline_id WHERE account_id = acc.account_id AND pipeline_id IS NULL;
    UPDATE public.deals SET pipeline_id = new_pipeline_id WHERE account_id = acc.account_id AND pipeline_id IS NULL;
  END LOOP;
END $$;

-- Now make pipeline_id NOT NULL on deal_stages (after data migration)
ALTER TABLE public.deal_stages ALTER COLUMN pipeline_id SET NOT NULL;

-- Index for performance
CREATE INDEX idx_deal_stages_pipeline_id ON public.deal_stages(pipeline_id);
CREATE INDEX idx_deals_pipeline_id ON public.deals(pipeline_id);
CREATE INDEX idx_pipelines_account_id ON public.pipelines(account_id);
