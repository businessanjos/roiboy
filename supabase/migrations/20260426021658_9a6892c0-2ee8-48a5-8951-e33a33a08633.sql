-- Tabela de bônus por produto
CREATE TABLE public.product_bonuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT 'gray',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_bonuses_product ON public.product_bonuses(product_id);
CREATE INDEX idx_product_bonuses_account ON public.product_bonuses(account_id);

ALTER TABLE public.product_bonuses ENABLE ROW LEVEL SECURITY;

-- Reuse the same access pattern as products: account-scoped via get_user_account_id()
CREATE POLICY "Users can view bonuses in their account"
  ON public.product_bonuses FOR SELECT
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can insert bonuses in their account"
  ON public.product_bonuses FOR INSERT
  WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "Users can update bonuses in their account"
  ON public.product_bonuses FOR UPDATE
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can delete bonuses in their account"
  ON public.product_bonuses FOR DELETE
  USING (account_id = public.get_user_account_id());

CREATE TRIGGER update_product_bonuses_updated_at
  BEFORE UPDATE ON public.product_bonuses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();