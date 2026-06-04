-- ============ event_suppliers ============
CREATE TABLE public.event_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'outros',
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  instagram TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  price_range TEXT,
  rating SMALLINT CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_suppliers TO authenticated;
GRANT ALL ON public.event_suppliers TO service_role;

ALTER TABLE public.event_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view event suppliers"
  ON public.event_suppliers FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Account members can insert event suppliers"
  ON public.event_suppliers FOR INSERT TO authenticated
  WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "Account members can update event suppliers"
  ON public.event_suppliers FOR UPDATE TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "Account members can delete event suppliers"
  ON public.event_suppliers FOR DELETE TO authenticated
  USING (account_id = public.get_user_account_id());

CREATE INDEX idx_event_suppliers_account ON public.event_suppliers(account_id);
CREATE INDEX idx_event_suppliers_category ON public.event_suppliers(account_id, category);

CREATE TRIGGER trg_event_suppliers_updated_at
  BEFORE UPDATE ON public.event_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ event_supplier_quotes ============
CREATE TABLE public.event_supplier_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.event_suppliers(id) ON DELETE CASCADE,
  event_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(14,2),
  currency TEXT DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'requested',
  requested_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  attachment_url TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_supplier_quotes TO authenticated;
GRANT ALL ON public.event_supplier_quotes TO service_role;

ALTER TABLE public.event_supplier_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view event supplier quotes"
  ON public.event_supplier_quotes FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Account members can insert event supplier quotes"
  ON public.event_supplier_quotes FOR INSERT TO authenticated
  WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "Account members can update event supplier quotes"
  ON public.event_supplier_quotes FOR UPDATE TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "Account members can delete event supplier quotes"
  ON public.event_supplier_quotes FOR DELETE TO authenticated
  USING (account_id = public.get_user_account_id());

CREATE INDEX idx_event_supplier_quotes_account ON public.event_supplier_quotes(account_id);
CREATE INDEX idx_event_supplier_quotes_supplier ON public.event_supplier_quotes(supplier_id);
CREATE INDEX idx_event_supplier_quotes_event ON public.event_supplier_quotes(event_id) WHERE event_id IS NOT NULL;

CREATE TRIGGER trg_event_supplier_quotes_updated_at
  BEFORE UPDATE ON public.event_supplier_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();