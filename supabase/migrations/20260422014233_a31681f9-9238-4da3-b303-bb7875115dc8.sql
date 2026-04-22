-- Tabela para A/B test de sugestões de Persona
CREATE TABLE public.marketing_persona_ab_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID,
  field TEXT NOT NULL,
  field_format TEXT NOT NULL CHECK (field_format IN ('text','array')),

  -- Variante A: COM bloco DESTAQUES
  variant_a_suggestion JSONB,
  variant_a_has_highlights BOOLEAN NOT NULL DEFAULT false,

  -- Variante B: SEM bloco DESTAQUES (controle)
  variant_b_suggestion JSONB,

  -- Contexto usado
  instagram_username TEXT,
  clients_analyzed INTEGER DEFAULT 0,
  highlights_snapshot JSONB,

  -- Feedback
  chosen_variant TEXT CHECK (chosen_variant IN ('a','b','none')),
  explicit_feedback_a TEXT CHECK (explicit_feedback_a IN ('up','down')),
  explicit_feedback_b TEXT CHECK (explicit_feedback_b IN ('up','down')),
  saved_without_edit BOOLEAN,
  final_value JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  saved_at TIMESTAMPTZ
);

CREATE INDEX idx_persona_ab_account_field ON public.marketing_persona_ab_tests(account_id, field);
CREATE INDEX idx_persona_ab_created ON public.marketing_persona_ab_tests(created_at DESC);

ALTER TABLE public.marketing_persona_ab_tests ENABLE ROW LEVEL SECURITY;

-- Políticas: usuário acessa testes da própria conta
CREATE POLICY "Users view own account ab tests"
ON public.marketing_persona_ab_tests
FOR SELECT
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users insert own account ab tests"
ON public.marketing_persona_ab_tests
FOR INSERT
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users update own account ab tests"
ON public.marketing_persona_ab_tests
FOR UPDATE
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

-- Service role full access (para edge function)
CREATE POLICY "Service role full access persona ab"
ON public.marketing_persona_ab_tests
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');