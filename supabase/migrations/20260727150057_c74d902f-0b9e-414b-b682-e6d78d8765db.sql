-- Telas liberadas para o WhatsApp do Comercial
CREATE OR REPLACE FUNCTION public.zapp_sales_lean_views()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$ SELECT ARRAY['inbox','tags','playbook','sector','meetings']::text[] $$;

-- Usuários com acesso irrestrito ao ROY zAPP (sector pickers)
CREATE OR REPLACE FUNCTION public.zapp_is_unrestricted_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = _user_id
      AND lower(trim(u.email)) IN ('m.quintana@me.com','coachevertonsantos@gmail.com')
  )
$$;

-- Pessoa restrita ao Comercial: tem acesso ao setor vendas e a nenhum outro
-- setor com WhatsApp, e não é picker.
CREATE OR REPLACE FUNCTION public.zapp_is_sales_only_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT public.zapp_is_unrestricted_user(_user_id)
    AND EXISTS (
      SELECT 1 FROM public.user_sector_access a
      WHERE a.user_id = _user_id AND a.sector_id = 'vendas'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_sector_access a
      WHERE a.user_id = _user_id
        AND a.sector_id IN ('operacoes','financeiro','marketing')
    )
$$;

-- Regra central consultável pelo backend/edge functions
CREATE OR REPLACE FUNCTION public.zapp_user_can_use_view(_user_id uuid, _sector text, _view text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_views text[];
BEGIN
  IF public.zapp_is_unrestricted_user(_user_id) THEN
    RETURN true;
  END IF;

  IF _sector = 'vendas' THEN
    RETURN _view = ANY (public.zapp_sales_lean_views());
  END IF;

  SELECT views INTO v_views
  FROM public.user_royzapp_views
  WHERE user_id = _user_id
  LIMIT 1;

  IF v_views IS NULL OR array_length(v_views, 1) IS NULL THEN
    RETURN _view <> 'whatsapp-admin';
  END IF;

  RETURN _view = ANY (v_views);
END;
$$;

-- Sanitiza gravações: pessoa restrita ao Comercial nunca guarda telas fora da lista
CREATE OR REPLACE FUNCTION public.enforce_zapp_sales_lean_views()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.zapp_is_sales_only_user(NEW.user_id) THEN
    SELECT COALESCE(array_agg(v), ARRAY[]::text[])
    INTO NEW.views
    FROM unnest(COALESCE(NEW.views, ARRAY[]::text[])) AS v
    WHERE v = ANY (public.zapp_sales_lean_views());

    IF array_length(NEW.views, 1) IS NULL THEN
      NEW.views := public.zapp_sales_lean_views();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_zapp_sales_lean_views ON public.user_royzapp_views;
CREATE TRIGGER trg_enforce_zapp_sales_lean_views
BEFORE INSERT OR UPDATE ON public.user_royzapp_views
FOR EACH ROW EXECUTE FUNCTION public.enforce_zapp_sales_lean_views();

-- Alinha os registros atuais
UPDATE public.user_royzapp_views v
SET views = public.zapp_sales_lean_views()
WHERE public.zapp_is_sales_only_user(v.user_id);