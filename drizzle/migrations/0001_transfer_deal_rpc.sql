CREATE OR REPLACE FUNCTION public.transfer_deal(_deal_id uuid, _new_owner_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_me record;
  v_deal record;
  v_new record;
  v_old_name text;
BEGIN
  SELECT id, name, account_id INTO v_me FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_me.id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;

  SELECT * INTO v_deal FROM public.deals WHERE id = _deal_id;
  IF v_deal.id IS NULL OR v_deal.account_id IS DISTINCT FROM v_me.account_id THEN
    RAISE EXCEPTION 'Negócio não encontrado';
  END IF;

  IF NOT public.can_view_deal(v_deal.status::text, v_deal.responsible_user_id, v_deal.sdr_user_id,
       v_deal.renewal_responsible_user_id, v_deal.created_by, v_deal.pipeline_id) THEN
    RAISE EXCEPTION 'Você não tem acesso a este negócio';
  END IF;

  SELECT id, name, account_id, is_active INTO v_new FROM public.users WHERE id = _new_owner_id;
  IF v_new.id IS NULL OR v_new.account_id IS DISTINCT FROM v_me.account_id THEN
    RAISE EXCEPTION 'Destinatário inválido';
  END IF;
  IF v_new.is_active = false THEN RAISE EXCEPTION 'Destinatário está inativo'; END IF;

  SELECT name INTO v_old_name FROM public.users WHERE id = v_deal.responsible_user_id;

  UPDATE public.deals SET responsible_user_id = _new_owner_id, updated_at = now() WHERE id = _deal_id;

  INSERT INTO public.deal_activities (account_id, deal_id, type, title, content, old_value, new_value, user_id)
  VALUES (v_deal.account_id, _deal_id, 'note', 'Transferência de responsável',
    COALESCE(NULLIF(trim(_reason), ''), 'Negócio transferido de ' || COALESCE(v_old_name, 'Sem responsável') || ' para ' || v_new.name),
    v_old_name, v_new.name, v_me.id);

  RETURN jsonb_build_object('ok', true, 'new_owner_name', v_new.name);
END;
$$;
REVOKE ALL ON FUNCTION public.transfer_deal(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_deal(uuid, uuid, text) TO authenticated;