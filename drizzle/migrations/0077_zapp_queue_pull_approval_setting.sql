ALTER TABLE public.zapp_account_settings ADD COLUMN IF NOT EXISTS sales_queue_pull_approval boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.zapp_queue_pull_approval_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT sales_queue_pull_approval FROM zapp_account_settings
    WHERE account_id = get_current_user_account_id()), true);
$$;

CREATE OR REPLACE FUNCTION public.set_zapp_queue_pull_approval(_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_acc uuid := get_current_user_account_id();
BEGIN
  IF v_acc IS NULL OR NOT can_manage_spiff_payments(auth.uid()) THEN RAISE EXCEPTION 'Só o gestor de Vendas pode alterar'; END IF;
  INSERT INTO zapp_account_settings(account_id, sales_queue_pull_approval, updated_at, updated_by)
  VALUES (v_acc, _enabled, now(), auth.uid())
  ON CONFLICT (account_id) DO UPDATE SET sales_queue_pull_approval = EXCLUDED.sales_queue_pull_approval, updated_at = now(), updated_by = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.notify_zapp_queue_pull(_assignment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_me record; v_a record; v_conv record; v_contact text; v_mgr record;
BEGIN
  SELECT id, name, account_id INTO v_me FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_me.id IS NULL THEN RETURN; END IF;
  SELECT * INTO v_a FROM zapp_conversation_assignments WHERE id = _assignment_id;
  IF v_a.id IS NULL OR v_a.account_id IS DISTINCT FROM v_me.account_id THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM zapp_agents WHERE id = v_a.agent_id AND user_id = v_me.id) THEN RETURN; END IF;
  SELECT * INTO v_conv FROM zapp_conversations WHERE id = COALESCE(v_a.zapp_conversation_id, v_a.conversation_id);
  v_contact := COALESCE(NULLIF(trim(v_conv.contact_name), ''), v_conv.phone_e164, 'Contato');
  FOR v_mgr IN SELECT u.id FROM users u WHERE u.account_id = v_me.account_id AND COALESCE(u.is_active, true)
      AND u.auth_user_id IS NOT NULL AND u.id <> v_me.id AND can_manage_spiff_payments(u.auth_user_id) LOOP
    INSERT INTO notifications(account_id, user_id, type, title, content, link, source_type, source_id, triggered_by_user_id, sector_id)
    VALUES (v_me.account_id, v_mgr.id, 'zapp_queue_pulled', 'Lead puxado da triagem',
      v_me.name || ' puxou da triagem o contato ' || v_contact,
      '/roy-zapp?sector=vendas', 'zapp_assignment', _assignment_id, v_me.id, 'vendas');
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.zapp_queue_pull_approval_enabled() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_zapp_queue_pull_approval(boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify_zapp_queue_pull(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zapp_queue_pull_approval_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_zapp_queue_pull_approval(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_zapp_queue_pull(uuid) TO authenticated;