CREATE TABLE public.playbook_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  sector_id text,
  name text NOT NULL,
  visibility text NOT NULL DEFAULT 'sector',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.playbook_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES public.playbook_sequences(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  playbook_item_id uuid NOT NULL REFERENCES public.playbook_items(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  delay_seconds integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.playbook_sequence_steps(sequence_id, position);

CREATE TABLE public.zapp_sequence_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES public.zapp_conversations(id) ON DELETE CASCADE,
  sequence_id uuid REFERENCES public.playbook_sequences(id) ON DELETE SET NULL,
  sequence_name text NOT NULL,
  triggered_by uuid,
  triggered_by_name text,
  status text NOT NULL DEFAULT 'running',
  cancel_reason text,
  total_steps integer NOT NULL DEFAULT 0,
  sent_steps integer NOT NULL DEFAULT 0,
  hops integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX ON public.zapp_sequence_runs(conversation_id, status);
CREATE UNIQUE INDEX zapp_sequence_runs_one_active ON public.zapp_sequence_runs(conversation_id) WHERE status = 'running';

CREATE TABLE public.zapp_sequence_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.zapp_sequence_runs(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  position integer NOT NULL,
  name text,
  content_type text NOT NULL,
  text_content text,
  media_url text,
  media_filename text,
  media_caption text,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  claimed_at timestamptz,
  sent_at timestamptz,
  external_message_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.zapp_sequence_run_steps(run_id, position);
CREATE INDEX ON public.zapp_sequence_run_steps(external_message_id) WHERE external_message_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.playbook_sequences, public.playbook_sequence_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.zapp_sequence_runs, public.zapp_sequence_run_steps TO authenticated;
GRANT ALL ON public.playbook_sequences, public.playbook_sequence_steps, public.zapp_sequence_runs, public.zapp_sequence_run_steps TO service_role;

ALTER TABLE public.playbook_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapp_sequence_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapp_sequence_run_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY seq_select ON public.playbook_sequences FOR SELECT TO authenticated
  USING (account_id = get_user_account_id() AND (visibility = 'sector' OR created_by = get_current_user_id()));
CREATE POLICY seq_insert ON public.playbook_sequences FOR INSERT TO authenticated
  WITH CHECK (account_id = get_user_account_id() AND created_by = get_current_user_id());
CREATE POLICY seq_update ON public.playbook_sequences FOR UPDATE TO authenticated
  USING (account_id = get_user_account_id() AND (visibility = 'sector' OR created_by = get_current_user_id()))
  WITH CHECK (account_id = get_user_account_id());
CREATE POLICY seq_delete ON public.playbook_sequences FOR DELETE TO authenticated
  USING (account_id = get_user_account_id() AND (visibility = 'sector' OR created_by = get_current_user_id()));

CREATE POLICY seq_steps_all ON public.playbook_sequence_steps FOR ALL TO authenticated
  USING (account_id = get_user_account_id() AND EXISTS (SELECT 1 FROM public.playbook_sequences s WHERE s.id = sequence_id AND (s.visibility = 'sector' OR s.created_by = get_current_user_id())))
  WITH CHECK (account_id = get_user_account_id() AND EXISTS (SELECT 1 FROM public.playbook_sequences s WHERE s.id = sequence_id AND s.account_id = get_user_account_id() AND (s.visibility = 'sector' OR s.created_by = get_current_user_id())));

CREATE POLICY runs_select ON public.zapp_sequence_runs FOR SELECT TO authenticated
  USING (account_id = get_user_account_id() AND EXISTS (SELECT 1 FROM public.zapp_conversations c WHERE c.id = conversation_id AND user_can_access_zapp_sector(c.sector_id)));
CREATE POLICY runs_insert ON public.zapp_sequence_runs FOR INSERT TO authenticated
  WITH CHECK (account_id = get_user_account_id() AND triggered_by = get_current_user_id() AND status = 'running'
    AND EXISTS (SELECT 1 FROM public.zapp_conversations c WHERE c.id = conversation_id AND c.account_id = get_user_account_id() AND user_can_access_zapp_sector(c.sector_id)));
CREATE POLICY runs_update ON public.zapp_sequence_runs FOR UPDATE TO authenticated
  USING (account_id = get_user_account_id() AND EXISTS (SELECT 1 FROM public.zapp_conversations c WHERE c.id = conversation_id AND user_can_access_zapp_sector(c.sector_id)))
  WITH CHECK (account_id = get_user_account_id() AND status IN ('running','cancelled'));

CREATE POLICY run_steps_select ON public.zapp_sequence_run_steps FOR SELECT TO authenticated
  USING (account_id = get_user_account_id() AND EXISTS (SELECT 1 FROM public.zapp_sequence_runs r WHERE r.id = run_id));
CREATE POLICY run_steps_insert ON public.zapp_sequence_run_steps FOR INSERT TO authenticated
  WITH CHECK (account_id = get_user_account_id() AND status = 'pending' AND EXISTS (SELECT 1 FROM public.zapp_sequence_runs r WHERE r.id = run_id AND r.triggered_by = get_current_user_id() AND r.status = 'running'));

-- Claim atômico (somente servidor)
CREATE OR REPLACE FUNCTION public.claim_zapp_sequence_step(p_run_id uuid)
RETURNS SETOF public.zapp_sequence_run_steps LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.zapp_sequence_run_steps s SET status = 'sending', claimed_at = now()
  WHERE s.id = (
    SELECT s2.id FROM public.zapp_sequence_run_steps s2
    JOIN public.zapp_sequence_runs r ON r.id = s2.run_id AND r.status = 'running'
    WHERE s2.run_id = p_run_id AND s2.status = 'pending' AND s2.scheduled_at <= now()
    ORDER BY s2.position LIMIT 1 FOR UPDATE OF s2 SKIP LOCKED)
  RETURNING s.*;
$$;
REVOKE ALL ON FUNCTION public.claim_zapp_sequence_step(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_zapp_sequence_step(uuid) TO service_role;

-- Cancelar ao cancelar a run
CREATE OR REPLACE FUNCTION public.zapp_sequence_run_cancel_steps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE public.zapp_sequence_run_steps SET status = 'cancelled' WHERE run_id = NEW.id AND status = 'pending';
    NEW.finished_at := coalesce(NEW.finished_at, now());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_zapp_sequence_run_cancel BEFORE UPDATE OF status ON public.zapp_sequence_runs
  FOR EACH ROW EXECUTE FUNCTION public.zapp_sequence_run_cancel_steps();

-- Mensagem manual da equipe na conversa interrompe a sequência
CREATE OR REPLACE FUNCTION public.zapp_interrupt_sequence_on_manual()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.direction = 'outbound' AND NEW.sender_user_id IS NOT NULL
     AND coalesce(NEW.synced_from_history, false) = false
     AND NOT EXISTS (SELECT 1 FROM public.zapp_sequence_run_steps s WHERE s.external_message_id = NEW.external_message_id AND NEW.external_message_id IS NOT NULL)
  THEN
    UPDATE public.zapp_sequence_runs SET status = 'cancelled', cancel_reason = 'mensagem manual enviada na conversa'
    WHERE conversation_id = NEW.zapp_conversation_id AND status = 'running';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_zapp_interrupt_sequence AFTER INSERT ON public.zapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.zapp_interrupt_sequence_on_manual();

ALTER PUBLICATION supabase_realtime ADD TABLE public.zapp_sequence_runs;