
-- Enum stages
DO $$ BEGIN
  CREATE TYPE public.hr_offboarding_stage AS ENUM ('opened','documentation','rescission','access_cutoff','exit_interview','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.hr_offboarding_type AS ENUM ('sem_justa_causa','pedido_demissao','acordo','justa_causa','termino_contrato','termino_experiencia','rescisao_indireta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.hr_notice_type AS ENUM ('trabalhado','indenizado','dispensado','nao_aplica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Main table
CREATE TABLE IF NOT EXISTS public.hr_offboardings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  collaborator_id uuid NOT NULL REFERENCES public.hr_collaborators(id) ON DELETE CASCADE,
  responsible_user_id uuid,
  termination_type public.hr_offboarding_type NOT NULL DEFAULT 'sem_justa_causa',
  initiated_by text NOT NULL DEFAULT 'company', -- company | employee | mutual
  notice_communicated_at date,
  last_day_worked date,
  termination_date date,
  notice_type public.hr_notice_type NOT NULL DEFAULT 'indenizado',
  notice_days integer DEFAULT 30,
  reason text,
  reason_details text,
  will_replace boolean NOT NULL DEFAULT false,
  replacement_job_id uuid REFERENCES public.hr_jobs(id) ON DELETE SET NULL,
  stage public.hr_offboarding_stage NOT NULL DEFAULT 'opened',
  rescission_calc jsonb NOT NULL DEFAULT '{}'::jsonb,
  exit_interview jsonb NOT NULL DEFAULT '{}'::jsonb,
  exit_nps integer,
  access_cutoff_done boolean NOT NULL DEFAULT false,
  access_cutoff_at timestamptz,
  notes text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_offboardings_account ON public.hr_offboardings(account_id);
CREATE INDEX IF NOT EXISTS idx_hr_offboardings_collab ON public.hr_offboardings(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_hr_offboardings_stage ON public.hr_offboardings(stage);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_offboardings TO authenticated;
GRANT ALL ON public.hr_offboardings TO service_role;
ALTER TABLE public.hr_offboardings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "off view" ON public.hr_offboardings FOR SELECT TO authenticated USING (account_id = public.get_my_account_id());
CREATE POLICY "off insert" ON public.hr_offboardings FOR INSERT TO authenticated WITH CHECK (account_id = public.get_my_account_id());
CREATE POLICY "off update" ON public.hr_offboardings FOR UPDATE TO authenticated USING (account_id = public.get_my_account_id());
CREATE POLICY "off delete" ON public.hr_offboardings FOR DELETE TO authenticated USING (account_id = public.get_my_account_id());

-- Checklist
CREATE TABLE IF NOT EXISTS public.hr_offboarding_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offboarding_id uuid NOT NULL REFERENCES public.hr_offboardings(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  item_key text NOT NULL,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'geral', -- geral | documentos | acessos | financeiro | equipamentos
  sort_order integer NOT NULL DEFAULT 0,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  done_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_off_checklist_off ON public.hr_offboarding_checklist_items(offboarding_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_offboarding_checklist_items TO authenticated;
GRANT ALL ON public.hr_offboarding_checklist_items TO service_role;
ALTER TABLE public.hr_offboarding_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "off chk view" ON public.hr_offboarding_checklist_items FOR SELECT TO authenticated USING (account_id = public.get_my_account_id());
CREATE POLICY "off chk insert" ON public.hr_offboarding_checklist_items FOR INSERT TO authenticated WITH CHECK (account_id = public.get_my_account_id());
CREATE POLICY "off chk update" ON public.hr_offboarding_checklist_items FOR UPDATE TO authenticated USING (account_id = public.get_my_account_id());
CREATE POLICY "off chk delete" ON public.hr_offboarding_checklist_items FOR DELETE TO authenticated USING (account_id = public.get_my_account_id());

-- updated_at triggers
CREATE TRIGGER trg_hr_off_updated BEFORE UPDATE ON public.hr_offboardings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_hr_off_chk_updated BEFORE UPDATE ON public.hr_offboarding_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default checklist on insert
CREATE OR REPLACE FUNCTION public.seed_offboarding_checklist()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.hr_offboarding_checklist_items (offboarding_id, account_id, item_key, label, category, sort_order)
  VALUES
    (NEW.id, NEW.account_id, 'comunicar_colaborador', 'Comunicar formalmente o colaborador', 'geral', 10),
    (NEW.id, NEW.account_id, 'comunicar_equipe', 'Comunicar gestor e equipe', 'geral', 20),
    (NEW.id, NEW.account_id, 'exame_demissional', 'Agendar e realizar exame demissional (ASO)', 'documentos', 30),
    (NEW.id, NEW.account_id, 'aviso_previo', 'Formalizar aviso prévio (carta assinada)', 'documentos', 40),
    (NEW.id, NEW.account_id, 'trct', 'Emitir TRCT / Termo de Rescisão', 'documentos', 50),
    (NEW.id, NEW.account_id, 'esocial_baixa', 'Realizar baixa no eSocial', 'documentos', 60),
    (NEW.id, NEW.account_id, 'guias_fgts_cd', 'Emitir Guias FGTS e Chave de Conectividade', 'financeiro', 70),
    (NEW.id, NEW.account_id, 'pagar_rescisao', 'Pagar rescisão em até 10 dias', 'financeiro', 80),
    (NEW.id, NEW.account_id, 'homologacao', 'Homologação (se aplicável)', 'documentos', 90),
    (NEW.id, NEW.account_id, 'devolver_equipamentos', 'Devolução de equipamentos (notebook, crachá, EPIs)', 'equipamentos', 100),
    (NEW.id, NEW.account_id, 'cortar_acesso_email', 'Cortar acessos: e-mail corporativo / Google Workspace', 'acessos', 110),
    (NEW.id, NEW.account_id, 'cortar_acesso_crm', 'Cortar acessos: CRM Roy', 'acessos', 120),
    (NEW.id, NEW.account_id, 'cortar_acesso_royzapp', 'Cortar acessos: RoyZapp / WhatsApp', 'acessos', 130),
    (NEW.id, NEW.account_id, 'cortar_acesso_outros', 'Cortar demais acessos (Omie, Pluggy, drives, etc.)', 'acessos', 140),
    (NEW.id, NEW.account_id, 'cancelar_beneficios', 'Cancelar benefícios (plano de saúde, VR/VT)', 'financeiro', 150),
    (NEW.id, NEW.account_id, 'entrevista_saida', 'Aplicar entrevista de desligamento', 'geral', 160),
    (NEW.id, NEW.account_id, 'arquivar_documentos', 'Arquivar documentação do colaborador', 'documentos', 170);
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_seed_offboarding_checklist AFTER INSERT ON public.hr_offboardings
FOR EACH ROW EXECUTE FUNCTION public.seed_offboarding_checklist();

-- On completion: deactivate collaborator + try to deactivate linked user
CREATE OR REPLACE FUNCTION public.apply_offboarding_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NEW.stage = 'completed' AND (OLD.stage IS DISTINCT FROM 'completed') THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
    UPDATE public.hr_collaborators
      SET status = 'inactive',
          termination_date = COALESCE(NEW.termination_date, CURRENT_DATE),
          updated_at = now()
      WHERE id = NEW.collaborator_id
      RETURNING user_id INTO v_user_id;

    -- Deactivate platform user if linked
    IF v_user_id IS NOT NULL THEN
      BEGIN
        UPDATE public.users SET is_active = false, updated_at = now() WHERE id = v_user_id;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;

  IF NEW.stage = 'cancelled' AND (OLD.stage IS DISTINCT FROM 'cancelled') THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
  END IF;

  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_apply_offboarding_completion BEFORE UPDATE ON public.hr_offboardings
FOR EACH ROW EXECUTE FUNCTION public.apply_offboarding_completion();
