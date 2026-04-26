-- Estruturar dados do briefing operacional para análise futura
ALTER TABLE public.deal_operation_briefings
  ADD COLUMN IF NOT EXISTS faturamento_mes_1 numeric,
  ADD COLUMN IF NOT EXISTS faturamento_mes_2 numeric,
  ADD COLUMN IF NOT EXISTS faturamento_mes_3 numeric,
  ADD COLUMN IF NOT EXISTS margem_lucro_percent numeric,
  ADD COLUMN IF NOT EXISTS trafego_investimento_valor numeric,
  ADD COLUMN IF NOT EXISTS trafego_investimento_periodo text,
  ADD COLUMN IF NOT EXISTS tem_caixa_bool boolean,
  ADD COLUMN IF NOT EXISTS caixa_valor numeric,
  ADD COLUMN IF NOT EXISTS horas_atende_dia_num numeric,
  ADD COLUMN IF NOT EXISTS dias_atende_semana_num numeric,
  ADD COLUMN IF NOT EXISTS numero_funcionarios_num integer,
  ADD COLUMN IF NOT EXISTS numero_salas integer,
  ADD COLUMN IF NOT EXISTS tempo_atuacao_anos numeric,
  ADD COLUMN IF NOT EXISTS ja_fez_mentoria_bool boolean,
  ADD COLUMN IF NOT EXISTS ja_fez_mentoria_quem text,
  ADD COLUMN IF NOT EXISTS conhece_cliente_nossa_bool boolean,
  ADD COLUMN IF NOT EXISTS conhece_cliente_nossa_quem text;

COMMENT ON COLUMN public.deal_operation_briefings.trafego_investimento_periodo IS 'mensal | trimestral | semestral | anual';
COMMENT ON COLUMN public.deal_operation_briefings.margem_lucro_percent IS 'Margem em percentual (0-100)';