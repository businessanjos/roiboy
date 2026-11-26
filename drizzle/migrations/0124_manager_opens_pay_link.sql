CREATE OR REPLACE FUNCTION public.open_pay_link_as_manager(_deal_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_me record; v_deal record; v_id uuid;
BEGIN
  SELECT id, account_id INTO v_me FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_me.id IS NULL OR NOT can_manage_spiff_payments(auth.uid()) THEN RAISE EXCEPTION 'Somente gestores podem vincular'; END IF;
  IF NOT user_has_sector_access(auth.uid(), 'vendas') THEN RAISE EXCEPTION 'Sem acesso ao comercial'; END IF;
  SELECT id, account_id INTO v_deal FROM deals WHERE id = _deal_id AND deleted_at IS NULL;
  IF v_deal.id IS NULL OR v_deal.account_id IS DISTINCT FROM v_me.account_id OR NOT can_view_deal_id(_deal_id) THEN
    RAISE EXCEPTION 'Negócio não encontrado';
  END IF;
  -- Reuse the open request of this deal (the seller's or an earlier one of the manager) instead of opening a second.
  SELECT id INTO v_id FROM pay_link_requests WHERE deal_id = _deal_id AND status = 'pending' ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO pay_link_requests(account_id, deal_id, requester_id) VALUES (v_me.account_id, _deal_id, v_me.id) RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

REVOKE EXECUTE ON FUNCTION public.open_pay_link_as_manager(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.open_pay_link_as_manager(uuid) TO authenticated, service_role;