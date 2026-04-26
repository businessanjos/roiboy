---
name: Operation Briefing Form
description: Briefing operacional internacional — País/Estado/Cidade obrigatórios (estado só p/ Brasil), valores na moeda do país com conversão automática para BRL via AwesomeAPI
type: feature
---
O comercial preenche o "Briefing para Operação" (tabela `deal_operation_briefings`) com campos ESTRUTURADOS pensados para análise/BI. Aparece em DUAS abas sincronizadas: aba "Briefing Op." no DealDetailSheet (pipeline) e aba "Briefing Op." no ClientDetail (Operações). Ligação por `deal_id` e/ou `client_id`.

**Localização internacional (clientes do mundo todo):**
- `pais` (nome) + `pais_codigo` (ISO alpha-2: BR, US, PT...) — **OBRIGATÓRIO**
- `estado` (nome) + `estado_uf` (UF quando BR) — **obrigatório só quando pais_codigo = BR**
- `cidade` (texto) — **OBRIGATÓRIO** — preenchida via autocomplete Nominatim filtrado por `countrycodes`
- `moeda_codigo` (ISO 4217: BRL, USD, EUR...) — definida automaticamente ao escolher o país (lista em `src/lib/countries.ts`)
- Componente: `src/components/operations/CountryStateCity.tsx` (selects para país + estado, autocomplete só na cidade)

**Valores monetários multi-moeda:**
- Salvos sempre na moeda original (não convertemos no banco) — `moeda_codigo` indica qual.
- Hook `useExchangeRate` (`src/hooks/useExchangeRate.ts`) busca cotação BRL via AwesomeAPI gratuita: `https://economia.awesomeapi.com.br/last/{COD}-BRL`. Cache de 1h.
- O componente `MoneyField` (interno ao OperationBriefingForm) renderiza prefix com símbolo da moeda do país e mostra `≈ R$ X (cotação de hoje)` em cinza abaixo quando moeda ≠ BRL.
- Aplica-se a: faturamento_mes_1/2/3, ticket_medio, meta_faturamento, caixa_valor, trafego_investimento_valor.

**Campos numéricos (preferenciais para análise):**
- `faturamento_mes_1/2/3` (numeric, na moeda local — três campos separados, NÃO mais texto "60mil/55/70")
- `ticket_medio`, `meta_faturamento`, `caixa_valor` (numeric, moeda local)
- `margem_lucro_percent` (0-100, sufixo %)
- `trafego_investimento_valor` + `trafego_investimento_periodo` (mensal/trimestral/semestral/anual)
- `tempo_atuacao_anos`, `horas_atende_dia_num`, `dias_atende_semana_num` (numeric)
- `numero_funcionarios_num`, `numero_salas` (integer)
- `tem_caixa_bool`, `ja_fez_mentoria_bool`, `conhece_cliente_nossa_bool` (boolean) + campo "_quem" para detalhe

**Validação contextual** (`getMissingFields` / `isBriefingComplete`): tempo_atuacao_anos, faturamento_mes_1/2/3, ticket_medio, margem_lucro_percent, foco_atuacao, objetivo_mentoria, **pais_codigo, cidade**, estrutura_clinica, numero_funcionarios_num, meta_faturamento, especialidade — mais `estado_uf` quando pais_codigo = BR.

**UX**: NumberField customizado com prefix/suffix dinâmicos (símbolo da moeda corrente, %, h, dias), inputMode="decimal", clamp por max (% até 100, horas até 24, dias até 7). BoolWithDetail combina Sim/Não + input quando "Sim". Componente em `src/components/operations/OperationBriefingForm.tsx`. O `handleMarkAsWon` em SalesPipeline.tsx bloqueia o ganho se `is_complete = false`.

Os campos legados (`ultimos_faturamentos`, `margem_lucro`, `trafego_investimento`, etc.) continuam sendo populados como resumo concatenado na moeda original para retrocompatibilidade.
