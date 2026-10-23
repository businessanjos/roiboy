CREATE OR REPLACE FUNCTION public.ensure_typeform_sale_origin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tag text;
  v_field record;
  v_options jsonb;
BEGIN
  -- Match the exact first title tag used by typeform-webhook.
  v_tag := substring(NEW.title FROM '^\[[^\]]+\]');
  IF v_tag IS NULL OR NEW.is_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Lock each field so concurrent form registrations cannot lose options.
  FOR v_field IN
    SELECT id, options FROM public.custom_fields
    WHERE account_id = NEW.account_id
      AND name = 'Origem da Venda'
      AND field_type = 'multi_select'
      AND show_in_deals = true
      AND is_active = true
    ORDER BY id
    FOR UPDATE
  LOOP
    v_options := COALESCE(v_field.options, '[]'::jsonb);
    IF jsonb_typeof(v_options) <> 'array' THEN
      RAISE EXCEPTION 'Não foi possível cadastrar a origem: confira as opções de Origem da Venda.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_options) AS o
      WHERE lower(btrim(o->>'label')) = lower(v_tag)
    ) THEN
      UPDATE public.custom_fields
      SET options = v_options || jsonb_build_array(jsonb_build_object(
        'label', v_tag,
        'value', 'opt_' || gen_random_uuid()::text,
        'color', 'blue'
      )), updated_at = now()
      WHERE id = v_field.id AND account_id = NEW.account_id;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_typeform_sale_origin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_typeform_sale_origin() TO service_role;
CREATE TRIGGER typeform_ensure_sale_origin
AFTER INSERT OR UPDATE OF title, is_active ON public.typeform_forms
FOR EACH ROW EXECUTE FUNCTION public.ensure_typeform_sale_origin();
COMMENT ON FUNCTION public.ensure_typeform_sale_origin() IS 'Registers the first Typeform title tag as a sale-origin option in the same account, preserving existing option IDs and serializing concurrent changes.';