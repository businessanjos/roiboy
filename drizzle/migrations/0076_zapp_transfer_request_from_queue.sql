CREATE OR REPLACE FUNCTION public.request_zapp_conversation_transfer(_assignment_id uuid, _reason text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_me record; v_a record; v_conv record; v_agent uuid; v_owner text; v_id uuid; v_mgr record; v_contact text;
BEGIN
  SELECT id, name, account_id INTO v_me FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_me.id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT user_has_sector_access(auth.uid(), 'vendas') THEN RAISE EXCEPTION 'Sem acesso ao comercial'; END IF;
  SELECT * INTO v_a FROM zapp_conversation_assignments WHERE id = _assignment_id;
  IF v_a.id IS NULL OR v_a.account_id IS DISTINCT FROM v_me.account_id THEN RAISE EXCEPTION 'Conversa não encontrada'; END IF;
  SELECT * INTO v_conv FROM zapp_conversations WHERE id = COALESCE(v_a.zapp_conversation_id, v_a.conversation_id);
  IF COALESCE(v_conv.sector_id, (SELECT sector_id FROM zapp_departments WHERE id = v_a.department_id)) IS DISTINCT FROM 'vendas' THEN
    RAISE EXCEPTION 'Solicitação disponível só no setor Vendas';
  END IF;
  SELECT id INTO v_agent FROM zapp_agents WHERE user_id = v_me.id AND account_id = v_me.account_id AND COALESCE(is_active, true)
    ORDER BY (department_id = v_a.department_id) DESC NULLS LAST LIMIT 1;
  IF v_agent IS NULL THEN RAISE EXCEPTION 'Você não está cadastrado como atendente'; END IF;
  IF v_a.agent_id = v_agent THEN RAISE EXCEPTION 'Essa conversa já está com você'; END IF;
  IF EXISTS (SELECT 1 FROM zapp_conversation_transfer_requests WHERE assignment_id = _assignment_id AND requester_id = v_me.id AND status = 'pending') THEN
    RAISE EXCEPTION 'Você já pediu essa conversa. Aguarde o gestor.';
  END IF;
  IF v_a.agent_id IS NULL THEN v_owner := 'Fila / Triagem';
  ELSE SELECT u.name INTO v_owner FROM zapp_agents ag JOIN users u ON u.id = ag.user_id WHERE ag.id = v_a.agent_id; END IF;
  v_contact := COALESCE(NULLIF(trim(v_conv.contact_name), ''), v_conv.phone_e164, 'Contato');
  INSERT INTO zapp_conversation_transfer_requests(account_id, assignment_id, zapp_conversation_id, contact_name, requester_id,
    requester_agent_id, current_agent_id, current_owner_name, reason)
  VALUES (v_me.account_id, _assignment_id, v_conv.id, v_contact, v_me.id, v_agent, v_a.agent_id, v_owner, NULLIF(trim(_reason), ''))
  RETURNING id INTO v_id;
  FOR v_mgr IN SELECT u.id FROM users u WHERE u.account_id = v_me.account_id AND COALESCE(u.is_active, true)
      AND u.auth_user_id IS NOT NULL AND u.id <> v_me.id AND can_manage_spiff_payments(u.auth_user_id) LOOP
    INSERT INTO notifications(account_id, user_id, type, title, content, link, source_type, source_id, triggered_by_user_id, sector_id)
    VALUES (v_me.account_id, v_mgr.id, 'zapp_transfer_request', 'Pedido de transferência de conversa',
      v_me.name || ' pediu a conversa com ' || v_contact || ' (hoje com ' || v_owner || ')' || COALESCE(' — ' || NULLIF(trim(_reason), ''), ''),
      '/transferencia-conversa/' || v_id, 'zapp_transfer_request', v_id, v_me.id, 'vendas');
  END LOOP;
  RETURN v_id;
END $function$;

CREATE OR REPLACE FUNCTION public.zapp_can_pull_directly()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT COALESCE(can_manage_spiff_payments(auth.uid()), false) $$;
GRANT EXECUTE ON FUNCTION public.zapp_can_pull_directly() TO authenticated;