CREATE OR REPLACE FUNCTION public.decide_deal_transfer(_request_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_me record; v_r record; v_title text;
BEGIN
  SELECT id, name, account_id INTO v_me FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_me.id IS NULL OR NOT can_manage_spiff_payments(auth.uid()) THEN RAISE EXCEPTION 'Apenas gestores podem decidir'; END IF;
  SELECT * INTO v_r FROM deal_transfer_requests WHERE id = _request_id FOR UPDATE;
  IF v_r.id IS NULL OR v_r.account_id IS DISTINCT FROM v_me.account_id THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF v_r.status <> 'pending' THEN RAISE EXCEPTION 'Solicitação já decidida'; END IF;
  SELECT title INTO v_title FROM deals WHERE id = v_r.deal_id;
  IF _approve THEN
    PERFORM transfer_deal(v_r.deal_id, v_r.requester_id, COALESCE(NULLIF(trim(_note),''), 'Transferência aprovada por ' || v_me.name || ' a pedido do vendedor'));
  END IF;
  UPDATE deal_transfer_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    decided_by = v_me.id, decided_at = now(), decision_note = NULLIF(trim(_note), '') WHERE id = _request_id;
  INSERT INTO notifications(account_id, user_id, type, title, content, link, source_type, source_id, triggered_by_user_id, sector_id)
  VALUES (v_r.account_id, v_r.requester_id, 'deal_transfer_decision',
    CASE WHEN _approve THEN 'Transferência aprovada' ELSE 'Transferência recusada' END,
    'Negócio "' || COALESCE(v_title,'') || '"' || COALESCE(' — ' || NULLIF(trim(_note), ''), ''),
    CASE WHEN _approve THEN '/pipeline?deal=' || v_r.deal_id ELSE '/leads' END,
    'deal_transfer_request', v_r.id, v_me.id, 'vendas');
  RETURN jsonb_build_object('ok', true);
END $$;