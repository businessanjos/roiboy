ALTER TABLE public.sales_incentive_plans
ADD COLUMN IF NOT EXISTS monthly_bonus_payment_channel text DEFAULT 'folha',
ADD COLUMN IF NOT EXISTS quarterly_bonus_payment_channel text DEFAULT 'ferias_co',
ADD COLUMN IF NOT EXISTS annual_bonus_payment_channel text DEFAULT 'ferias_co';

COMMENT ON COLUMN public.sales_incentive_plans.monthly_bonus_payment_channel IS 'Canal de pagamento do bônus mensal (folha, pj, ferias_co, cartao_flex, outro)';
COMMENT ON COLUMN public.sales_incentive_plans.quarterly_bonus_payment_channel IS 'Canal de pagamento do bônus trimestral';
COMMENT ON COLUMN public.sales_incentive_plans.annual_bonus_payment_channel IS 'Canal de pagamento do bônus anual';