---
name: Operation Briefing Form
description: Briefing operacional estruturado com campos numéricos (faturamentos separados, % margem, R$ + período de investimento) — substitui texto livre, obrigatório para Ganhar
type: feature
---
O comercial preenche o "Briefing para Operação" (tabela `deal_operation_briefings`) com campos ESTRUTURADOS pensados para análise/BI. Aparece em DUAS abas sincronizadas: aba "Briefing Op." no DealDetailSheet (pipeline) e aba "Briefing Op." no ClientDetail (Operações). Ligação por `deal_id` e/ou `client_id`.

**Campos numéricos (preferenciais para análise):**
- `faturamento_mes_1/2/3` (numeric R$ — três campos separados, NÃO mais texto "60mil/55/70")
- `ticket_medio`, `meta_faturamento`, `caixa_valor` (numeric R$)
- `margem_lucro_percent` (0-100, sufixo %)
- `trafego_investimento_valor` + `trafego_investimento_periodo` (mensal/trimestral/semestral/anual)
- `tempo_atuacao_anos`, `horas_atende_dia_num`, `dias_atende_semana_num` (numeric)
- `numero_funcionarios_num`, `numero_salas` (integer)
- `tem_caixa_bool`, `ja_fez_mentoria_bool`, `conhece_cliente_nossa_bool` (boolean) + campo "_quem" para detalhe textual

Os campos antigos (`ultimos_faturamentos`, `margem_lucro`, `trafego_investimento`, etc.) são mantidos e populados automaticamente a partir dos estruturados (resumo concatenado) para retrocompatibilidade.

**Campos obrigatórios (`REQUIRED_BRIEFING_FIELDS`)**: tempo_atuacao_anos, faturamento_mes_1/2/3, ticket_medio, margem_lucro_percent, foco_atuacao, objetivo_mentoria, cidade, estrutura_clinica, numero_funcionarios_num, meta_faturamento, especialidade.

**UX**: NumberField customizado com prefix/suffix (R$, %, h, dias), inputMode="decimal", clamp por max (% até 100, horas até 24, dias até 7). BoolWithDetail combina Sim/Não + input quando "Sim". Componente em src/components/operations/OperationBriefingForm.tsx. O `handleMarkAsWon` em SalesPipeline.tsx bloqueia o ganho se `is_complete = false`.
