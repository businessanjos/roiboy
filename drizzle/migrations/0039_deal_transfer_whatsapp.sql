CREATE TABLE public.deal_transfer_whatsapp_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  phone_e164 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, user_id)
);
GRANT SELECT ON public.deal_transfer_whatsapp_recipients TO authenticated;
GRANT ALL ON public.deal_transfer_whatsapp_recipients TO service_role;
ALTER TABLE public.deal_transfer_whatsapp_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dtwr_select_managers" ON public.deal_transfer_whatsapp_recipients FOR SELECT TO authenticated
USING (account_id = public.get_user_account_id() AND public.can_manage_spiff_payments(auth.uid()));

CREATE OR REPLACE FUNCTION public.decide_deal_transfer_core(_request_id uuid, _manager_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_mgr record; v_r record; v_deal record; v_new_name text; v_old_name text;
BEGIN
  SELECT id, name, account_id, auth_user_id INTO v_mgr FROM users WHERE id = _manager_id;
  IF v_mgr.id IS NULL OR v_mgr.auth_user_id IS NULL OR NOT can_manage_spiff_payments(v_mgr.auth_user_id) THEN
    RAISE EXCEPTION 'Apenas gestores podem decidir';
  END IF;
  SELECT * INTO v_r FROM deal_transfer_requests WHERE id = _request_id FOR UPDATE;
  IF v_r.id IS NULL OR v_r.account_id IS DISTINCT FROM v_mgr.account_id THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF v_r.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'already', v_r.status);
  END IF;
  SELECT * INTO v_deal FROM deals WHERE id = v_r.deal_id;
  SELECT name INTO v_new_name FROM users WHERE id = v_r.requester_id;
  IF _approve THEN
    SELECT name INTO v_old_name FROM users WHERE id = v_deal.responsible_user_id;
    UPDATE deals SET responsible_user_id = v_r.requester_id, updated_at = now() WHERE id = v_r.deal_id;
    INSERT INTO deal_activities (account_id, deal_id, type, title, content, old_value, new_value, user_id)
    VALUES (v_deal.account_id, v_r.deal_id, 'note', 'Transferência de responsável',
      COALESCE(NULLIF(trim(_note),''), 'Transferência aprovada por ' || v_mgr.name || ' a pedido de ' || COALESCE(v_new_name,'vendedor')),
      v_old_name, v_new_name, v_mgr.id);
  END IF;
  UPDATE deal_transfer_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    decided_by = v_mgr.id, decided_at = now(), decision_note = NULLIF(trim(_note), '') WHERE id = _request_id;
  INSERT INTO notifications(account_id, user_id, type, title, content, link, source_type, source_id, triggered_by_user_id, sector_id)
  VALUES (v_r.account_id, v_r.requester_id, 'deal_transfer_decision',
    CASE WHEN _approve THEN 'Transferência aprovada' ELSE 'Transferência recusada' END,
    'Negócio "' || COALESCE(v_deal.title,'') || '"' || COALESCE(' — ' || NULLIF(trim(_note), ''), ''),
    CASE WHEN _approve THEN '/pipeline?deal=' || v_r.deal_id ELSE '/sales-team/transfer-requests' END,
    'deal_transfer_request', v_r.id, v_mgr.id, 'vendas');
  RETURN jsonb_build_object('ok', true, 'status', CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    'deal_title', v_deal.title, 'requester_name', v_new_name, 'manager_name', v_mgr.name);
END $$;
REVOKE ALL ON FUNCTION public.decide_deal_transfer_core(uuid, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_deal_transfer_core(uuid, uuid, boolean, text) TO service_role;

CREATE OR REPLACE FUNCTION public.decide_deal_transfer(_request_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_res jsonb;
BEGIN
  SELECT id INTO v_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  v_res := decide_deal_transfer_core(_request_id, v_id, _approve, _note);
  IF (v_res->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'Esse pedido já foi %', CASE WHEN v_res->>'already' = 'approved' THEN 'aprovado' ELSE 'recusado' END;
  END IF;
  RETURN v_res;
END $$;

CREATE OR REPLACE FUNCTION public.decide_deal_transfer_by_phone(_request_id uuid, _phone text, _approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_r record; v_mgr uuid; v_digits text := regexp_replace(coalesce(_phone,''), '\D', '', 'g');
BEGIN
  SELECT * INTO v_r FROM deal_transfer_requests WHERE id = _request_id;
  IF v_r.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  SELECT user_id INTO v_mgr FROM deal_transfer_whatsapp_recipients
   WHERE account_id = v_r.account_id AND length(v_digits) >= 10
     AND right(regexp_replace(phone_e164, '\D', '', 'g'), 8) = right(v_digits, 8) LIMIT 1;
  IF v_mgr IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_manager'); END IF;
  RETURN decide_deal_transfer_core(_request_id, v_mgr, _approve, NULL);
END $$;
REVOKE ALL ON FUNCTION public.decide_deal_transfer_by_phone(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_deal_transfer_by_phone(uuid, text, boolean) TO service_role;