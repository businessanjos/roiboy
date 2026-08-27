CREATE OR REPLACE FUNCTION public.zapp_user_can_use_view(_user_id uuid, _sector text, _view text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_views text[];
  v_is_account_admin boolean;
  v_sector_role text;
BEGIN
  IF public.zapp_is_unrestricted_user(_user_id) THEN
    RETURN true;
  END IF;

  -- Gestão de conexões WhatsApp: liberada para admins da conta e para
  -- admin/gestor do setor em questão (inclusive no setor "vendas", que é lean).
  IF _view = 'whatsapp-admin' THEN
    SELECT (u.role IN ('admin','super_admin') OR u.is_also_admin IS TRUE)
      INTO v_is_account_admin
    FROM public.users u WHERE u.id = _user_id;

    IF v_is_account_admin THEN
      RETURN true;
    END IF;

    IF _sector IS NOT NULL THEN
      SELECT usa.role_in_sector INTO v_sector_role
      FROM public.user_sector_access usa
      WHERE usa.user_id = _user_id
        AND usa.sector_id = _sector
        AND usa.is_active IS NOT FALSE
      LIMIT 1;

      IF v_sector_role IN ('admin','manager') THEN
        RETURN true;
      END IF;
    END IF;
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
$function$;