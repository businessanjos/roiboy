ALTER TABLE public.spiff_spin_requests ADD COLUMN IF NOT EXISTS competence_month date;
ALTER TABLE public.spiff_spins ADD COLUMN IF NOT EXISTS competence_month date;

CREATE OR REPLACE FUNCTION public.decide_spin_request_by_phone(_request_id uuid, _phone text, _approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_r record; v_mgr uuid; v_digits text := regexp_replace(coalesce(_phone,''), '\D', '', 'g');
  v_seller text; v_spiff text;
BEGIN
  SELECT * INTO v_r FROM spiff_spin_requests WHERE id = _request_id;
  IF v_r.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  SELECT user_id INTO v_mgr FROM deal_transfer_whatsapp_recipients
   WHERE account_id = v_r.account_id AND length(v_digits) >= 10
     AND right(regexp_replace(phone_e164, '\D', '', 'g'), 8) = right(v_digits, 8) LIMIT 1;
  IF v_mgr IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_manager'); END IF;
  SELECT name INTO v_seller FROM users WHERE id = v_r.user_id;
  SELECT name INTO v_spiff FROM sales_spiffs WHERE id = v_r.spiff_id;
  IF v_r.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'already', v_r.status, 'seller_name', v_seller, 'spiff_name', v_spiff);
  END IF;
  UPDATE spiff_spin_requests
     SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
         reviewed_by = v_mgr, reviewed_at = now(), updated_at = now(),
         rejection_reason = CASE WHEN _approve THEN NULL ELSE 'Recusado pelo WhatsApp' END
   WHERE id = _request_id AND status = 'pending';
  RETURN jsonb_build_object('ok', true, 'status', CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    'seller_name', v_seller, 'spiff_name', v_spiff, 'competence_month', v_r.competence_month);
END $$;
REVOKE ALL ON FUNCTION public.decide_spin_request_by_phone(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_spin_request_by_phone(uuid, text, boolean) TO service_role;