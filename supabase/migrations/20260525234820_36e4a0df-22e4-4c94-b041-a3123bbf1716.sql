
CREATE TABLE public.rebranding_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'social',
  icon text,
  url text,
  status text NOT NULL DEFAULT 'not_started',
  owner text,
  notes text,
  progress int NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rebranding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  channel_id uuid REFERENCES public.rebranding_channels(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'medium',
  assignee text,
  due_date date,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rebranding_channels_account ON public.rebranding_channels(account_id);
CREATE INDEX idx_rebranding_tasks_account ON public.rebranding_tasks(account_id);
CREATE INDEX idx_rebranding_tasks_channel ON public.rebranding_tasks(channel_id);

ALTER TABLE public.rebranding_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rebranding_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rebranding_channels_account_all" ON public.rebranding_channels
  FOR ALL TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "rebranding_tasks_account_all" ON public.rebranding_tasks
  FOR ALL TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_rebranding_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_rebranding_channels_updated
  BEFORE UPDATE ON public.rebranding_channels
  FOR EACH ROW EXECUTE FUNCTION public.touch_rebranding_updated_at();

CREATE TRIGGER trg_rebranding_tasks_updated
  BEFORE UPDATE ON public.rebranding_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_rebranding_updated_at();

-- Seed canais padrão para cada account existente
INSERT INTO public.rebranding_channels (account_id, name, category, icon, url, sort_order)
SELECT a.id, ch.name, ch.category, ch.icon, ch.url, ch.sort_order
FROM public.accounts a
CROSS JOIN (VALUES
  ('Site Institucional', 'web', 'Globe', NULL, 1),
  ('Instagram Eternum', 'social', 'Instagram', NULL, 2),
  ('LinkedIn Eternum', 'social', 'Linkedin', NULL, 3),
  ('LinkedIn Everton Pieri', 'social', 'Linkedin', NULL, 4),
  ('LinkedIn Bruna Pieri', 'social', 'Linkedin', NULL, 5),
  ('Threads Everton', 'social', 'AtSign', NULL, 6),
  ('Threads Bruna', 'social', 'AtSign', NULL, 7),
  ('Spotify (Podcast)', 'social', 'Music', NULL, 8),
  ('YouTube', 'social', 'Youtube', NULL, 9),
  ('TikTok', 'social', 'Music2', NULL, 10),
  ('Identidade Visual dos Produtos', 'identity', 'Palette', NULL, 11),
  ('Logo & Manual de Marca', 'identity', 'BookOpen', NULL, 12),
  ('Templates de Apresentação', 'identity', 'Presentation', NULL, 13),
  ('Templates de Contrato', 'identity', 'FileText', NULL, 14),
  ('Assinatura de E-mail', 'identity', 'Mail', NULL, 15),
  ('Material de Vendas (Pitch/Deck)', 'identity', 'Briefcase', NULL, 16),
  ('Anúncios pagos (Meta/Google)', 'web', 'Megaphone', NULL, 17),
  ('Comunicados internos & equipe', 'internal', 'Users', NULL, 18)
) AS ch(name, category, icon, url, sort_order);
