CREATE TABLE public.zapp_conversation_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  zapp_conversation_id uuid,
  contact_name text,
  requester_id uuid NOT NULL,
  requester_agent_id uuid NOT NULL,
  current_agent_id uuid,
  current_owner_name text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.zapp_conversation_transfer_requests TO authenticated;
GRANT ALL ON public.zapp_conversation_transfer_requests TO service_role;
ALTER TABLE public.zapp_conversation_transfer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requester or manager reads zapp transfer requests" ON public.zapp_conversation_transfer_requests
  FOR SELECT TO authenticated
  USING (account_id = public.get_current_user_account_id() AND (
    requester_id = public.get_current_user_id() OR public.can_manage_spiff_payments(auth.uid())));
CREATE INDEX idx_zctr_assignment ON public.zapp_conversation_transfer_requests(assignment_id, status);

CREATE OR REPLACE FUNCTION public.request_zapp_conversation_transfer(_assignment_id uuid, _reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  IF v_a.agent_id IS NULL OR v_a.agent_id = v_agent THEN RAISE EXCEPTION 'Essa conversa não está com outro atendente'; END IF;
  IF EXISTS (SELECT 1 FROM zapp_conversation_transfer_requests WHERE assignment_id = _assignment_id AND requester_id = v_me.id AND status = 'pending') THEN
    RAISE EXCEPTION 'Você já pediu essa conversa. Aguarde o gestor.';
  END IF;
  SELECT u.name INTO v_owner FROM zapp_agents ag JOIN users u ON u.id = ag.user_id WHERE ag.id = v_a.agent_id;
  v_contact := COALESCE(NULLIF(trim(v_conv.contact_name), ''), v_conv.phone_e164, 'Contato');
  INSERT INTO zapp_conversation_transfer_requests(account_id, assignment_id, zapp_conversation_id, contact_name, requester_id,
    requester_agent_id, current_agent_id, current_owner_name, reason)
  VALUES (v_me.account_id, _assignment_id, v_conv.id, v_contact, v_me.id, v_agent, v_a.agent_id, v_owner, NULLIF(trim(_reason), ''))
  RETURNING id INTO v_id;
  FOR v_mgr IN SELECT u.id FROM users u WHERE u.account_id = v_me.account_id AND COALESCE(u.is_active, true)
      AND u.auth_user_id IS NOT NULL AND u.id <> v_me.id AND can_manage_spiff_payments(u.auth_user_id) LOOP
    INSERT INTO notifications(account_id, user_id, type, title, content, link, source_type, source_id, triggered_by_user_id, sector_id)
    VALUES (v_me.account_id, v_mgr.id, 'zapp_transfer_request', 'Pedido de transferência de conversa',
      v_me.name || ' pediu a conversa com ' || v_contact || COALESCE(' (hoje com ' || v_owner || ')', '') || COALESCE(' — ' || NULLIF(trim(_reason), ''), ''),
      '/transferencia-conversa/' || v_id, 'zapp_transfer_request', v_id, v_me.id, 'vendas');
  END LOOP;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.decide_zapp_transfer_core(_request_id uuid, _manager_id uuid, _approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_r record; v_mgr record; v_req_name text; v_status text;
BEGIN
  SELECT * INTO v_r FROM zapp_conversation_transfer_requests WHERE id = _request_id FOR UPDATE;
  IF v_r.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  SELECT id, name, auth_user_id, account_id INTO v_mgr FROM users WHERE id = _manager_id;
  IF v_mgr.id IS NULL OR v_mgr.account_id <> v_r.account_id OR NOT can_manage_spiff_payments(v_mgr.auth_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_manager');
  END IF;
  IF v_r.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'already', v_r.status); END IF;
  v_status := CASE WHEN _approve THEN 'approved' ELSE 'rejected' END;
  UPDATE zapp_conversation_transfer_requests SET status = v_status, decided_by = _manager_id, decided_at = now() WHERE id = _request_id;
  IF _approve THEN
    UPDATE zapp_conversation_assignments SET agent_id = v_r.requester_agent_id, status = 'active',
      assigned_at = now(), updated_at = now() WHERE id = v_r.assignment_id;
    UPDATE zapp_conversation_transfer_requests SET status = 'rejected', decided_by = _manager_id, decided_at = now()
      WHERE assignment_id = v_r.assignment_id AND status = 'pending' AND id <> _request_id;
  END IF;
  SELECT name INTO v_req_name FROM users WHERE id = v_r.requester_id;
  INSERT INTO notifications(account_id, user_id, type, title, content, link, source_type, source_id, triggered_by_user_id, sector_id)
  VALUES (v_r.account_id, v_r.requester_id, 'zapp_transfer_decided',
    CASE WHEN _approve THEN 'Transferência aceita' ELSE 'Transferência recusada' END,
    split_part(v_mgr.name, ' ', 1) || CASE WHEN _approve THEN ' aprovou' ELSE ' recusou' END
      || ' a transferência da conversa com ' || COALESCE(v_r.contact_name, 'o contato'),
    '/royzapp', 'zapp_transfer_request', v_r.id, _manager_id, 'vendas');
  RETURN jsonb_build_object('ok', true, 'status', v_status, 'requester_name', v_req_name, 'contact_name', v_r.contact_name);
END $$;

CREATE OR REPLACE FUNCTION public.decide_zapp_transfer(_request_id uuid, _approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_res jsonb;
BEGIN
  SELECT id INTO v_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  v_res := decide_zapp_transfer_core(_request_id, v_id, _approve);
  IF v_res->>'error' = 'not_manager' THEN RAISE EXCEPTION 'Só gestores podem decidir'; END IF;
  IF (v_res->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'Esse pedido já foi %', CASE WHEN v_res->>'already' = 'approved' THEN 'aprovado' ELSE 'recusado' END;
  END IF;
  RETURN v_res;
END $$;

CREATE OR REPLACE FUNCTION public.decide_zapp_transfer_by_phone(_request_id uuid, _phone text, _approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_r record; v_mgr uuid; v_digits text := regexp_replace(coalesce(_phone,''), '\D', '', 'g');
BEGIN
  SELECT * INTO v_r FROM zapp_conversation_transfer_requests WHERE id = _request_id;
  IF v_r.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  SELECT user_id INTO v_mgr FROM deal_transfer_whatsapp_recipients
   WHERE account_id = v_r.account_id AND length(v_digits) >= 10
     AND right(regexp_replace(phone_e164, '\D', '', 'g'), 8) = right(v_digits, 8) LIMIT 1;
  IF v_mgr IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_manager'); END IF;
  RETURN decide_zapp_transfer_core(_request_id, v_mgr, _approve);
END $$;

REVOKE ALL ON FUNCTION public.decide_zapp_transfer_core(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decide_zapp_transfer_by_phone(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_zapp_transfer_core(uuid, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.decide_zapp_transfer_by_phone(uuid, text, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.request_zapp_conversation_transfer(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_zapp_transfer(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_zapp_conversation_transfer(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_zapp_transfer(uuid, boolean) TO authenticated;