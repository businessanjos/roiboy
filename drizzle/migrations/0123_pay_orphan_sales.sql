
CREATE TABLE public.pay_orphan_seed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  payer_name text NOT NULL,
  payer_email text NOT NULL,
  amount_cents integer NOT NULL,
  started_on date,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, external_id)
);
GRANT SELECT ON public.pay_orphan_seed TO authenticated;
GRANT ALL ON public.pay_orphan_seed TO service_role;
ALTER TABLE public.pay_orphan_seed ENABLE ROW LEVEL SECURITY;
CREATE POLICY pay_orphan_seed_select ON public.pay_orphan_seed FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id() AND public.can_manage_spiff_payments(auth.uid()));

CREATE TABLE public.pay_link_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL,
  suggested_source text CHECK (suggested_source IN ('rykapay','stripe_legacy')),
  suggested_external_id text,
  suggested_label text,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by uuid,
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pay_link_requests_one_pending ON public.pay_link_requests(deal_id) WHERE status = 'pending';
GRANT SELECT ON public.pay_link_requests TO authenticated;
GRANT ALL ON public.pay_link_requests TO service_role;
ALTER TABLE public.pay_link_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY pay_link_requests_select ON public.pay_link_requests FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id()
    AND (requester_id = public.get_current_user_id() OR public.can_manage_spiff_payments(auth.uid()) OR public.can_view_deal_id(deal_id)));

CREATE TABLE public.pay_sale_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('rykapay','stripe_legacy')),
  external_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('auto','manager')),
  payer_name text,
  amount_cents integer,
  paid_on date,
  request_id uuid REFERENCES public.pay_link_requests(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, source, external_id)
);
CREATE INDEX pay_sale_links_deal ON public.pay_sale_links(deal_id);
GRANT SELECT ON public.pay_sale_links TO authenticated;
GRANT ALL ON public.pay_sale_links TO service_role;
ALTER TABLE public.pay_sale_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY pay_sale_links_select ON public.pay_sale_links FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id());

CREATE TABLE public.pay_third_party_payers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  lead_id uuid,
  client_id uuid,
  origin_deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  name text NOT NULL,
  document text,
  email text,
  relationship text NOT NULL CHECK (relationship IN ('partner','spouse','company_card','other')),
  relationship_other text,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pay_third_party_payers_lead ON public.pay_third_party_payers(lead_id);
CREATE INDEX pay_third_party_payers_client ON public.pay_third_party_payers(client_id);
GRANT SELECT ON public.pay_third_party_payers TO authenticated;
GRANT ALL ON public.pay_third_party_payers TO service_role;
ALTER TABLE public.pay_third_party_payers ENABLE ROW LEVEL SECURITY;
CREATE POLICY pay_third_party_payers_select ON public.pay_third_party_payers FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id());

