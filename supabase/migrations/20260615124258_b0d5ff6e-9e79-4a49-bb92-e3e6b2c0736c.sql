
CREATE OR REPLACE FUNCTION public.check_integration_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  SELECT account_id INTO v_account_id
  FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF v_account_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_account');
  END IF;

  RETURN jsonb_build_object(
    'account_id', v_account_id,
    'instagram_total', (SELECT count(*) FROM public.instagram_profiles WHERE account_id = v_account_id),
    'tiktok_total',   (SELECT count(*) FROM public.tiktok_profiles    WHERE account_id = v_account_id),
    'youtube_total',  (SELECT count(*) FROM public.youtube_channels   WHERE account_id = v_account_id),
    'whatsapp_total', (SELECT count(*) FROM public.integrations       WHERE account_id = v_account_id AND provider IN ('uazapi','meta_official'))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_integration_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.request_integration_access(_platform text, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_user_id uuid;
  v_user_name text;
  v_owner_id uuid;
  v_count int := 0;
BEGIN
  SELECT id, account_id, COALESCE(name, email)
    INTO v_user_id, v_account_id, v_user_name
  FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_user');
  END IF;

  FOR v_owner_id IN
    SELECT id FROM public.users
    WHERE account_id = v_account_id
      AND (role = 'admin' OR is_also_admin = true)
      AND id <> v_user_id
  LOOP
    INSERT INTO public.notifications (account_id, user_id, type, title, content, triggered_by_user_id)
    VALUES (
      v_account_id,
      v_owner_id,
      'integration_access_request',
      'Pedido de acesso a integrações',
      COALESCE(v_user_name, 'Um usuário') || ' solicitou acesso às integrações de ' || _platform ||
        CASE WHEN _reason IS NOT NULL AND length(_reason) > 0 THEN ' — Motivo: ' || _reason ELSE '' END,
      v_user_id
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'notified', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_integration_access(text, text) TO authenticated;
