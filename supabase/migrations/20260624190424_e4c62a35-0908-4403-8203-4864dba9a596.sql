
-- 1. Reunião principal
CREATE TABLE public.leader_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  meeting_date date NOT NULL DEFAULT CURRENT_DATE,
  title text,
  status text NOT NULL DEFAULT 'draft',
  general_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leader_meetings TO authenticated;
GRANT ALL ON public.leader_meetings TO service_role;
ALTER TABLE public.leader_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view leader meetings"
  ON public.leader_meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert leader meetings"
  ON public.leader_meetings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update leader meetings"
  ON public.leader_meetings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete leader meetings"
  ON public.leader_meetings FOR DELETE TO authenticated USING (true);

-- 2. Seções por área
CREATE TABLE public.leader_meeting_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.leader_meetings(id) ON DELETE CASCADE,
  area text NOT NULL,
  numbers text,
  bottlenecks text,
  blockers text,
  next_steps text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, area)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leader_meeting_sections TO authenticated;
GRANT ALL ON public.leader_meeting_sections TO service_role;
ALTER TABLE public.leader_meeting_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access sections"
  ON public.leader_meeting_sections FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Ações de follow-up
CREATE TABLE public.leader_meeting_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.leader_meetings(id) ON DELETE CASCADE,
  area text,
  title text NOT NULL,
  description text,
  owner_user_id uuid,
  due_date date,
  status text NOT NULL DEFAULT 'open',
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leader_meeting_actions TO authenticated;
GRANT ALL ON public.leader_meeting_actions TO service_role;
ALTER TABLE public.leader_meeting_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access actions"
  ON public.leader_meeting_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Triggers updated_at
CREATE TRIGGER trg_leader_meetings_updated BEFORE UPDATE ON public.leader_meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_leader_meeting_sections_updated BEFORE UPDATE ON public.leader_meeting_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_leader_meeting_actions_updated BEFORE UPDATE ON public.leader_meeting_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_leader_meeting_sections_meeting ON public.leader_meeting_sections(meeting_id);
CREATE INDEX idx_leader_meeting_actions_meeting ON public.leader_meeting_actions(meeting_id);
CREATE INDEX idx_leader_meetings_account_date ON public.leader_meetings(account_id, meeting_date DESC);
