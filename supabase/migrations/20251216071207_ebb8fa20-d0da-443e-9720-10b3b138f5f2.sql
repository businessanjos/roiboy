-- Add clinica_ryka to integration types
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'clinica_ryka';

-- Create sales_goals table for tracking client targets
CREATE TABLE public.sales_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  goal_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  external_id TEXT NULL,
  UNIQUE(client_id, period_start, period_end)
);

-- Create sales_records table for tracking actual sales
CREATE TABLE public.sales_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  sale_date DATE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  description TEXT NULL,
  external_id TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_records ENABLE ROW LEVEL SECURITY;

-- RLS policies for sales_goals
CREATE POLICY "Users can view sales_goals in their account"
  ON public.sales_goals FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert sales_goals in their account"
  ON public.sales_goals FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update sales_goals in their account"
  ON public.sales_goals FOR UPDATE
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete sales_goals in their account"
  ON public.sales_goals FOR DELETE
  USING (account_id = get_user_account_id());

-- RLS policies for sales_records
CREATE POLICY "Users can view sales_records in their account"
  ON public.sales_records FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert sales_records in their account"
  ON public.sales_records FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can delete sales_records in their account"
  ON public.sales_records FOR DELETE
  USING (account_id = get_user_account_id());

-- Add updated_at trigger for sales_goals
CREATE TRIGGER update_sales_goals_updated_at
  BEFORE UPDATE ON public.sales_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_sales_goals_client_id ON public.sales_goals(client_id);
CREATE INDEX idx_sales_goals_period ON public.sales_goals(period_start, period_end);
CREATE INDEX idx_sales_records_client_id ON public.sales_records(client_id);
CREATE INDEX idx_sales_records_sale_date ON public.sales_records(sale_date);