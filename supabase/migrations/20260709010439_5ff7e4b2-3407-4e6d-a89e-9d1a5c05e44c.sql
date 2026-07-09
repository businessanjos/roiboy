
-- ============ RÉGUA DE COBRANÇA ============

-- 1) Regras da régua padrão da conta
CREATE TABLE public.billing_reminder_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  name text NOT NULL,
  days_offset integer NOT NULL, -- negativo = antes do vencimento; 0 = no dia; positivo = após
  channels text[] NOT NULL DEFAULT ARRAY['whatsapp']::text[],
  subject text,
  message text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_reminder_rules_channels_chk
    CHECK (array_length(channels, 1) >= 1)
);

CREATE INDEX idx_billing_reminder_rules_account ON public.billing_reminder_rules(account_id);
CREATE INDEX idx_billing_reminder_rules_active ON public.billing_reminder_rules(account_id, active, days_offset);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_reminder_rules TO authenticated;
GRANT ALL ON public.billing_reminder_rules TO service_role;

ALTER TABLE public.billing_reminder_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acct view billing rules" ON public.billing_reminder_rules
  FOR SELECT USING (account_id = get_user_account_id());
CREATE POLICY "acct insert billing rules" ON public.billing_reminder_rules
  FOR INSERT WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "acct update billing rules" ON public.billing_reminder_rules
  FOR UPDATE USING (account_id = get_user_account_id());
CREATE POLICY "acct delete billing rules" ON public.billing_reminder_rules
  FOR DELETE USING (account_id = get_user_account_id());

CREATE TRIGGER trg_billing_reminder_rules_updated
  BEFORE UPDATE ON public.billing_reminder_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2) Overrides por cliente (pausar ou customizar canais)
CREATE TABLE public.billing_reminder_client_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  paused boolean NOT NULL DEFAULT false,
  pause_reason text,
  custom_channels text[],
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id)
);

CREATE INDEX idx_billing_client_settings_account ON public.billing_reminder_client_settings(account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_reminder_client_settings TO authenticated;
GRANT ALL ON public.billing_reminder_client_settings TO service_role;

ALTER TABLE public.billing_reminder_client_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acct view billing settings" ON public.billing_reminder_client_settings
  FOR SELECT USING (account_id = get_user_account_id());
CREATE POLICY "acct insert billing settings" ON public.billing_reminder_client_settings
  FOR INSERT WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "acct update billing settings" ON public.billing_reminder_client_settings
  FOR UPDATE USING (account_id = get_user_account_id());
CREATE POLICY "acct delete billing settings" ON public.billing_reminder_client_settings
  FOR DELETE USING (account_id = get_user_account_id());

CREATE TRIGGER trg_billing_client_settings_updated
  BEFORE UPDATE ON public.billing_reminder_client_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3) Log de envios (para dedupe e histórico)
CREATE TABLE public.billing_reminder_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  rule_id uuid NOT NULL REFERENCES public.billing_reminder_rules(id) ON DELETE CASCADE,
  installment_id uuid NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  client_id uuid,
  channel text NOT NULL,
  recipient text,
  status text NOT NULL, -- 'sent','failed','skipped'
  error text,
  message_preview text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, installment_id, channel)
);

CREATE INDEX idx_billing_sends_account ON public.billing_reminder_sends(account_id, sent_at DESC);
CREATE INDEX idx_billing_sends_installment ON public.billing_reminder_sends(installment_id);
CREATE INDEX idx_billing_sends_client ON public.billing_reminder_sends(client_id, sent_at DESC);

GRANT SELECT, INSERT ON public.billing_reminder_sends TO authenticated;
GRANT ALL ON public.billing_reminder_sends TO service_role;

ALTER TABLE public.billing_reminder_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acct view billing sends" ON public.billing_reminder_sends
  FOR SELECT USING (account_id = get_user_account_id());
CREATE POLICY "acct insert billing sends" ON public.billing_reminder_sends
  FOR INSERT WITH CHECK (account_id = get_user_account_id());


-- 4) Seed da "régua completa" para todas as contas existentes
INSERT INTO public.billing_reminder_rules
  (account_id, name, days_offset, channels, subject, message, sort_order)
SELECT a.id, r.name, r.days_offset, r.channels, r.subject, r.message, r.sort_order
FROM public.accounts a
CROSS JOIN (VALUES
  ('7 dias antes do vencimento', -7,
   ARRAY['whatsapp','email']::text[],
   'Lembrete: sua parcela vence em 7 dias',
   'Olá, {primeiro_nome}! Passando para lembrar que sua parcela de {valor} vence em {vencimento} (em {dias_para_vencer} dias). Qualquer dúvida estamos à disposição.', 10),

  ('3 dias antes do vencimento', -3,
   ARRAY['whatsapp','email']::text[],
   'Sua parcela vence em 3 dias',
   'Oi, {primeiro_nome}! Sua parcela de {valor} vence em {vencimento}. Se já efetuou o pagamento, pode desconsiderar esta mensagem.', 20),

  ('No dia do vencimento', 0,
   ARRAY['whatsapp','email']::text[],
   'Sua parcela vence hoje',
   '{primeiro_nome}, hoje é o dia do vencimento da sua parcela de {valor}. Se precisar de ajuda com o pagamento é só falar com a gente.', 30),

  ('1 dia após o vencimento (D+1)', 1,
   ARRAY['whatsapp']::text[],
   NULL,
   'Oi, {primeiro_nome}. Identificamos que sua parcela de {valor} venceu ontem ({vencimento}) e ainda consta em aberto. Consegue regularizar hoje?', 40),

  ('5 dias após vencimento (D+5)', 5,
   ARRAY['whatsapp','email']::text[],
   'Parcela em atraso — regularização',
   '{primeiro_nome}, sua parcela de {valor} está com {dias_atraso} dias de atraso. Para evitar acréscimos, pedimos que regularize o pagamento ou nos avise por aqui.', 50),

  ('10 dias após vencimento (D+10)', 10,
   ARRAY['whatsapp','email']::text[],
   'Parcela em atraso — precisamos falar',
   '{primeiro_nome}, sua parcela de {valor} venceu há {dias_atraso} dias. Para não impactarmos seu acesso, precisamos que entre em contato até amanhã para renegociar ou quitar.', 60),

  ('20 dias após vencimento (D+20)', 20,
   ARRAY['whatsapp','email']::text[],
   'Última notificação amigável',
   '{primeiro_nome}, este é um último aviso amigável: sua parcela de {valor} está com {dias_atraso} dias de atraso. Caso não haja retorno em 5 dias, o caso será encaminhado para a etapa jurídica de cobrança.', 70),

  ('30 dias após vencimento — escalação judicial', 30,
   ARRAY['whatsapp','email']::text[],
   'Encaminhamento para cobrança judicial',
   '{primeiro_nome}, sua parcela de {valor} venceu há {dias_atraso} dias e permanece em aberto. Estamos preparando o encaminhamento do caso para a nossa assessoria jurídica. Ainda dá tempo de regularizar entrando em contato até o final de amanhã.', 80)
) AS r(name, days_offset, channels, subject, message, sort_order);
