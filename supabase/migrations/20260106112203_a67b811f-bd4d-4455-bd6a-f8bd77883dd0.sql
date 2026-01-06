
-- =====================================================
-- FASE 1: Estrutura de Chamadas WhatsApp com Rastreamento por Vendedor
-- =====================================================

-- 1. Tabela principal de chamadas
CREATE TABLE public.zapp_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  sector_id text NOT NULL,
  
  -- Vínculos para timeline
  zapp_conversation_id uuid REFERENCES public.zapp_conversations(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  
  -- Vendedor (dupla referência para queries)
  agent_id uuid REFERENCES public.zapp_agents(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  agent_name text,
  
  -- Detalhes da chamada
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status text NOT NULL DEFAULT 'initiating',
  provider text NOT NULL DEFAULT 'twilio',
  external_call_id text,
  phone_e164 text NOT NULL,
  contact_name text,
  
  -- Timestamps
  started_at timestamptz DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer DEFAULT 0,
  
  -- Gravação e Transcrição
  recording_url text,
  recording_duration_seconds integer,
  transcription text,
  transcription_summary text,
  
  -- Anotações
  notes text,
  outcome text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes para performance
CREATE INDEX idx_zapp_calls_account ON public.zapp_calls(account_id);
CREATE INDEX idx_zapp_calls_user ON public.zapp_calls(user_id);
CREATE INDEX idx_zapp_calls_conversation ON public.zapp_calls(zapp_conversation_id);
CREATE INDEX idx_zapp_calls_client ON public.zapp_calls(client_id);
CREATE INDEX idx_zapp_calls_lead ON public.zapp_calls(lead_id);
CREATE INDEX idx_zapp_calls_deal ON public.zapp_calls(deal_id);
CREATE INDEX idx_zapp_calls_sector ON public.zapp_calls(account_id, sector_id);
CREATE INDEX idx_zapp_calls_status ON public.zapp_calls(status);
CREATE INDEX idx_zapp_calls_created ON public.zapp_calls(created_at DESC);

-- RLS
ALTER TABLE public.zapp_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view calls from their account"
ON public.zapp_calls FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can create calls in their account"
ON public.zapp_calls FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update calls in their account"
ON public.zapp_calls FOR UPDATE
USING (account_id = get_user_account_id());

-- 2. Tabela de configurações de chamada por setor
CREATE TABLE public.zapp_call_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  sector_id text NOT NULL,
  provider text NOT NULL DEFAULT 'twilio',
  is_enabled boolean DEFAULT true,
  record_calls boolean DEFAULT true,
  transcribe_calls boolean DEFAULT true,
  auto_log_timeline boolean DEFAULT true,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(account_id, sector_id)
);

ALTER TABLE public.zapp_call_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view call settings from their account"
ON public.zapp_call_settings FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can manage call settings in their account"
ON public.zapp_call_settings FOR ALL
USING (account_id = get_user_account_id());

-- 3. Adicionar deal_id em zapp_conversations
ALTER TABLE public.zapp_conversations 
ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_zapp_conversations_deal ON public.zapp_conversations(deal_id);

-- 4. Função auxiliar para formatar duração
CREATE OR REPLACE FUNCTION public.format_call_duration(seconds integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF seconds IS NULL OR seconds = 0 THEN
    RETURN '0 seg';
  ELSIF seconds < 60 THEN
    RETURN seconds || ' seg';
  ELSIF seconds < 3600 THEN
    RETURN FLOOR(seconds / 60) || ' min ' || MOD(seconds, 60) || ' seg';
  ELSE
    RETURN FLOOR(seconds / 3600) || 'h ' || FLOOR(MOD(seconds, 3600) / 60) || ' min';
  END IF;
END;
$$;

-- 5. Função de sincronização com timelines
CREATE OR REPLACE FUNCTION public.sync_call_to_timelines()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_duration_text text;
  v_title text;
  v_description text;
BEGIN
  -- Só sincroniza quando chamada for completada
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'completed') THEN
    
    -- Formatar duração
    v_duration_text := format_call_duration(NEW.duration_seconds);
    
    -- Título baseado na direção
    v_title := CASE WHEN NEW.direction = 'outbound' 
      THEN 'Ligação realizada' 
      ELSE 'Ligação recebida' 
    END;
    
    -- Descrição padrão
    v_description := CONCAT(
      'Duração: ', v_duration_text,
      CASE WHEN NEW.outcome IS NOT NULL 
        THEN ' | Resultado: ' || NEW.outcome 
        ELSE '' 
      END
    );
    
    -- 1. Sincronizar com lead_timeline
    IF NEW.lead_id IS NOT NULL THEN
      INSERT INTO public.lead_timeline (
        account_id, lead_id, event_type, title, description, user_id, metadata, created_at
      ) VALUES (
        NEW.account_id,
        NEW.lead_id,
        'call',
        v_title,
        v_description,
        NEW.user_id,
        jsonb_build_object(
          'call_id', NEW.id,
          'duration_seconds', NEW.duration_seconds,
          'recording_url', NEW.recording_url,
          'transcription_summary', NEW.transcription_summary,
          'phone', NEW.phone_e164,
          'direction', NEW.direction,
          'outcome', NEW.outcome
        ),
        COALESCE(NEW.ended_at, now())
      );
    END IF;
    
    -- 2. Sincronizar com client_followups
    IF NEW.client_id IS NOT NULL THEN
      INSERT INTO public.client_followups (
        account_id, client_id, user_id, type, title, content, created_at
      ) VALUES (
        NEW.account_id,
        NEW.client_id,
        NEW.user_id,
        'call',
        v_title,
        CONCAT(
          'Duração: ', v_duration_text, E'\n',
          'Resultado: ', COALESCE(NEW.outcome, '-'), E'\n',
          CASE WHEN NEW.notes IS NOT NULL AND NEW.notes != '' 
            THEN E'\nNotas: ' || NEW.notes 
            ELSE '' 
          END
        ),
        COALESCE(NEW.ended_at, now())
      );
    END IF;
    
    -- 3. Sincronizar com deal_activities
    IF NEW.deal_id IS NOT NULL THEN
      INSERT INTO public.deal_activities (
        account_id, deal_id, type, title, content, user_id, completed_at, created_at
      ) VALUES (
        NEW.account_id,
        NEW.deal_id,
        'call',
        v_title,
        CONCAT(
          'Contato: ', COALESCE(NEW.contact_name, NEW.phone_e164), E'\n',
          'Duração: ', v_duration_text, E'\n',
          'Resultado: ', COALESCE(NEW.outcome, '-'),
          CASE WHEN NEW.notes IS NOT NULL AND NEW.notes != '' 
            THEN E'\n\n' || NEW.notes 
            ELSE '' 
          END
        ),
        NEW.user_id,
        NEW.ended_at,
        COALESCE(NEW.ended_at, now())
      );
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- 6. Trigger de sincronização
CREATE TRIGGER trigger_sync_call_to_timelines
AFTER INSERT OR UPDATE ON public.zapp_calls
FOR EACH ROW
EXECUTE FUNCTION public.sync_call_to_timelines();

-- 7. Trigger para atualizar updated_at
CREATE TRIGGER update_zapp_calls_updated_at
BEFORE UPDATE ON public.zapp_calls
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_zapp_call_settings_updated_at
BEFORE UPDATE ON public.zapp_call_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Habilitar realtime para zapp_calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.zapp_calls;
