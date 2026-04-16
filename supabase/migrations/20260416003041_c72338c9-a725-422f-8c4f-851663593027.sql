
CREATE TABLE public.sales_product_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  year_month TEXT NOT NULL,
  target_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, product_id, user_id, year_month)
);

ALTER TABLE public.sales_product_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage product goals in their account"
ON public.sales_product_goals
FOR ALL
TO authenticated
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()))
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE INDEX idx_sales_product_goals_account_month ON public.sales_product_goals(account_id, year_month);
