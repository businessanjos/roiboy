
ALTER TABLE public.financial_categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS code text;

CREATE INDEX IF NOT EXISTS idx_financial_categories_parent ON public.financial_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_financial_categories_code ON public.financial_categories(account_id, code);

-- Prevent cycles in category hierarchy
CREATE OR REPLACE FUNCTION public.prevent_financial_category_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cur uuid;
  depth int := 0;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Uma categoria não pode ser pai de si mesma';
  END IF;
  cur := NEW.parent_id;
  WHILE cur IS NOT NULL LOOP
    depth := depth + 1;
    IF depth > 20 THEN
      RAISE EXCEPTION 'Hierarquia de categorias muito profunda (máx 20 níveis)';
    END IF;
    IF cur = NEW.id THEN
      RAISE EXCEPTION 'Ciclo detectado na hierarquia de categorias';
    END IF;
    SELECT parent_id INTO cur FROM public.financial_categories WHERE id = cur;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_financial_category_cycle ON public.financial_categories;
CREATE TRIGGER trg_prevent_financial_category_cycle
BEFORE INSERT OR UPDATE OF parent_id ON public.financial_categories
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_category_cycle();

-- Require category on financial_entries (new + updated rows)
CREATE OR REPLACE FUNCTION public.require_financial_entry_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.category_id IS NULL THEN
    RAISE EXCEPTION 'É obrigatório classificar o lançamento em uma categoria do plano de contas';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_financial_entry_category ON public.financial_entries;
CREATE TRIGGER trg_require_financial_entry_category
BEFORE INSERT OR UPDATE ON public.financial_entries
FOR EACH ROW EXECUTE FUNCTION public.require_financial_entry_category();
