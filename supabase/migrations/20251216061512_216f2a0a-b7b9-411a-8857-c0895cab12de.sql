-- Create products table
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  billing_period public.billing_period NOT NULL DEFAULT 'monthly',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create client_products junction table
CREATE TABLE public.client_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(client_id, product_id)
);

-- Enable RLS on products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view products in their account" ON public.products
  FOR SELECT USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert products in their account" ON public.products
  FOR INSERT WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update products in their account" ON public.products
  FOR UPDATE USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete products in their account" ON public.products
  FOR DELETE USING (account_id = get_user_account_id());

-- Enable RLS on client_products
ALTER TABLE public.client_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view client_products in their account" ON public.client_products
  FOR SELECT USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert client_products in their account" ON public.client_products
  FOR INSERT WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can delete client_products in their account" ON public.client_products
  FOR DELETE USING (account_id = get_user_account_id());

-- Trigger for updated_at on products
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();