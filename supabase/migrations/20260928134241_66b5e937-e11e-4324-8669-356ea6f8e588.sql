CREATE OR REPLACE FUNCTION public.can_manage_spiff_payments(_auth_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    LEFT JOIN public.team_roles tr ON tr.id = u.team_role_id
    WHERE u.auth_user_id = _auth_user_id
      AND (
        u.role IN ('admin','super_admin','head','gestor','leader','mentor')
        OR COALESCE(u.is_also_admin,false)
        OR LOWER(COALESCE(tr.area,'')) IN ('financeiro','finance')
        OR LOWER(COALESCE(tr.cargo,'')) IN ('financeiro','finance','cfo','analista financeiro')
        OR (LOWER(COALESCE(tr.area,'')) IN ('comercial','vendas','sales')
            AND LOWER(COALESCE(tr.seniority,'')) IN ('head','líder','lider','gerente','gestor','manager','diretor','director'))
        OR EXISTS (
          SELECT 1 FROM public.user_team_roles utr
          JOIN public.team_roles t2 ON t2.id = utr.team_role_id
          WHERE utr.user_id = u.id
            AND (LOWER(t2.name) ~ '(admin|head|gerente|diretor|financeiro)')
        )
      )
  );
$function$;
GRANT EXECUTE ON FUNCTION public.can_manage_spiff_payments(uuid) TO authenticated;