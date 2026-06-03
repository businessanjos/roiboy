
-- =========================================================
-- TRAFFIC AGENCIES — schema, RBAC and material requests
-- =========================================================

-- 1) traffic_agencies ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.traffic_agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_traffic_agencies_account ON public.traffic_agencies(account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.traffic_agencies TO authenticated;
GRANT ALL ON public.traffic_agencies TO service_role;
ALTER TABLE public.traffic_agencies ENABLE ROW LEVEL SECURITY;

-- 2) traffic_agency_members ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.traffic_agency_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.traffic_agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_traffic_agency_members_agency ON public.traffic_agency_members(agency_id);
CREATE INDEX IF NOT EXISTS idx_traffic_agency_members_user ON public.traffic_agency_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.traffic_agency_members TO authenticated;
GRANT ALL ON public.traffic_agency_members TO service_role;
ALTER TABLE public.traffic_agency_members ENABLE ROW LEVEL SECURITY;

-- 3) Helper now that tables exist --------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_user_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tam.agency_id
  FROM public.traffic_agency_members tam
  JOIN public.users u ON u.id = tam.user_id
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1
$$;

-- Policies on traffic_agencies
CREATE POLICY "account members read agencies"
  ON public.traffic_agencies FOR SELECT TO authenticated
  USING (account_id = public.get_current_user_account_id());
CREATE POLICY "account members write agencies"
  ON public.traffic_agencies FOR INSERT TO authenticated
  WITH CHECK (account_id = public.get_current_user_account_id() AND public.get_current_user_agency_id() IS NULL);
CREATE POLICY "account members update agencies"
  ON public.traffic_agencies FOR UPDATE TO authenticated
  USING (account_id = public.get_current_user_account_id() AND public.get_current_user_agency_id() IS NULL)
  WITH CHECK (account_id = public.get_current_user_account_id());
CREATE POLICY "account members delete agencies"
  ON public.traffic_agencies FOR DELETE TO authenticated
  USING (account_id = public.get_current_user_account_id() AND public.get_current_user_agency_id() IS NULL);

-- Policies on traffic_agency_members
CREATE POLICY "account read members"
  ON public.traffic_agency_members FOR SELECT TO authenticated
  USING (account_id = public.get_current_user_account_id());
CREATE POLICY "account write members"
  ON public.traffic_agency_members FOR INSERT TO authenticated
  WITH CHECK (account_id = public.get_current_user_account_id() AND public.get_current_user_agency_id() IS NULL);
CREATE POLICY "account update members"
  ON public.traffic_agency_members FOR UPDATE TO authenticated
  USING (account_id = public.get_current_user_account_id() AND public.get_current_user_agency_id() IS NULL)
  WITH CHECK (account_id = public.get_current_user_account_id());
CREATE POLICY "account delete members"
  ON public.traffic_agency_members FOR DELETE TO authenticated
  USING (account_id = public.get_current_user_account_id() AND public.get_current_user_agency_id() IS NULL);

-- 4) Add agency_id + account_id to marketing_ad_sets --------------------------
ALTER TABLE public.marketing_ad_sets
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.traffic_agencies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_id uuid;

UPDATE public.marketing_ad_sets m
SET account_id = u.account_id
FROM public.users u
WHERE m.account_id IS NULL
  AND u.auth_user_id = m.user_id;

CREATE INDEX IF NOT EXISTS idx_marketing_ad_sets_agency ON public.marketing_ad_sets(agency_id);
CREATE INDEX IF NOT EXISTS idx_marketing_ad_sets_account ON public.marketing_ad_sets(account_id);

DROP POLICY IF EXISTS "users view own ad sets" ON public.marketing_ad_sets;
CREATE POLICY "view ad sets account or agency"
  ON public.marketing_ad_sets FOR SELECT TO authenticated
  USING (
    (account_id = public.get_current_user_account_id() AND public.get_current_user_agency_id() IS NULL)
    OR (agency_id IS NOT NULL AND agency_id = public.get_current_user_agency_id())
    OR auth.uid() = user_id
  );
CREATE POLICY "update ad sets internal team"
  ON public.marketing_ad_sets FOR UPDATE TO authenticated
  USING (account_id = public.get_current_user_account_id() AND public.get_current_user_agency_id() IS NULL)
  WITH CHECK (account_id = public.get_current_user_account_id());

