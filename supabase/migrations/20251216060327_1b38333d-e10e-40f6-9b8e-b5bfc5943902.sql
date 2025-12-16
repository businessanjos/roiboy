-- Create enum for payment status
CREATE TYPE public.payment_status AS ENUM (
  'active',
  'overdue', 
  'cancelled',
  'trial',
  'paused',
  'pending'
);

-- Create enum for billing period
CREATE TYPE public.billing_period AS ENUM (
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
  'one_time'
);

-- Create client subscriptions table
CREATE TABLE public.client_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'active',
  billing_period billing_period NOT NULL DEFAULT 'monthly',
  amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  next_billing_date date,
  end_date date,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view subscriptions in their account"
ON public.client_subscriptions
FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert subscriptions in their account"
ON public.client_subscriptions
FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update subscriptions in their account"
ON public.client_subscriptions
FOR UPDATE
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete subscriptions in their account"
ON public.client_subscriptions
FOR DELETE
USING (account_id = get_user_account_id());

-- Add updated_at trigger
CREATE TRIGGER update_client_subscriptions_updated_at
BEFORE UPDATE ON public.client_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_subscriptions;