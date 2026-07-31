# Construtor de visuais no modelo Pipedrive

Objetivo: mudar a lógica de criação de gráficos do Insights para o mesmo modelo mental do relatório do Pipedrive descrito no SOP — **Entidade → Medir por → Ver por → Segmentar por → Filtros** — valendo para todas as fontes de dados (Negócios, Leads, Produtos, Tarefas, Histórico de Vendas).

## Diagnóstico do que existe hoje

- O fluxo atual do `AddVisualModal` começa pelo formato do gráfico e depois oferece uma **métrica pré-definida** (Faturamento, Nº de negócios, Ticket médio...) e um **agrupamento** de lista fixa. Não existe o conceito livre de "medir por campo X".
- **Segmentar por** existe (`stackBy` / `stackByCustomField`), mas só aparece no ajuste rápido do card e praticamente só funciona em barra empilhada com Negócios/Leads. Não é oferecido na criação.
- **Filtros** só existem para campos personalizados (`dealFieldFilters` / `leadFieldFilters`) mais status do negócio e um intervalo de datas virtual. Campos nativos como Canal de Venda, Origem da Venda, Etapa, Vendedor e Produto **não podem ser usados como filtro**, apenas como dimensão.
- Não existe operador: todo filtro hoje é "é qualquer um destes valores". O SOP usa **é**, **é qualquer** e **intervalo de datas** de forma explícita.
- Cada fonte tem uma lista de campos escrita à mão em pontos diferentes do código, o que faz Ver por / Segmentar por / Filtros oferecerem conjuntos de campos diferentes entre si.

## O que muda

### 1. Catálogo único de campos por fonte
Um registro central que descreve, para cada fonte, todos os campos disponíveis (nativos + personalizados carregados do banco) com nome, tipo (texto / número / data) e como buscar os valores possíveis. Ver por, Segmentar por e Filtros passam a ler desse mesmo catálogo — acabam as divergências.

### 2. Novo fluxo de criação (mesma sequência do SOP)
1. **Entidade + formato** — fonte de dados e tipo de visual.
2. **Medir por** — contagem de registros, soma, média ou ciclo de vendas sobre um campo numérico da fonte (ex.: "Número de negócios", "Soma do valor").
3. **Ver por** — dimensão que forma o eixo (com agrupamento por dia/semana/mês/ano quando for data).
4. **Segmentar por** (opcional) — qualquer campo do catálogo. Se preenchido em gráfico de barras, o visual passa a empilhar automaticamente com legenda colorida.
5. **Filtros** — linhas no formato **Campo · Operador · Valor(es)**, com botão "Adicionar filtro" e combinação E entre elas.

Os presets atuais (Faturamento, Nº de negócios etc.) continuam disponíveis como atalho que apenas pré-preenche Medir por / Ver por — nada do que já existe deixa de funcionar.

### 3. Operadores de filtro
- Texto/seleção: **é**, **é qualquer**, **não é**, **está vazio / preenchido**
- Data: **é** (hoje, esta semana, este mês, este ano, período personalizado) e **entre**
- Número: **maior que**, **menor que**, **entre**

### 4. Segmentação liberada para todas as fontes
O motor de dados empilhados hoje só cobre Negócios e Leads. Passa a cobrir também Produtos, Tarefas e Histórico de Vendas, e a aceitar qualquer campo do catálogo como segmentação.

### 5. Compatibilidade
Nenhuma mudança no banco. Os visuais já salvos continuam funcionando: os formatos antigos de filtro são convertidos em memória para o novo formato quando o visual é lido, e só são regravados no formato novo se o usuário editar o visual.

### 6. Validação com o caso real do SOP
Ao final, montar no Insights o relatório do SOP para conferir a paridade: negócios criados este ano · Canal de Venda = Orgânico · Origem da Venda é qualquer [ORG-EVER], [ORG-EC], [ORG-BP] · barras verticais · Medir por Número de negócios · Ver por Origem da Venda · Segmentar por MQL. Antes disso, confirmo no banco onde estão hoje "Canal de Venda", "Origem da Venda" e "MQL" (campo nativo do negócio ou campo personalizado vindo do Pipedrive) — essa checagem é o primeiro passo da execução, porque define se o catálogo precisa mesclar campos personalizados por conta.

## Detalhes técnicos

- Novo `src/lib/insights/fieldRegistry.ts`: catálogo de campos por `DataSource`, unindo `DATA_SOURCE_FIELDS` com `custom_fields` (entidade lead/deal) e campos virtuais (`__deal_created_at__`, status).
- Novo tipo `VisualFilter { source: 'native' | 'custom'; field: string; label: string; type: 'text'|'number'|'date'; operator: FilterOperator; values: string[]; from?: string; to?: string }` em `visual-builder/types.ts`, com `normalizeFilters(config)` para converter `leadFieldFilter(s)`, `dealFieldFilter(s)`, `dealStatusFilter` e `fixedDateRange`.
- Novo `src/lib/insights/applyFilters.ts` com duas metades: predicados de query (campos nativos → `.eq/.in/.gte/.lte` no Supabase) e predicado em memória (campos personalizados, já carregados via `*_field_values`). Consumido por `useVisualData`, `useStackedVisualData`, `useMapVisualData` e pelo drilldown, para o filtro valer também no detalhamento.
- Novo componente `visual-builder/FilterSection.tsx` (linhas campo/operador/valor) substituindo `DealFieldFilterSection` e `LeadFieldFilterSection`, que passam a ser wrappers finos até a migração dos usos.
- `AddVisualModal`: reorganização dos passos para Medir por / Ver por / Segmentar por / Filtros, mantendo os atalhos de métrica e o cálculo de posição livre do `layoutPlacement`.
- `VisualQuickSettings`: passa a usar o mesmo catálogo e o mesmo componente de filtros, para o card e o modal não divergirem.
- `useStackedVisualData`: generalizar a resolução de série para qualquer fonte/campo, hoje limitada a deals/leads.
- Sem migração de banco; `insights_visuals.config` continua JSON livre.

## Fora de escopo

- Importar relatórios prontos do Pipedrive via conector.
- Mudança visual dos gráficos já entregues (eixos, rótulos, modo TV).
