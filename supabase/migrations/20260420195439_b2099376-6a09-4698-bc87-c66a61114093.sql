
-- Tabela de Persona de Marketing
CREATE TABLE public.marketing_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Identificação
  name text NOT NULL DEFAULT 'Persona Principal',
  avatar_emoji text DEFAULT '👤',
  is_default boolean NOT NULL DEFAULT true,
  
  -- Identidade demográfica
  profession text,
  education text,
  age_range text,
  gender text,
  location text,
  
  -- Negócio
  business_type text,
  business_size text,
  revenue_range text,
  years_in_business text,
  
  -- Psicográfico
  pains text[] NOT NULL DEFAULT '{}',
  desires text[] NOT NULL DEFAULT '{}',
  objections text[] NOT NULL DEFAULT '{}',
  emotional_triggers text[] NOT NULL DEFAULT '{}',
  
  -- Linguagem
  vocabulary text[] NOT NULL DEFAULT '{}',
  channels text[] NOT NULL DEFAULT '{}',
  references_consumed text[] NOT NULL DEFAULT '{}',
  
  -- Contexto livre
  daily_routine text,
  biggest_dream text,
  biggest_fear text,
  notes text,
  
  -- Meta IA
  ai_summary text,
  learned_from_clients_at timestamptz,
  clients_analyzed_count integer DEFAULT 0,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_personas_account ON public.marketing_personas(account_id);
CREATE INDEX idx_marketing_personas_default ON public.marketing_personas(account_id, is_default) WHERE is_default = true;

-- RLS
ALTER TABLE public.marketing_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personas_select_own_account"
  ON public.marketing_personas FOR SELECT
  USING (account_id = public.get_my_account_id());

CREATE POLICY "personas_insert_own_account"
  ON public.marketing_personas FOR INSERT
  WITH CHECK (account_id = public.get_my_account_id());

CREATE POLICY "personas_update_own_account"
  ON public.marketing_personas FOR UPDATE
  USING (account_id = public.get_my_account_id());

CREATE POLICY "personas_delete_own_account"
  ON public.marketing_personas FOR DELETE
  USING (account_id = public.get_my_account_id());

-- Trigger updated_at
CREATE TRIGGER trg_marketing_personas_updated_at
  BEFORE UPDATE ON public.marketing_personas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Apenas uma persona default por account (garantia de unicidade)
CREATE UNIQUE INDEX idx_marketing_personas_one_default
  ON public.marketing_personas(account_id)
  WHERE is_default = true;
