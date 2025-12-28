-- Tabela para modelos de lançamento (templates de despesas/receitas frequentes)
CREATE TABLE public.financial_entry_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  default_amount NUMERIC,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_financial_entry_templates_account ON public.financial_entry_templates(account_id);
CREATE INDEX idx_financial_entry_templates_type ON public.financial_entry_templates(type);
CREATE INDEX idx_financial_entry_templates_use_count ON public.financial_entry_templates(use_count DESC);

-- Enable RLS
ALTER TABLE public.financial_entry_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view templates in their account"
  ON public.financial_entry_templates
  FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert templates in their account"
  ON public.financial_entry_templates
  FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update templates in their account"
  ON public.financial_entry_templates
  FOR UPDATE
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete templates in their account"
  ON public.financial_entry_templates
  FOR DELETE
  USING (account_id = get_user_account_id());

-- Função para incrementar contador de uso
CREATE OR REPLACE FUNCTION public.increment_template_usage(template_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE financial_entry_templates
  SET use_count = use_count + 1,
      last_used_at = now(),
      updated_at = now()
  WHERE id = template_id
    AND account_id = get_user_account_id();
END;
$$;