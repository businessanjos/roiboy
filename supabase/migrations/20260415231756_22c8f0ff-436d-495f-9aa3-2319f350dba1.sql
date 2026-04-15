CREATE TABLE public.sales_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  sale_date DATE,
  client_name TEXT,
  sale_value NUMERIC DEFAULT 0,
  seller_name TEXT,
  origin TEXT,
  city TEXT,
  address TEXT,
  first_contact DATE,
  cpf TEXT,
  cnpj TEXT,
  cep TEXT,
  payment_type TEXT,
  payment_method TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  product TEXT,
  current_revenue NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sales_history of their account"
ON public.sales_history FOR SELECT TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert sales_history for their account"
ON public.sales_history FOR INSERT TO authenticated
WITH CHECK (
  account_id IN (
    SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Users can update sales_history of their account"
ON public.sales_history FOR UPDATE TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete sales_history of their account"
ON public.sales_history FOR DELETE TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()
  )
);

CREATE INDEX idx_sales_history_account_id ON public.sales_history(account_id);
CREATE INDEX idx_sales_history_sale_date ON public.sales_history(sale_date);
CREATE INDEX idx_sales_history_seller ON public.sales_history(seller_name);
CREATE INDEX idx_sales_history_product ON public.sales_history(product);