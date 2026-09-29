CREATE TABLE public.user_deal_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  can_view_open boolean NOT NULL DEFAULT false,
  can_view_won boolean NOT NULL DEFAULT false,
  can_view_lost boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_deal_visibility TO authenticated;
GRANT ALL ON public.user_deal_visibility TO service_role;
ALTER TABLE public.user_deal_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own or manager reads account" ON public.user_deal_visibility FOR SELECT TO authenticated
USING (account_id = get_user_account_id() AND (user_id = get_current_user_id() OR can_manage_spiff_payments(auth.uid())));
CREATE POLICY "Managers insert" ON public.user_deal_visibility FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id() AND can_manage_spiff_payments(auth.uid()));
CREATE POLICY "Managers update" ON public.user_deal_visibility FOR UPDATE TO authenticated
USING (account_id = get_user_account_id() AND can_manage_spiff_payments(auth.uid()));
CREATE POLICY "Managers delete" ON public.user_deal_visibility FOR DELETE TO authenticated
USING (account_id = get_user_account_id() AND can_manage_spiff_payments(auth.uid()));

CREATE TRIGGER trg_udv_updated BEFORE UPDATE ON public.user_deal_visibility
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.can_view_deal(
  _status text, _responsible uuid, _sdr uuid, _renewal uuid, _created_by uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := get_current_user_id();
  _v record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF can_manage_spiff_payments(auth.uid()) THEN RETURN true; END IF;
  IF _uid IS NOT NULL AND _uid IN (_responsible, _sdr, _renewal, _created_by) THEN RETURN true; END IF;
  SELECT can_view_open, can_view_won, can_view_lost INTO _v
    FROM user_deal_visibility WHERE user_id = _uid LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  IF _status = 'won' THEN RETURN _v.can_view_won; END IF;
  IF _status = 'lost' THEN RETURN _v.can_view_lost; END IF;
  RETURN _v.can_view_open;
END $$;

CREATE OR REPLACE FUNCTION public.can_view_deal_id(_deal_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT can_view_deal(d.status::text, d.responsible_user_id, d.sdr_user_id, d.renewal_responsible_user_id, d.created_by)
    FROM deals d WHERE d.id = _deal_id), true)
$$;

CREATE POLICY "deal_visibility_select" ON public.deals AS RESTRICTIVE FOR SELECT TO authenticated
USING (can_view_deal(status::text, responsible_user_id, sdr_user_id, renewal_responsible_user_id, created_by));
CREATE POLICY "deal_visibility_update" ON public.deals AS RESTRICTIVE FOR UPDATE TO authenticated
USING (can_view_deal(status::text, responsible_user_id, sdr_user_id, renewal_responsible_user_id, created_by));
CREATE POLICY "deal_visibility_delete" ON public.deals AS RESTRICTIVE FOR DELETE TO authenticated
USING (can_view_deal(status::text, responsible_user_id, sdr_user_id, renewal_responsible_user_id, created_by));

CREATE POLICY "deal_visibility_select" ON public.deal_activities AS RESTRICTIVE FOR SELECT TO authenticated
USING (deal_id IS NULL OR can_view_deal_id(deal_id));
CREATE POLICY "deal_visibility_select" ON public.deal_field_values AS RESTRICTIVE FOR SELECT TO authenticated
USING (deal_id IS NULL OR can_view_deal_id(deal_id));