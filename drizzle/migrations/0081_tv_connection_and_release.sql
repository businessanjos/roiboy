ALTER TABLE public.tv_status
  ADD COLUMN IF NOT EXISTS latency_ms integer,
  ADD COLUMN IF NOT EXISTS packet_loss_pct integer,
  ADD COLUMN IF NOT EXISTS drops_today integer,
  ADD COLUMN IF NOT EXISTS connection text,
  ADD COLUMN IF NOT EXISTS released boolean;

ALTER TABLE public.tv_screens ADD COLUMN IF NOT EXISTS released_until timestamptz;

CREATE TABLE IF NOT EXISTS public.tv_conn_history (
  id bigserial PRIMARY KEY,
  slot integer NOT NULL,
  latency_ms integer,
  packet_loss_pct integer,
  connection text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tv_conn_history_slot_created_idx ON public.tv_conn_history (slot, created_at DESC);
GRANT SELECT ON public.tv_conn_history TO authenticated;
GRANT ALL ON public.tv_conn_history TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.tv_conn_history_id_seq TO service_role;
ALTER TABLE public.tv_conn_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tv managers" ON public.tv_conn_history FOR SELECT TO authenticated USING (public.tv_can_manage(auth.uid()));

CREATE OR REPLACE FUNCTION public.tv_release(_slots integer[], _until timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text; _s integer;
BEGIN
  IF NOT public.tv_can_manage(auth.uid()) THEN RAISE EXCEPTION 'sem permissão'; END IF;
  SELECT name INTO _name FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
  _name := coalesce(nullif(split_part(trim(_name), ' ', 1), ''), 'alguém');
  FOREACH _s IN ARRAY _slots LOOP
    UPDATE public.tv_screens SET released_until = _until WHERE slot = _s;
    INSERT INTO public.tv_events (slot, kind, message) VALUES (_s,
      CASE WHEN _until IS NULL THEN 'returned' ELSE 'released' END,
      CASE WHEN _until IS NULL THEN 'Devolvida para automação por ' || _name
           ELSE 'Liberada por ' || _name || ' até ' || to_char(_until AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') END);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.tv_release(integer[], timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tv_release(integer[], timestamptz) TO authenticated;