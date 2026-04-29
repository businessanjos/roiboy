-- Templates of contracts (reusable per account, optionally tied to a product)
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  -- HTML/markup do contrato com placeholders no formato {{NOME_PLACEHOLDER}}
  content_html text NOT NULL DEFAULT '',
  -- Definição dos placeholders/variáveis configuráveis:
  -- [{ key: "RAZAO_SOCIAL", label: "Razão Social", type: "text"|"number"|"date"|"currency", default: "...", source: "client.full_name"|"deal.value"|null, required: bool }]
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_templates_account ON public.contract_templates(account_id);
CREATE INDEX IF NOT EXISTS idx_contract_templates_product ON public.contract_templates(product_id);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view contract templates"
  ON public.contract_templates FOR SELECT
  USING (user_belongs_to_account(account_id));

CREATE POLICY "Account members can insert contract templates"
  ON public.contract_templates FOR INSERT
  WITH CHECK (user_belongs_to_account(account_id));

CREATE POLICY "Account members can update contract templates"
  ON public.contract_templates FOR UPDATE
  USING (user_belongs_to_account(account_id));

CREATE POLICY "Account members can delete contract templates"
  ON public.contract_templates FOR DELETE
  USING (user_belongs_to_account(account_id));

CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add template/product linkage to digital_contracts
ALTER TABLE public.digital_contracts
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  -- snapshot do HTML do template (com placeholders ainda não substituídos) — preserva edições do usuário
  ADD COLUMN IF NOT EXISTS template_html text,
  -- definições das variáveis no momento da aplicação do template
  ADD COLUMN IF NOT EXISTS template_variables jsonb DEFAULT '[]'::jsonb,
  -- valores preenchidos pelo usuário/auto: { "RAZAO_SOCIAL": "...", "VALOR_TOTAL": 12000, ... }
  ADD COLUMN IF NOT EXISTS placeholder_values jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_digital_contracts_template ON public.digital_contracts(template_id);
CREATE INDEX IF NOT EXISTS idx_digital_contracts_product ON public.digital_contracts(product_id);