-- Fase 1: Adicionar flag show_in_deals na tabela custom_fields
ALTER TABLE custom_fields ADD COLUMN IF NOT EXISTS show_in_deals BOOLEAN NOT NULL DEFAULT false;

-- Fase 2: Criar nova tabela deal_field_values para armazenar valores de campos personalizados em deals
CREATE TABLE IF NOT EXISTS public.deal_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value_text TEXT,
  value_number NUMERIC,
  value_boolean BOOLEAN,
  value_date DATE,
  value_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(deal_id, field_id)
);

-- Habilitar RLS
ALTER TABLE public.deal_field_values ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para deal_field_values
CREATE POLICY "Users can view deal field values from their account"
ON public.deal_field_values
FOR SELECT
USING (
  account_id IN (
    SELECT account_id FROM users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert deal field values in their account"
ON public.deal_field_values
FOR INSERT
WITH CHECK (
  account_id IN (
    SELECT account_id FROM users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update deal field values in their account"
ON public.deal_field_values
FOR UPDATE
USING (
  account_id IN (
    SELECT account_id FROM users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete deal field values in their account"
ON public.deal_field_values
FOR DELETE
USING (
  account_id IN (
    SELECT account_id FROM users WHERE id = auth.uid()
  )
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_deal_field_values_deal_id ON public.deal_field_values(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_field_values_field_id ON public.deal_field_values(field_id);
CREATE INDEX IF NOT EXISTS idx_deal_field_values_account_id ON public.deal_field_values(account_id);

-- Fase 3: Atualizar campos existentes para show_in_deals = true
-- (Os campos que devem pertencer a Deals)
UPDATE custom_fields 
SET show_in_deals = true, show_in_leads = false
WHERE name IN (
  'Canal de Venda',
  'Data do primeiro contato',
  'Descrição da Negociação da Venda',
  'Faturamento Atual',
  'Forma da Pagamento',
  'Forma de Pagamento',
  'Gravação da Sessão',
  'Item da Venda',
  'Link do contrato/invoice de compra',
  'Link do contrato/invoice',
  'MQL',
  '@ do Instagram',
  'Observações do Cliente',
  'Origem da Venda',
  'Q.I - Quem Indicou?',
  'Quem Indicou'
);

-- Fase 4: Migrar valores existentes de lead_field_values para deal_field_values
-- Para cada lead que possui um deal associado, copiar os valores
INSERT INTO deal_field_values (account_id, deal_id, field_id, value_text, value_number, value_boolean, value_date, value_json)
SELECT 
  lfv.account_id,
  d.id as deal_id,
  lfv.field_id,
  lfv.value_text,
  lfv.value_number,
  lfv.value_boolean,
  lfv.value_date,
  lfv.value_json
FROM lead_field_values lfv
INNER JOIN deals d ON d.lead_id = lfv.lead_id
INNER JOIN custom_fields cf ON cf.id = lfv.field_id
WHERE cf.show_in_deals = true
ON CONFLICT (deal_id, field_id) DO NOTHING;