-- Adicionar campo de faixa de faturamento aos leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS revenue_range TEXT;

-- Comentário para documentação
COMMENT ON COLUMN leads.revenue_range IS 'Faixa de faturamento do lead (ex: ate_81k, 81k_360k, etc)';