-- 5) Add agency_id to deals ---------------------------------------------------
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.traffic_agencies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deals_agency ON public.deals(agency_id);

-- 6) Enums for material requests ---------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.material_request_category AS ENUM (
    'criativo_estatico','video','copy','landing_page','outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.material_request_status AS ENUM (
    'aberto','em_producao','em_revisao','entregue','cancelado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7) marketing_material_requests ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  agency_id uuid NOT NULL REFERENCES public.traffic_agencies(id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL,
  assigned_to_user_id uuid,
  category public.material_request_category NOT NULL,
  title text NOT NULL,
  description text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.material_request_status NOT NULL DEFAULT 'aberto',
  priority text NOT NULL DEFAULT 'normal',
  due_date date,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mmr_account ON public.marketing_material_requests(account_id);
CREATE INDEX IF NOT EXISTS idx_mmr_agency ON public.marketing_material_requests(agency_id);
CREATE INDEX IF NOT EXISTS idx_mmr_status ON public.marketing_material_requests(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_material_requests TO authenticated;
GRANT ALL ON public.marketing_material_requests TO service_role;
ALTER TABLE public.marketing_material_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team or agency read requests"
  ON public.marketing_material_requests FOR SELECT TO authenticated
  USING (
    (account_id = public.get_current_user_account_id() AND public.get_current_user_agency_id() IS NULL)
    OR (agency_id = public.get_current_user_agency_id())
  );
CREATE POLICY "team or agency insert requests"
  ON public.marketing_material_requests FOR INSERT TO authenticated
  WITH CHECK (
    account_id = public.get_current_user_account_id()
    AND (
      public.get_current_user_agency_id() IS NULL
      OR agency_id = public.get_current_user_agency_id()
    )
  );
CREATE POLICY "team or agency update requests"
  ON public.marketing_material_requests FOR UPDATE TO authenticated
  USING (
    (account_id = public.get_current_user_account_id() AND public.get_current_user_agency_id() IS NULL)
    OR (agency_id = public.get_current_user_agency_id())
  )
  WITH CHECK (
    (account_id = public.get_current_user_account_id() AND public.get_current_user_agency_id() IS NULL)
    OR (agency_id = public.get_current_user_agency_id())
  );
CREATE POLICY "team delete requests"
  ON public.marketing_material_requests FOR DELETE TO authenticated
  USING (account_id = public.get_current_user_account_id() AND public.get_current_user_agency_id() IS NULL);

-- 8) marketing_material_request_comments -------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_material_request_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.marketing_material_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mmrc_request ON public.marketing_material_request_comments(request_id);

GRANT SELECT, INSERT, DELETE ON public.marketing_material_request_comments TO authenticated;
GRANT ALL ON public.marketing_material_request_comments TO service_role;
ALTER TABLE public.marketing_material_request_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read comments via request"
  ON public.marketing_material_request_comments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.marketing_material_requests r
    WHERE r.id = request_id
      AND (
        (r.account_id = public.get_current_user_account_id() AND public.get_current_user_agency_id() IS NULL)
        OR (r.agency_id = public.get_current_user_agency_id())
      )
  ));
CREATE POLICY "insert comments via request"
  ON public.marketing_material_request_comments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.marketing_material_requests r
    WHERE r.id = request_id
      AND (
        (r.account_id = public.get_current_user_account_id() AND public.get_current_user_agency_id() IS NULL)
        OR (r.agency_id = public.get_current_user_agency_id())
      )
  ));
CREATE POLICY "delete own comments"
  ON public.marketing_material_request_comments FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = user_id AND u.auth_user_id = auth.uid()
  ));

-- 9) updated_at triggers ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS set_updated_at ON public.traffic_agencies;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.traffic_agencies
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.marketing_material_requests;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.marketing_material_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 10) Seed "Agência de Tráfego" team_role per account -------------------------
INSERT INTO public.team_roles (account_id, name, description, area, cargo, seniority, color, is_system, display_order)
SELECT a.id, 'Agência de Tráfego', 'Parceiro externo com acesso restrito ao portal da agência', 'Marketing', 'Parceiro', 'Pleno', '#6366f1', false, 999
FROM public.accounts a
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_roles tr WHERE tr.account_id = a.id AND tr.name = 'Agência de Tráfego'
);

-- 11) Realtime ----------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_material_request_comments;
