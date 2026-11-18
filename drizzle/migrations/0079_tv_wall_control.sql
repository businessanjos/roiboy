CREATE OR REPLACE FUNCTION public.tv_can_manage(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = _uid
    AND (u.role IN ('admin','super_admin','head','gestor','leader') OR COALESCE(u.is_also_admin,false)));
$$;

CREATE TABLE public.tv_screens (
  slot int PRIMARY KEY CHECK (slot BETWEEN 1 AND 10),
  name text NOT NULL,
  location text,
  enabled boolean NOT NULL DEFAULT true,
  url text,
  refresh_min int NOT NULL DEFAULT 30,
  keepalive boolean NOT NULL DEFAULT true,
  schedule_mode text NOT NULL DEFAULT 'global' CHECK (schedule_mode IN ('global','custom','always_on','manual')),
  custom_days int[], custom_on_time text, custom_off_time text,
  volume int CHECK (volume BETWEEN 0 AND 100),
  muted boolean NOT NULL DEFAULT true,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tv_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  days int[] NOT NULL DEFAULT '{1,2,3,4,5}',
  on_time text NOT NULL DEFAULT '07:50',
  off_time text NOT NULL DEFAULT '19:30',
  keep_on_until timestamptz,
  keep_off_until timestamptz,
  holidays date[] NOT NULL DEFAULT '{}',
  agent_interval_sec int NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tv_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot int,
  command text NOT NULL CHECK (command IN ('on','off','reload','open_url','screenshot','wake','screen_off','screen_on','volume','mute','unmute','toast','type_text','key','pair')),
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','taken','done','error')),
  result text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  taken_at timestamptz,
  done_at timestamptz
);
CREATE INDEX tv_commands_status_idx ON public.tv_commands(status, created_at);
CREATE TABLE public.tv_status (
  slot int PRIMARY KEY,
  online boolean, power_state text, foreground_app text, paired boolean,
  ip text, last_error text, screenshot_url text, screenshot_at timestamptz,
  last_seen timestamptz
);
CREATE TABLE public.tv_events (
  id bigserial PRIMARY KEY, slot int, kind text NOT NULL, message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tv_events_created_idx ON public.tv_events(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tv_screens, public.tv_settings, public.tv_commands, public.tv_status, public.tv_events TO authenticated;
GRANT ALL ON public.tv_screens, public.tv_settings, public.tv_commands, public.tv_status, public.tv_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.tv_events_id_seq TO authenticated, service_role;

ALTER TABLE public.tv_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tv_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tv_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tv_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tv_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tv managers" ON public.tv_screens FOR ALL TO authenticated USING (public.tv_can_manage(auth.uid())) WITH CHECK (public.tv_can_manage(auth.uid()));
CREATE POLICY "tv managers" ON public.tv_settings FOR ALL TO authenticated USING (public.tv_can_manage(auth.uid())) WITH CHECK (public.tv_can_manage(auth.uid()));
CREATE POLICY "tv managers" ON public.tv_commands FOR ALL TO authenticated USING (public.tv_can_manage(auth.uid())) WITH CHECK (public.tv_can_manage(auth.uid()));
CREATE POLICY "tv managers" ON public.tv_status FOR SELECT TO authenticated USING (public.tv_can_manage(auth.uid()));
CREATE POLICY "tv managers" ON public.tv_events FOR SELECT TO authenticated USING (public.tv_can_manage(auth.uid()));

CREATE OR REPLACE FUNCTION public.tv_commands_mask_text()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.command = 'type_text' AND NEW.status IN ('done','error') AND NEW.payload ? 'text' THEN
    NEW.payload := jsonb_set(NEW.payload, '{text}', '"***"');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tv_commands_mask_text BEFORE INSERT OR UPDATE ON public.tv_commands
FOR EACH ROW EXECUTE FUNCTION public.tv_commands_mask_text();

CREATE OR REPLACE FUNCTION public.tv_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER tv_screens_touch BEFORE UPDATE ON public.tv_screens FOR EACH ROW EXECUTE FUNCTION public.tv_touch_updated_at();
CREATE TRIGGER tv_settings_touch BEFORE UPDATE ON public.tv_settings FOR EACH ROW EXECUTE FUNCTION public.tv_touch_updated_at();

INSERT INTO public.tv_settings (id) VALUES (1);
INSERT INTO public.tv_screens (slot, name, url) VALUES
 (1,'TV-1','https://iamroy.app/insights/05fe3fc0-139f-4de2-b46c-da526bcd022a?periodo=este_mes&setor=vendas&foco=1&tv=0&zoom=100'),
 (2,'TV-2',NULL),(3,'TV-3',NULL),(4,'TV-4',NULL),
 (5,'TV-5','https://iamroy.app/insights/29104b57-a5bf-41aa-b28a-2bd42a525206?periodo=este_mes&setor=vendas&foco=1&tv=0&zoom=70'),
 (6,'TV-6',NULL),(7,'TV-7',NULL),(8,'TV-8',NULL),(9,'TV-9',NULL),(10,'Box MKT',NULL);

CREATE POLICY "tv managers read shots" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tv-shots' AND public.tv_can_manage(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.tv_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tv_commands;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tv_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tv_screens;