CREATE TABLE IF NOT EXISTS public.tv_realtime_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  topic text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tv_realtime_config TO service_role;
REVOKE ALL ON public.tv_realtime_config FROM anon, authenticated;
ALTER TABLE public.tv_realtime_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.tv_realtime_config (id, topic)
VALUES (1, 'tv-agent-' || encode(extensions.gen_random_bytes(24), 'hex'))
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.tv_commands_doorbell()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t text;
BEGIN
  SELECT topic INTO t FROM public.tv_realtime_config WHERE id = 1;
  IF t IS NOT NULL THEN
    BEGIN
      PERFORM realtime.send(jsonb_build_object('slot', NEW.slot), 'command', t, false);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tv_commands_doorbell() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tv_commands_doorbell ON public.tv_commands;
CREATE TRIGGER tv_commands_doorbell AFTER INSERT ON public.tv_commands
FOR EACH ROW EXECUTE FUNCTION public.tv_commands_doorbell();