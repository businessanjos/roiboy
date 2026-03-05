

## Plano: Aba "Insights Marketing" no setor de Marketing

### Visão Geral
Adicionar uma nova aba "Insights" na página de Marketing que reutiliza toda a infraestrutura existente de painéis e visuais do Insights (sidebar, grid, criação de visuais), mas filtrando dashboards por um novo campo `sector` na tabela `insights_dashboards`. Apenas administradores e gestores poderão criar, editar ou excluir painéis e visuais.

### Alterações

#### 1. Migração de Banco de Dados
- Adicionar coluna `sector TEXT DEFAULT 'vendas'` à tabela `insights_dashboards`
- Atualizar dashboards existentes para `sector = 'vendas'`
- Criar índice para a nova coluna

#### 2. Hook `useMarketingInsightsDashboards`
- Novo hook (ou parametrizar o existente) que filtra dashboards por `sector = 'marketing'`
- Cria dashboards com `sector: 'marketing'`
- Não usa navegação por URL (funciona inline na aba)
- Recebe um parâmetro `readOnly` para controlar permissões

#### 3. Componente `MarketingInsightsTab`
- Novo componente que encapsula o sistema de Insights dentro da aba de Marketing
- Inclui sidebar simplificada (lista de painéis) + área principal com grid de visuais
- Lógica de permissão: verifica se o usuário é admin (`role === 'admin'`, `is_also_admin`) ou gestor (`team_role_name === 'Admin'` ou `'Gestor'`)
- Se não for admin/gestor: oculta botões de criar painel, adicionar visual, excluir, renomear

#### 4. Página Marketing (`Marketing.tsx`)
- Adicionar nova aba "Insights" com ícone `BarChart3`
- Renderizar `MarketingInsightsTab` dentro do `TabsContent`

### Controle de Permissão
- **Leitura**: Todos os usuários da conta podem visualizar painéis e visuais de marketing
- **Escrita** (criar/editar/excluir): Apenas `admin`, `is_also_admin`, ou `team_role_name` em `['Admin', 'Gestor']`
- RLS existente já cobre o acesso por `account_id` -- o controle admin/gestor é feito no frontend

### Arquivos Afetados
- **Nova migração SQL**: adicionar coluna `sector` em `insights_dashboards`
- **Novo**: `src/components/marketing/MarketingInsightsTab.tsx` -- componente da aba
- **Novo**: `src/hooks/useMarketingDashboards.tsx` -- hook filtrado por sector
- **Editar**: `src/pages/Marketing.tsx` -- adicionar aba Insights
- **Editar**: `src/hooks/useInsightsDashboards.tsx` -- adicionar filtro `sector` no fetch (para o Insights de vendas não mostrar os de marketing)

