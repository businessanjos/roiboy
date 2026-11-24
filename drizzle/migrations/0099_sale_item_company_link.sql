CREATE OR REPLACE FUNCTION public.tg_validate_product_company_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = NEW.company_id AND c.account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'A empresa do produto deve pertencer à mesma conta.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_validate_product_company_account() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_validate_product_company_account
BEFORE INSERT OR UPDATE OF company_id, account_id ON public.products
FOR EACH ROW EXECUTE FUNCTION public.tg_validate_product_company_account();

CREATE OR REPLACE FUNCTION public.tg_sync_deal_company_from_sale_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_account uuid;
  v_deal uuid;
  v_field uuid;
  v_raw text;
  v_label text;
  v_options jsonb;
  v_company uuid;
  v_matches integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_account := OLD.account_id;
    v_deal := OLD.deal_id;
    v_field := OLD.field_id;
    v_raw := '';
  ELSE
    v_account := NEW.account_id;
    v_deal := NEW.deal_id;
    v_field := NEW.field_id;
    v_raw := btrim(COALESCE(NEW.value_text, ''));
    IF TG_OP = 'UPDATE' AND NEW.value_text IS NOT DISTINCT FROM OLD.value_text
      AND NEW.field_id = OLD.field_id AND NEW.deal_id = OLD.deal_id
      AND NEW.account_id = OLD.account_id THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT cf.options INTO v_options
  FROM public.custom_fields cf
  WHERE cf.id = v_field AND cf.account_id = v_account
    AND cf.name = 'Item da Venda' AND cf.show_in_deals;
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF v_raw = '' THEN
    SELECT c.id INTO v_company FROM public.companies c
    WHERE c.account_id = v_account AND c.is_default AND c.is_active
    ORDER BY c.id LIMIT 1;
  ELSE
    SELECT opt->>'label' INTO v_label
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_options) = 'array' THEN v_options ELSE '[]'::jsonb END) opt
    WHERE opt->>'value' = v_raw LIMIT 1;

    SELECT count(*), (array_agg(p.company_id))[1] INTO v_matches, v_company
    FROM public.products p
    JOIN public.companies c ON c.id = p.company_id AND c.account_id = p.account_id
    WHERE p.account_id = v_account
      AND (p.id::text = lower(v_raw)
        OR lower(btrim(p.name)) = lower(btrim(COALESCE(v_label, v_raw))));
    IF v_matches <> 1 THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;
  END IF;

  IF v_company IS NOT NULL THEN
    UPDATE public.deals SET company_id = v_company
    WHERE id = v_deal AND account_id = v_account
      AND company_id IS DISTINCT FROM v_company;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_sync_deal_company_from_sale_item() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_sync_deal_company_from_sale_item
AFTER INSERT OR UPDATE OF value_text, field_id, deal_id, account_id OR DELETE ON public.deal_field_values
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_deal_company_from_sale_item();
COMMENT ON FUNCTION public.tg_sync_deal_company_from_sale_item() IS 'Future sale-item writes inherit the product company, under caller RLS; no historical backfill and no contract or financial changes.';