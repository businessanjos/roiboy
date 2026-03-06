

## Duplicar Painel de Insights

### O que será feito
Adicionar a opção "Duplicar" no dropdown de ações de cada painel na sidebar do Insights. Ao clicar, será criada uma cópia do painel com todos os visuais (incluindo config, layout e chart_type).

### Alterações

**1. `src/hooks/useInsightsDashboards.tsx`**
- Adicionar `duplicateDashboard` ao contexto e interface
- Criar mutation que:
  1. Insere novo dashboard com nome `"{nome original} (cópia)"`
  2. Busca todos os visuais do dashboard original
  3. Insere cópias dos visuais no novo dashboard (mantendo `title`, `chart_type`, `config`, `layout`)
  4. Navega para o novo dashboard

**2. `src/components/insights/sidebar/InsightsDashboardItem.tsx`**
- Adicionar prop `onDuplicate?: (id: string) => Promise<void>`
- Adicionar item "Duplicar" no dropdown (ícone `Copy`) entre "Renomear" e "Excluir"

**3. `src/components/insights/sidebar/InsightsDashboardList.tsx`**
- Passar `onDuplicate` prop do contexto para cada `InsightsDashboardItem`

**4. `src/components/insights/sidebar/InsightsSidebar.tsx`**
- Passar `duplicateDashboard` do hook para `InsightsDashboardList`

