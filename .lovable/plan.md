# Filtros de período personalizado e de vendedor no Dashboard Comercial

Tela: Vendas > Gestão > Dashboard Comercial.

## 1. Período personalizado

- Na lista de períodos (Este mês, Mês passado, ...) entra a opção **Personalizado**.
- Ao escolher, aparece ao lado um seletor de datas "de x até x" com calendário; enquanto as duas datas não estiverem escolhidas, o painel continua mostrando o período anterior.
- A linha "Período: 01/09/2026 → 30/09/2026" passa a mostrar as datas escolhidas, e o rótulo do filtro mostra o intervalo.
- A escolha vale para tudo da tela: indicadores principais, Metas, Funil, Performance, Equipe, Origem & Perdas e AION.
- Observação: o bloco de progresso da meta mensal continua só com "Este mês" (é uma meta do mês); nos demais períodos ele segue exibindo o aviso atual.

## 2. Filtro de vendedor

- Novo seletor ao lado do período: **Todos os vendedores** (padrão) ou um vendedor específico.
- A lista traz os vendedores ativos da equipe comercial (a mesma origem já usada nos painéis de metas e incentivos).
- Selecionando um vendedor, toda a tela passa a considerar apenas os negócios dele: faturamento, receita recebida, ticket médio, win rate, funil, reuniões, churn, origens e perdas. O ranking de vendedores fica com a linha dele.
- Atribuição pelo responsável do negócio (vendedor que fechou). Negócios sem responsável ficam de fora quando há um vendedor selecionado.
- Ambos os filtros ficam guardados no navegador, então ao voltar à tela a seleção continua.

## Detalhes técnicos

- `src/pages/SalesDashboard.tsx`: `PeriodKey` ganha `"custom"`; `getRange` passa a receber as datas personalizadas (`customStart`/`customEnd`, estado com persistência em `localStorage`, chave `sales-dashboard-filters-v1`).
- Seletor de datas com `Popover` + `Calendar` (`mode="range"`, `className="p-3 pointer-events-auto"`), formatação `dd/MM/yyyy` via date-fns/ptBR.
- Filtro de vendedor: estado `repFilter` incluído em todas as `queryKey` (`sales-dashboard-deals|won|lost|held|churn|...`) e aplicado como `.eq("responsible_user_id", repFilter)` nas consultas de `deals`; para `internal_tasks` usa `assigned_to`; para churn, filtra pelo mapa `deal_id -> responsible_user_id` já existente.
- Lista de vendedores via hook `useActiveSalesClosers` (já usado em SPIFFs/metas), evitando listas fixas.
- Sem migração e sem mudança de permissões — a tela continua restrita por `isManagementUser`.
