CREATE OR REPLACE FUNCTION public.list_deal_transfer_managers()
RETURNS TABLE(id uuid, name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT u.id, u.name FROM users u
  WHERE can_manage_spiff_payments(auth.uid())
    AND u.account_id = get_user_account_id() AND COALESCE(u.is_active, true)
    AND u.auth_user_id IS NOT NULL AND can_manage_spiff_payments(u.auth_user_id)
  ORDER BY u.name;
$$;

CREATE OR REPLACE FUNCTION public.set_deal_transfer_whatsapp_recipient(_user_id uuid, _phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_acc uuid := get_user_account_id(); v_target record; v_digits text := regexp_replace(coalesce(_phone,''), '\D', '', 'g');
BEGIN
  IF NOT can_manage_spiff_payments(auth.uid()) THEN RAISE EXCEPTION 'Apenas gestores'; END IF;
  SELECT id, account_id, auth_user_id INTO v_target FROM users WHERE id = _user_id;
  IF v_target.id IS NULL OR v_target.account_id IS DISTINCT FROM v_acc THEN RAISE EXCEPTION 'Gestor inválido'; END IF;
  IF _phone IS NULL THEN
    DELETE FROM deal_transfer_whatsapp_recipients WHERE account_id = v_acc AND user_id = _user_id;
    RETURN;
  END IF;
  IF v_target.auth_user_id IS NULL OR NOT can_manage_spiff_payments(v_target.auth_user_id) THEN RAISE EXCEPTION 'Essa pessoa não é gestora'; END IF;
  IF length(v_digits) < 10 OR length(v_digits) > 13 THEN RAISE EXCEPTION 'Telefone inválido'; END IF;
  IF length(v_digits) <= 11 THEN v_digits := '55' || v_digits; END IF;
  INSERT INTO deal_transfer_whatsapp_recipients(account_id, user_id, phone_e164)
  VALUES (v_acc, _user_id, '+' || v_digits)
  ON CONFLICT (account_id, user_id) DO UPDATE SET phone_e164 = EXCLUDED.phone_e164;
  INSERT INTO zapp_internal_contacts(account_id, phone_e164, label)
  SELECT v_acc, '+' || v_digits, 'Gestor (aviso de transferência)'
  WHERE NOT EXISTS (SELECT 1 FROM zapp_internal_contacts WHERE account_id = v_acc AND phone_e164 = '+' || v_digits);
END $$;
REVOKE ALL ON FUNCTION public.list_deal_transfer_managers() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_deal_transfer_whatsapp_recipient(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_deal_transfer_managers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_deal_transfer_whatsapp_recipient(uuid, text) TO authenticated;