CREATE OR REPLACE FUNCTION public.validate_consultant_goal_seniority()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_seniorities text[];
  product_name text;
  consultant_position text;
  consultant_name text;
  seniority_key text;
BEGIN
  SELECT p.consultant_seniority, p.name
    INTO product_seniorities, product_name
  FROM public.products p
  WHERE p.id = NEW.product_id;

  -- Produto sem restrição: aceita qualquer consultora
  IF product_seniorities IS NULL OR array_length(product_seniorities, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT hc.position, hc.full_name
    INTO consultant_position, consultant_name
  FROM public.hr_collaborators hc
  WHERE hc.user_id = NEW.user_id
  ORDER BY hc.status = 'active' DESC
  LIMIT 1;

  -- Sem cadastro no RH, não há como inferir senioridade — bloqueia se produto exige
  IF consultant_position IS NULL THEN
    RAISE EXCEPTION 'Consultora sem cargo cadastrado no RH; produto "%" exige senioridade específica.', product_name
      USING ERRCODE = 'check_violation';
  END IF;

  seniority_key := lower(coalesce(consultant_position, ''));
  seniority_key := CASE
    WHEN seniority_key ~ '(l[ií]der|coordenador|gerente|head)' THEN 'lead'
    WHEN seniority_key ~ '(s[eê]nior|\msr\M)' THEN 'senior'
    WHEN seniority_key ~ '(pleno|\mpl\M)' THEN 'pleno'
    WHEN seniority_key ~ '(j[uú]nior|\mjr\M)' THEN 'junior'
    ELSE NULL
  END;

  IF seniority_key IS NULL OR NOT (seniority_key = ANY(product_seniorities)) THEN
    RAISE EXCEPTION 'Consultora % (cargo: %) não atende o produto "%". Senioridades permitidas: %.',
      coalesce(consultant_name, NEW.user_id::text),
      coalesce(consultant_position, '—'),
      product_name,
      array_to_string(product_seniorities, ', ')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_consultant_goal_seniority ON public.consultant_goals;
CREATE TRIGGER trg_validate_consultant_goal_seniority
BEFORE INSERT OR UPDATE OF product_id, user_id ON public.consultant_goals
FOR EACH ROW
EXECUTE FUNCTION public.validate_consultant_goal_seniority();