CREATE TABLE public.deal_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  deal_id uuid NOT NULL,
  requester_id uuid NOT NULL,
  current_owner_id uuid,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX deal_transfer_requests_one_pending ON public.deal_transfer_requests(deal_id, requester_id) WHERE status = 'pending';
GRANT SELECT ON public.deal_transfer_requests TO authenticated;
GRANT ALL ON public.deal_transfer_requests TO service_role;
ALTER TABLE public.deal_transfer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dtr_select" ON public.deal_transfer_requests FOR SELECT TO authenticated
USING (account_id = public.get_user_account_id() AND (requester_id = public.get_current_user_id() OR public.can_manage_spiff_payments(auth.uid())));

CREATE OR REPLACE FUNCTION public.request_deal_transfer(_deal_id uuid, _reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_me record; v_deal record; v_id uuid; v_mgr record;
BEGIN
  SELECT id, name, account_id INTO v_me FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_me.id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT user_has_sector_access(auth.uid(), 'vendas') THEN RAISE EXCEPTION 'Sem acesso ao comercial'; END IF;
  SELECT * INTO v_deal FROM deals WHERE id = _deal_id AND deleted_at IS NULL;
  IF v_deal.id IS NULL OR v_deal.account_id IS DISTINCT FROM v_me.account_id THEN RAISE EXCEPTION 'Negócio não encontrado'; END IF;
  IF v_deal.responsible_user_id = v_me.id THEN RAISE EXCEPTION 'Este negócio já é seu'; END IF;
  IF EXISTS (SELECT 1 FROM deal_transfer_requests WHERE deal_id = _deal_id AND requester_id = v_me.id AND status = 'pending') THEN
    RAISE EXCEPTION 'Você já tem uma solicitação pendente para este negócio';
  END IF;
  INSERT INTO deal_transfer_requests(account_id, deal_id, requester_id, current_owner_id, reason)
  VALUES (v_me.account_id, _deal_id, v_me.id, v_deal.responsible_user_id, NULLIF(trim(_reason), ''))
  RETURNING id INTO v_id;
  FOR v_mgr IN SELECT u.id FROM users u WHERE u.account_id = v_me.account_id AND COALESCE(u.is_active, true)
      AND u.auth_user_id IS NOT NULL AND u.id <> v_me.id AND can_manage_spiff_payments(u.auth_user_id) LOOP
    INSERT INTO notifications(account_id, user_id, type, title, content, link, source_type, source_id, triggered_by_user_id, sector_id)
    VALUES (v_me.account_id, v_mgr.id, 'deal_transfer_request', 'Pedido de transferência de negócio',
      v_me.name || ' pediu o negócio "' || v_deal.title || '"' || COALESCE(' — ' || NULLIF(trim(_reason), ''), ''),
      '/sales-team/transfer-requests', 'deal_transfer_request', v_id, v_me.id, 'vendas');
  END LOOP;
  RETURN v_id;
END $$;

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
    CASE WHEN _approve THEN '/sales/pipeline?deal=' || v_r.deal_id ELSE '/sales/leads' END,
    'deal_transfer_request', v_r.id, v_me.id, 'vendas');
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.request_deal_transfer(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_deal_transfer(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_deal_transfer(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_deal_transfer(uuid, boolean, text) TO authenticated;