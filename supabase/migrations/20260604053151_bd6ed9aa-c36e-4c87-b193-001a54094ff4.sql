
CREATE TABLE IF NOT EXISTS public.event_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  objective text,
  target_audience text,
  key_messages text,
  success_metrics text,
  risks text,
  logistics text,
  dress_code text,
  speakers jsonb NOT NULL DEFAULT '[]'::jsonb,
  sponsors jsonb NOT NULL DEFAULT '[]'::jsonb,
  responsible_user_id uuid,
  additional_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_briefings TO authenticated;
GRANT ALL ON public.event_briefings TO service_role;
ALTER TABLE public.event_briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eb_select" ON public.event_briefings FOR SELECT TO authenticated USING (account_id = get_user_account_id());
CREATE POLICY "eb_insert" ON public.event_briefings FOR INSERT TO authenticated WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "eb_update" ON public.event_briefings FOR UPDATE TO authenticated USING (account_id = get_user_account_id());
CREATE POLICY "eb_delete" ON public.event_briefings FOR DELETE TO authenticated USING (account_id = get_user_account_id());
CREATE TRIGGER trg_event_briefings_updated BEFORE UPDATE ON public.event_briefings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.event_inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'outro',
  description text,
  quantity_total integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'available',
  location text,
  photo_url text,
  acquisition_date date,
  acquisition_cost numeric(12,2),
  notes text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_inventory_items TO authenticated;
GRANT ALL ON public.event_inventory_items TO service_role;
ALTER TABLE public.event_inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eii_select" ON public.event_inventory_items FOR SELECT TO authenticated USING (account_id = get_user_account_id());
CREATE POLICY "eii_insert" ON public.event_inventory_items FOR INSERT TO authenticated WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "eii_update" ON public.event_inventory_items FOR UPDATE TO authenticated USING (account_id = get_user_account_id());
CREATE POLICY "eii_delete" ON public.event_inventory_items FOR DELETE TO authenticated USING (account_id = get_user_account_id());
CREATE TRIGGER trg_event_inventory_items_updated BEFORE UPDATE ON public.event_inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.event_inventory_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.event_inventory_items(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  checked_out_at timestamptz,
  returned_at timestamptz,
  condition_on_return text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_inventory_usage TO authenticated;
GRANT ALL ON public.event_inventory_usage TO service_role;
ALTER TABLE public.event_inventory_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eiu_select" ON public.event_inventory_usage FOR SELECT TO authenticated USING (account_id = get_user_account_id());
CREATE POLICY "eiu_insert" ON public.event_inventory_usage FOR INSERT TO authenticated WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "eiu_update" ON public.event_inventory_usage FOR UPDATE TO authenticated USING (account_id = get_user_account_id());
CREATE POLICY "eiu_delete" ON public.event_inventory_usage FOR DELETE TO authenticated USING (account_id = get_user_account_id());
CREATE TRIGGER trg_event_inventory_usage_updated BEFORE UPDATE ON public.event_inventory_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.event_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  event_type text,
  modality text,
  cover_color text,
  is_default boolean NOT NULL DEFAULT false,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_playbooks TO authenticated;
GRANT ALL ON public.event_playbooks TO service_role;
ALTER TABLE public.event_playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ep_select" ON public.event_playbooks FOR SELECT TO authenticated USING (account_id = get_user_account_id());
CREATE POLICY "ep_insert" ON public.event_playbooks FOR INSERT TO authenticated WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "ep_update" ON public.event_playbooks FOR UPDATE TO authenticated USING (account_id = get_user_account_id());
CREATE POLICY "ep_delete" ON public.event_playbooks FOR DELETE TO authenticated USING (account_id = get_user_account_id());
CREATE TRIGGER trg_event_playbooks_updated BEFORE UPDATE ON public.event_playbooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.event_playbook_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  playbook_id uuid NOT NULL REFERENCES public.event_playbooks(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text,
  days_offset integer NOT NULL DEFAULT 0,
  responsible_role text,
  position integer NOT NULL DEFAULT 0,
  is_critical boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_playbook_items TO authenticated;
GRANT ALL ON public.event_playbook_items TO service_role;
ALTER TABLE public.event_playbook_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "epi_select" ON public.event_playbook_items FOR SELECT TO authenticated USING (account_id = get_user_account_id());
CREATE POLICY "epi_insert" ON public.event_playbook_items FOR INSERT TO authenticated WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "epi_update" ON public.event_playbook_items FOR UPDATE TO authenticated USING (account_id = get_user_account_id());
CREATE POLICY "epi_delete" ON public.event_playbook_items FOR DELETE TO authenticated USING (account_id = get_user_account_id());
CREATE TRIGGER trg_event_playbook_items_updated BEFORE UPDATE ON public.event_playbook_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_event_briefings_event ON public.event_briefings(event_id);
CREATE INDEX IF NOT EXISTS idx_event_inventory_items_account ON public.event_inventory_items(account_id);
CREATE INDEX IF NOT EXISTS idx_event_inventory_usage_event ON public.event_inventory_usage(event_id);
CREATE INDEX IF NOT EXISTS idx_event_inventory_usage_item ON public.event_inventory_usage(item_id);
CREATE INDEX IF NOT EXISTS idx_event_playbooks_account ON public.event_playbooks(account_id);
CREATE INDEX IF NOT EXISTS idx_event_playbook_items_playbook ON public.event_playbook_items(playbook_id);
