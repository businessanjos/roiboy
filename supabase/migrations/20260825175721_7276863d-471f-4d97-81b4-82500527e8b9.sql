ALTER TABLE public.client_products
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_client_products_active ON public.client_products (client_id, is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_products TO authenticated;
GRANT ALL ON public.client_products TO service_role;

DROP POLICY IF EXISTS "Users can update client_products in their account" ON public.client_products;
CREATE POLICY "Users can update client_products in their account"
ON public.client_products FOR UPDATE
TO authenticated
USING (account_id = get_user_account_id())
WITH CHECK (account_id = get_user_account_id());