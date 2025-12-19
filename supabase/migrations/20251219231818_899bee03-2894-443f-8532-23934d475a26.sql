-- Add plan_type column to subscription_plans to differentiate main plans from add-ons
ALTER TABLE public.subscription_plans 
ADD COLUMN plan_type text NOT NULL DEFAULT 'main';

-- Add comment to explain the field
COMMENT ON COLUMN public.subscription_plans.plan_type IS 'Type of plan: main (principal) or addon (complementar)';

-- Update existing plans based on name (assuming "Usuário Adicional" is an add-on)
UPDATE public.subscription_plans 
SET plan_type = 'addon' 
WHERE name ILIKE '%adicional%' OR name ILIKE '%add%on%' OR name ILIKE '%extra%';