-- Legacy list without e-mails, minus what is already linked.
CREATE OR REPLACE FUNCTION public.list_pay_orphan_seed()
RETURNS TABLE(external_id text, payer_name text, amount_cents integer, started_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.external_id, s.payer_name, s.amount_cents, s.started_on
  FROM pay_orphan_seed s
  WHERE s.account_id = get_user_account_id()
    AND user_has_sector_access(auth.uid(), 'vendas')
    AND NOT EXISTS (SELECT 1 FROM pay_sale_links l WHERE l.account_id = s.account_id AND l.source = 'stripe_legacy' AND l.external_id = s.external_id)
  ORDER BY s.started_on DESC NULLS LAST
$$;

-- Which of the given e-mails belong to the legacy list (the only Stripe payers the win lock accepts).
CREATE OR REPLACE FUNCTION public.pay_seed_emails(_emails text[])
RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT lower(s.payer_email) FROM pay_orphan_seed s
  WHERE s.account_id = get_user_account_id() AND lower(s.payer_email) = ANY (SELECT lower(e) FROM unnest(_emails) e)
$$;

CREATE OR REPLACE FUNCTION public.request_pay_link(_deal_id uuid, _source text DEFAULT NULL, _external_id text DEFAULT NULL, _label text DEFAULT NULL, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_me record; v_deal record; v_id uuid; v_mgr record;
BEGIN
  SELECT id, name, account_id INTO v_me FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_me.id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT user_has_sector_access(auth.uid(), 'vendas') THEN RAISE EXCEPTION 'Sem acesso ao comercial'; END IF;
  SELECT id, title, account_id INTO v_deal FROM deals WHERE id = _deal_id AND deleted_at IS NULL;
  IF v_deal.id IS NULL OR v_deal.account_id IS DISTINCT FROM v_me.account_id OR NOT can_view_deal_id(_deal_id) THEN
    RAISE EXCEPTION 'Negócio não encontrado';
  END IF;
  IF _source IS NOT NULL AND _source NOT IN ('rykapay','stripe_legacy') THEN RAISE EXCEPTION 'Origem inválida'; END IF;
  IF EXISTS (SELECT 1 FROM pay_link_requests WHERE deal_id = _deal_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Já existe uma solicitação aguardando o gestor para este negócio';
  END IF;
  INSERT INTO pay_link_requests(account_id, deal_id, requester_id, suggested_source, suggested_external_id, suggested_label, note)
  VALUES (v_me.account_id, _deal_id, v_me.id, CASE WHEN _external_id IS NULL THEN NULL ELSE _source END,
    NULLIF(left(trim(coalesce(_external_id,'')), 200), ''), NULLIF(left(trim(coalesce(_label,'')), 200), ''), NULLIF(left(trim(coalesce(_note,'')), 1000), ''))
  RETURNING id INTO v_id;
  FOR v_mgr IN SELECT u.id FROM users u WHERE u.account_id = v_me.account_id AND COALESCE(u.is_active, true)
      AND u.auth_user_id IS NOT NULL AND u.id <> v_me.id AND can_manage_spiff_payments(u.auth_user_id) LOOP
    INSERT INTO notifications(account_id, user_id, type, title, content, link, source_type, source_id, triggered_by_user_id, sector_id)
    VALUES (v_me.account_id, v_mgr.id, 'pay_link_request', 'Pagamento sem dono para vincular',
      v_me.name || ' pediu para vincular um pagamento ao negócio "' || v_deal.title || '"',
      '/sales-team/pay-links?pedido=' || v_id, 'pay_link_request', v_id, v_me.id, 'vendas');
  END LOOP;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.decide_pay_link(
  _request_id uuid, _approve boolean, _reason text DEFAULT NULL,
  _source text DEFAULT NULL, _external_id text DEFAULT NULL,
  _payer_name text DEFAULT NULL, _payer_document text DEFAULT NULL, _payer_email text DEFAULT NULL,
  _relationship text DEFAULT NULL, _relationship_other text DEFAULT NULL,
  _amount_cents integer DEFAULT NULL, _paid_on date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_me record; v_req record; v_deal record; v_seed record; v_name text; v_email text; v_doc text;
BEGIN
  SELECT id, name, account_id INTO v_me FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_me.id IS NULL OR NOT can_manage_spiff_payments(auth.uid()) THEN RAISE EXCEPTION 'Somente gestores podem decidir'; END IF;
  SELECT * INTO v_req FROM pay_link_requests WHERE id = _request_id AND account_id = v_me.account_id FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Esta solicitação já foi decidida'; END IF;
  SELECT id, title, lead_id, client_id INTO v_deal FROM deals WHERE id = v_req.deal_id;

  IF NOT _approve THEN
    IF NULLIF(trim(coalesce(_reason,'')), '') IS NULL THEN RAISE EXCEPTION 'Informe o motivo da recusa'; END IF;
    UPDATE pay_link_requests SET status = 'rejected', decided_by = v_me.id, decided_at = now(), decision_reason = left(trim(_reason), 1000) WHERE id = _request_id;
  ELSE
    IF _source NOT IN ('rykapay','stripe_legacy') OR NULLIF(trim(coalesce(_external_id,'')), '') IS NULL THEN RAISE EXCEPTION 'Escolha a venda'; END IF;
    IF _relationship NOT IN ('partner','spouse','company_card','other') THEN RAISE EXCEPTION 'Informe a relação de quem pagou'; END IF;
    IF _relationship = 'other' AND NULLIF(trim(coalesce(_relationship_other,'')), '') IS NULL THEN RAISE EXCEPTION 'Descreva a relação de quem pagou'; END IF;
    v_name := NULLIF(trim(coalesce(_payer_name,'')), '');
    v_email := NULLIF(lower(trim(coalesce(_payer_email,''))), '');
    v_doc := NULLIF(regexp_replace(coalesce(_payer_document,''), '\D', '', 'g'), '');
    IF v_doc IS NOT NULL AND length(v_doc) NOT IN (11, 14) THEN RAISE EXCEPTION 'CPF ou CNPJ inválido'; END IF;
    IF _source = 'stripe_legacy' THEN
      SELECT * INTO v_seed FROM pay_orphan_seed WHERE account_id = v_me.account_id AND external_id = _external_id;
      IF v_seed.id IS NULL THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;
      v_name := v_seed.payer_name; v_email := lower(v_seed.payer_email);
      _amount_cents := v_seed.amount_cents; _paid_on := COALESCE(_paid_on, v_seed.started_on);
    END IF;
    IF v_name IS NULL THEN RAISE EXCEPTION 'Informe o nome de quem pagou'; END IF;
    BEGIN
      INSERT INTO pay_sale_links(account_id, deal_id, source, external_id, kind, payer_name, amount_cents, paid_on, request_id, created_by)
      VALUES (v_me.account_id, v_req.deal_id, _source, trim(_external_id), 'manager', left(v_name, 200), _amount_cents, _paid_on, _request_id, v_me.id);
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'Esta venda já está vinculada a um negócio';
    END;
    INSERT INTO pay_third_party_payers(account_id, lead_id, client_id, origin_deal_id, name, document, email, relationship, relationship_other, approved_by)
    VALUES (v_me.account_id, v_deal.lead_id, v_deal.client_id, v_req.deal_id, left(v_name, 200), v_doc, v_email, _relationship,
      CASE WHEN _relationship = 'other' THEN left(trim(_relationship_other), 120) END, v_me.id);
    UPDATE pay_link_requests SET status = 'approved', decided_by = v_me.id, decided_at = now(), decision_reason = NULLIF(left(trim(coalesce(_reason,'')), 1000), '') WHERE id = _request_id;
  END IF;

  IF v_req.requester_id <> v_me.id THEN
    INSERT INTO notifications(account_id, user_id, type, title, content, link, source_type, source_id, triggered_by_user_id, sector_id)
    VALUES (v_me.account_id, v_req.requester_id, 'pay_link_decision',
      CASE WHEN _approve THEN 'Pagamento vinculado' ELSE 'Vínculo de pagamento recusado' END,
      CASE WHEN _approve THEN v_me.name || ' vinculou o pagamento ao negócio "' || v_deal.title || '". Abra o ganho e clique em "Verificar de novo".'
           ELSE v_me.name || ' recusou o vínculo no negócio "' || v_deal.title || '": ' || left(trim(_reason), 300) END,
      '/sales-team/pay-links', 'pay_link_request', _request_id, v_me.id, 'vendas');
  END IF;
END $$;

-- Sales confirmed for a deal at win time never show up as ownerless.
CREATE OR REPLACE FUNCTION public.record_pay_sale_links(_deal_id uuid, _items jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_me record; v_item jsonb;
BEGIN
  SELECT id, account_id INTO v_me FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_me.id IS NULL OR NOT can_view_deal_id(_deal_id)
     OR NOT EXISTS (SELECT 1 FROM deals WHERE id = _deal_id AND account_id = v_me.account_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Negócio não encontrado';
  END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) > 60 THEN RAISE EXCEPTION 'Lista inválida'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    IF v_item->>'source' IN ('rykapay','stripe_legacy') AND NULLIF(trim(coalesce(v_item->>'external_id','')), '') IS NOT NULL THEN
      INSERT INTO pay_sale_links(account_id, deal_id, source, external_id, kind, created_by)
      VALUES (v_me.account_id, _deal_id, v_item->>'source', left(trim(v_item->>'external_id'), 200), 'auto', v_me.id)
      ON CONFLICT (account_id, source, external_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.list_pay_orphan_seed(), public.pay_seed_emails(text[]), public.request_pay_link(uuid,text,text,text,text),
  public.decide_pay_link(uuid,boolean,text,text,text,text,text,text,text,text,integer,date), public.record_pay_sale_links(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pay_orphan_seed(), public.pay_seed_emails(text[]), public.request_pay_link(uuid,text,text,text,text),
  public.decide_pay_link(uuid,boolean,text,text,text,text,text,text,text,text,integer,date), public.record_pay_sale_links(uuid,jsonb) TO authenticated;

-- The payer saved on the lead follows the client created at win time.
CREATE OR REPLACE FUNCTION public.pay_payer_follow_client() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    UPDATE pay_third_party_payers SET client_id = NEW.client_id
    WHERE account_id = NEW.account_id AND client_id IS NULL
      AND (origin_deal_id = NEW.id OR (NEW.lead_id IS NOT NULL AND lead_id = NEW.lead_id));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pay_payer_follow_client AFTER UPDATE OF client_id ON public.deals
  FOR EACH ROW WHEN (NEW.client_id IS DISTINCT FROM OLD.client_id) EXECUTE FUNCTION public.pay_payer_follow_client();
