CREATE OR REPLACE FUNCTION public.require_financial_entry_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Inserts must always have category
  IF TG_OP = 'INSERT' THEN
    IF NEW.category_id IS NULL THEN
      RAISE EXCEPTION 'É obrigatório classificar o lançamento em uma categoria do plano de contas';
    END IF;
    RETURN NEW;
  END IF;

  -- Updates: only block when actively clearing a previously set category
  IF TG_OP = 'UPDATE' THEN
    IF NEW.category_id IS NULL AND OLD.category_id IS NOT NULL THEN
      RAISE EXCEPTION 'É obrigatório classificar o lançamento em uma categoria do plano de contas';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;