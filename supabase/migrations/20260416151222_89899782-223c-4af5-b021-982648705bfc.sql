
ALTER TABLE public.sales_incentive_plans 
ADD COLUMN position_id UUID REFERENCES public.hr_positions(id) ON DELETE SET NULL;

-- Remove unique active constraint concept - now each position can have its own active plan
-- Create index for faster lookups
CREATE INDEX idx_sales_incentive_plans_position_id ON public.sales_incentive_plans(position_id);
