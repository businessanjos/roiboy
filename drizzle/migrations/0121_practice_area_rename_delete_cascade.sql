CREATE OR REPLACE FUNCTION public.practice_area_key(_v text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT lower(regexp_replace(trim(public.unaccent(coalesce(_v, ''))), '\s+', ' ', 'g'))
$$;

-- Troca (ou remove, quando _new_label é nulo) uma área dentro da lista separada por vírgulas.
CREATE OR REPLACE FUNCTION public.practice_area_rewrite(_raw text, _old_key text, _new_label text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT nullif(string_agg(d.tok, ', ' ORDER BY d.ord), '')
  FROM (
    SELECT DISTINCT ON (public.practice_area_key(s.tok)) s.tok, s.ord
    FROM (
      SELECT CASE WHEN public.practice_area_key(u.x) = _old_key THEN _new_label ELSE trim(u.x) END AS tok,
             u.ord
      FROM unnest(string_to_array(coalesce(_raw, ''), ',')) WITH ORDINALITY AS u(x, ord)
    ) s
    WHERE s.tok IS NOT NULL AND trim(s.tok) <> ''
    ORDER BY public.practice_area_key(s.tok), s.ord
  ) d
$$;

CREATE OR REPLACE FUNCTION public.practice_area_can_manage()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_sector_access(auth.uid(), 'operacoes') OR public.is_super_admin()
$$;

-- Interno: aplica a troca nas fichas de uma conta. Não é chamável pelo app.
CREATE OR REPLACE FUNCTION public._practice_area_rewrite_records(_account uuid, _old_key text, _new_label text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clients integer := 0;
  v_leads integer := 0;
BEGIN
  IF _account IS NULL OR coalesce(_old_key, '') = '' THEN
    RETURN jsonb_build_object('clients', 0, 'leads', 0);
  END IF;

  UPDATE public.clients c
     SET business_niche = public.practice_area_rewrite(c.business_niche, _old_key, _new_label)
   WHERE c.account_id = _account
     AND c.business_niche IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM unnest(string_to_array(c.business_niche, ',')) x
       WHERE public.practice_area_key(x) = _old_key
     )
     AND public.practice_area_rewrite(c.business_niche, _old_key, _new_label) IS DISTINCT FROM c.business_niche;
  GET DIAGNOSTICS v_clients = ROW_COUNT;

  UPDATE public.leads l
     SET business_niche = public.practice_area_rewrite(l.business_niche, _old_key, _new_label)
   WHERE l.account_id = _account
     AND l.business_niche IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM unnest(string_to_array(l.business_niche, ',')) x
       WHERE public.practice_area_key(x) = _old_key
     )
     AND public.practice_area_rewrite(l.business_niche, _old_key, _new_label) IS DISTINCT FROM l.business_niche;
  GET DIAGNOSTICS v_leads = ROW_COUNT;

  RETURN jsonb_build_object('clients', v_clients, 'leads', v_leads);
END;
$$;

-- Interno: registra a mudança no histórico de auditoria.
CREATE OR REPLACE FUNCTION public._practice_area_audit(_account uuid, _action text, _entity_id uuid, _entity_name text, _details jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
BEGIN
  IF _account IS NULL THEN RETURN; END IF;
  SELECT u.id, u.name, u.email INTO v_user FROM public.users u WHERE u.auth_user_id = auth.uid() LIMIT 1;
  INSERT INTO public.audit_logs (account_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, details)
  VALUES (_account, v_user.id, v_user.name, v_user.email, _action, 'practice_area', _entity_id, _entity_name, _details);
END;
$$;

CREATE OR REPLACE FUNCTION public.practice_areas_usage()
RETURNS TABLE(area_key text, label text, area_id uuid, clients_count integer, leads_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH acc AS (
    SELECT public.get_my_account_id() AS id WHERE public.practice_area_can_manage()
  ),
  toks AS (
    SELECT 'c'::text AS src, c.id AS rid, public.practice_area_key(x) AS k, trim(x) AS lbl
      FROM public.clients c
      JOIN acc ON acc.id = c.account_id
      CROSS JOIN LATERAL unnest(string_to_array(c.business_niche, ',')) AS x
     WHERE c.business_niche IS NOT NULL
    UNION ALL
    SELECT 'l'::text, l.id, public.practice_area_key(x), trim(x)
      FROM public.leads l
      JOIN acc ON acc.id = l.account_id
      CROSS JOIN LATERAL unnest(string_to_array(l.business_niche, ',')) AS x
     WHERE l.business_niche IS NOT NULL
  ),
  agg AS (
    SELECT t.k,
           min(t.lbl) AS lbl,
           (count(DISTINCT t.rid) FILTER (WHERE t.src = 'c'))::integer AS cc,
           (count(DISTINCT t.rid) FILTER (WHERE t.src = 'l'))::integer AS lc
      FROM toks t
     WHERE t.k <> ''
     GROUP BY t.k
  ),
  pa AS (
    SELECT p.id, p.label AS plabel, public.practice_area_key(p.label) AS k
      FROM public.practice_areas p
     WHERE public.practice_area_can_manage()
  )
  SELECT coalesce(pa.k, a.k), coalesce(pa.plabel, a.lbl), pa.id, coalesce(a.cc, 0), coalesce(a.lc, 0)
    FROM agg a
    FULL JOIN pa ON pa.k = a.k
$$;

CREATE OR REPLACE FUNCTION public.rename_practice_area(_area_id uuid, _new_label text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.practice_areas%ROWTYPE;
  v_new text := regexp_replace(trim(coalesce(_new_label, '')), '\s+', ' ', 'g');
  v_other text;
  v_acc uuid := public.get_my_account_id();
  v_res jsonb;
BEGIN
  IF NOT public.practice_area_can_manage() THEN
    RAISE EXCEPTION 'Você não tem permissão para editar as áreas de atuação' USING ERRCODE = '42501';
  END IF;
  IF v_new = '' THEN
    RAISE EXCEPTION 'Informe um nome';
  END IF;
  IF position(',' IN v_new) > 0 THEN
    RAISE EXCEPTION 'O nome da área não pode ter vírgula';
  END IF;

  SELECT * INTO v_row FROM public.practice_areas p WHERE p.id = _area_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Área não encontrada';
  END IF;

  SELECT p.label INTO v_other
    FROM public.practice_areas p
   WHERE p.id <> _area_id
     AND public.practice_area_key(p.label) = public.practice_area_key(v_new)
   LIMIT 1;
  IF v_other IS NOT NULL THEN
    RAISE EXCEPTION 'Já existe a área "%". Para juntar as duas, exclua esta e mova as fichas para ela.', v_other
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.practice_areas p SET label = v_new, updated_at = now() WHERE p.id = _area_id;
  v_res := public._practice_area_rewrite_records(v_acc, public.practice_area_key(v_row.label), v_new);

  PERFORM public._practice_area_audit(v_acc, 'rename', _area_id, v_new,
    v_res || jsonb_build_object('old_label', v_row.label, 'new_label', v_new));

  RETURN v_res || jsonb_build_object('old_label', v_row.label, 'new_label', v_new);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_practice_area(_area_id uuid, _move_to uuid DEFAULT NULL, _remove_from_records boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.practice_areas%ROWTYPE;
  v_target text;
  v_acc uuid := public.get_my_account_id();
  v_key text;
  v_in_use integer := 0;
  v_res jsonb := jsonb_build_object('clients', 0, 'leads', 0);
BEGIN
  IF NOT public.practice_area_can_manage() THEN
    RAISE EXCEPTION 'Você não tem permissão para excluir áreas de atuação' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.practice_areas p WHERE p.id = _area_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Área não encontrada';
  END IF;
  v_key := public.practice_area_key(v_row.label);

  IF _move_to IS NOT NULL THEN
    IF _move_to = _area_id THEN
      RAISE EXCEPTION 'Escolha uma área diferente para receber as fichas';
    END IF;
    SELECT p.label INTO v_target FROM public.practice_areas p WHERE p.id = _move_to;
    IF v_target IS NULL THEN
      RAISE EXCEPTION 'A área de destino não existe mais';
    END IF;
  END IF;

  SELECT
    (SELECT count(*) FROM public.clients c
      WHERE c.account_id = v_acc AND c.business_niche IS NOT NULL
        AND EXISTS (SELECT 1 FROM unnest(string_to_array(c.business_niche, ',')) x WHERE public.practice_area_key(x) = v_key))
    +
    (SELECT count(*) FROM public.leads l
      WHERE l.account_id = v_acc AND l.business_niche IS NOT NULL
        AND EXISTS (SELECT 1 FROM unnest(string_to_array(l.business_niche, ',')) x WHERE public.practice_area_key(x) = v_key))
  INTO v_in_use;

  IF v_in_use > 0 THEN
    IF v_target IS NULL AND NOT coalesce(_remove_from_records, false) THEN
      RAISE EXCEPTION 'Esta área está em % ficha(s). Escolha para qual área mover ou confirme que ela deve sair das fichas.', v_in_use;
    END IF;
    v_res := public._practice_area_rewrite_records(v_acc, v_key, v_target);
  END IF;

  DELETE FROM public.practice_areas p WHERE p.id = _area_id;

  PERFORM public._practice_area_audit(v_acc, 'delete', _area_id, v_row.label,
    v_res || jsonb_build_object('deleted_label', v_row.label, 'moved_to', v_target));

  RETURN v_res || jsonb_build_object('deleted_label', v_row.label, 'moved_to', v_target);
END;
$$;

CREATE OR REPLACE FUNCTION public.move_practice_area_label(_from_label text, _move_to uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := public.practice_area_key(_from_label);
  v_target text;
  v_acc uuid := public.get_my_account_id();
  v_res jsonb;
BEGIN
  IF NOT public.practice_area_can_manage() THEN
    RAISE EXCEPTION 'Você não tem permissão para editar as áreas de atuação' USING ERRCODE = '42501';
  END IF;
  IF v_key = '' THEN
    RAISE EXCEPTION 'Informe o nome a mover';
  END IF;
  IF EXISTS (SELECT 1 FROM public.practice_areas p WHERE public.practice_area_key(p.label) = v_key) THEN
    RAISE EXCEPTION 'Este nome já é uma área oficial. Use editar ou excluir na lista.';
  END IF;
  SELECT p.label INTO v_target FROM public.practice_areas p WHERE p.id = _move_to;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'A área de destino não existe mais';
  END IF;

  v_res := public._practice_area_rewrite_records(v_acc, v_key, v_target);

  PERFORM public._practice_area_audit(v_acc, 'move', _move_to, v_target,
    v_res || jsonb_build_object('from_label', _from_label, 'moved_to', v_target));

  RETURN v_res || jsonb_build_object('from_label', _from_label, 'moved_to', v_target);
END;
$$;

REVOKE ALL ON FUNCTION public._practice_area_rewrite_records(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._practice_area_audit(uuid, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._practice_area_rewrite_records(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public._practice_area_audit(uuid, text, uuid, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.practice_areas_usage() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rename_practice_area(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_practice_area(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.move_practice_area_label(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.practice_area_can_manage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.practice_areas_usage() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rename_practice_area(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_practice_area(uuid, uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.move_practice_area_label(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.practice_area_can_manage() TO authenticated, service_role;