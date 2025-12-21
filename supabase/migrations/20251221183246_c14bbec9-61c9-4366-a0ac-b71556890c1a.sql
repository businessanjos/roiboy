-- Create enum for discount type
CREATE TYPE public.discount_type AS ENUM ('percentage', 'fixed');

-- Create coupons table
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  discount_type discount_type NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE,
  min_value NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  applies_to_subscriptions BOOLEAN NOT NULL DEFAULT true,
  applies_to_contracts BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id, code)
);

-- Create coupon_products junction table (for product-specific coupons)
CREATE TABLE public.coupon_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(coupon_id, product_id)
);

-- Create coupon_usages table to track usage
CREATE TABLE public.coupon_usages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.client_contracts(id) ON DELETE SET NULL,
  discount_applied NUMERIC NOT NULL DEFAULT 0,
  original_value NUMERIC NOT NULL DEFAULT 0,
  final_value NUMERIC NOT NULL DEFAULT 0,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;

-- RLS policies for coupons
CREATE POLICY "Users can view coupons in their account"
  ON public.coupons FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert coupons in their account"
  ON public.coupons FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update coupons in their account"
  ON public.coupons FOR UPDATE
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete coupons in their account"
  ON public.coupons FOR DELETE
  USING (account_id = get_user_account_id());

-- RLS policies for coupon_products
CREATE POLICY "Users can view coupon_products in their account"
  ON public.coupon_products FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert coupon_products in their account"
  ON public.coupon_products FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can delete coupon_products in their account"
  ON public.coupon_products FOR DELETE
  USING (account_id = get_user_account_id());

-- RLS policies for coupon_usages
CREATE POLICY "Users can view coupon_usages in their account"
  ON public.coupon_usages FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert coupon_usages in their account"
  ON public.coupon_usages FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

-- Trigger to update updated_at
CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to validate and apply coupon
CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_code TEXT,
  p_account_id UUID,
  p_value NUMERIC,
  p_product_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_discount NUMERIC;
  v_final_value NUMERIC;
  v_product_restricted BOOLEAN;
BEGIN
  -- Find the coupon
  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE UPPER(code) = UPPER(p_code)
    AND account_id = p_account_id
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom não encontrado');
  END IF;

  -- Check validity dates
  IF v_coupon.valid_from > now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom ainda não está válido');
  END IF;

  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom expirado');
  END IF;

  -- Check max uses
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.current_uses >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom atingiu o limite de usos');
  END IF;

  -- Check min value
  IF v_coupon.min_value IS NOT NULL AND p_value < v_coupon.min_value THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Valor mínimo não atingido: R$ ' || v_coupon.min_value);
  END IF;

  -- Check product restriction if product_id provided
  IF p_product_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.coupon_products 
      WHERE coupon_id = v_coupon.id
    ) INTO v_product_restricted;

    IF v_product_restricted THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.coupon_products 
        WHERE coupon_id = v_coupon.id AND product_id = p_product_id
      ) THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Cupom não é válido para este produto');
      END IF;
    END IF;
  END IF;

  -- Calculate discount
  IF v_coupon.discount_type = 'percentage' THEN
    v_discount := p_value * (v_coupon.discount_value / 100);
  ELSE
    v_discount := v_coupon.discount_value;
  END IF;

  -- Ensure discount doesn't exceed value
  IF v_discount > p_value THEN
    v_discount := p_value;
  END IF;

  v_final_value := p_value - v_discount;

  RETURN jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'discount_applied', v_discount,
    'original_value', p_value,
    'final_value', v_final_value,
    'description', v_coupon.description
  );
END;
$$;

-- Function to use a coupon (increment usage)
CREATE OR REPLACE FUNCTION public.use_coupon(
  p_coupon_id UUID,
  p_account_id UUID,
  p_client_id UUID DEFAULT NULL,
  p_contract_id UUID DEFAULT NULL,
  p_discount_applied NUMERIC DEFAULT 0,
  p_original_value NUMERIC DEFAULT 0,
  p_final_value NUMERIC DEFAULT 0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Increment usage counter
  UPDATE public.coupons
  SET current_uses = current_uses + 1
  WHERE id = p_coupon_id AND account_id = p_account_id;

  -- Record usage
  INSERT INTO public.coupon_usages (
    account_id, coupon_id, client_id, contract_id,
    discount_applied, original_value, final_value
  ) VALUES (
    p_account_id, p_coupon_id, p_client_id, p_contract_id,
    p_discount_applied, p_original_value, p_final_value
  );

  RETURN true;
END;
$$;