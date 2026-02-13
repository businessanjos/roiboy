

## Reverter os 4 Campos Fixos (MQL, Proprietario, Canal, Faturamento) do Cadastro de Leads

### O que sera removido

Todas as referencias aos 4 campos fixos que foram adicionados pela instrucao anterior, sem afetar nenhuma outra funcionalidade.

### Arquivos e Mudancas

**1. `src/pages/Leads.tsx`**
- Remover a constante `REVENUE_RANGES` (linhas 105-111) e a funcao `normalizeRevenueRange` (linhas 114-125)
- Remover o state `filterRevenueRange` (linha 150)
- Remover o state `teamUsers` e o useEffect que carrega usuarios da equipe (linhas 218-231)
- Remover `mql`, `canal`, `responsible_user_id`, `revenue_range` do `formData` inicial (linhas 242-245) e do `resetForm` (linhas 340-343)
- Remover esses campos do `openEditDialog` (linhas 380-383)
- Remover a limpeza em `handleSave` / `cleanedData` (linhas 465-468)
- Remover o bloco de UI dos 4 campos fixos no formulario (linhas 1686-1763)
- Remover o filtro de faturamento na barra de filtros e na logica de filtragem
- Remover mapeamento de `revenue_range` na importacao CSV

**2. `src/components/leads/LeadDetailSheet.tsx`**
- Remover a exibicao dos campos MQL, Proprietario, Canal e Faturamento na secao de detalhes (o bloco com grid de badges)
- Remover constantes `CANAL_OPTIONS` e `REVENUE_RANGES`
- Remover state `responsibleUserName` e a busca do nome do usuario responsavel

**3. `src/hooks/useLeads.tsx`**
- Remover `mql`, `canal`, `revenue_range` da interface `Lead` e de `CreateLeadData`
- Manter `responsible_user_id` pois e usado por outros modulos (ex: RoyZapp)

### O que NAO sera alterado
- Colunas `mql`, `canal`, `revenue_range` no banco de dados (ficam intactas, sem perda de dados)
- O campo `responsible_user_id` continuara existindo na interface Lead (e usado em outros locais)
- Nenhuma outra funcionalidade (importacao de leads geral, timeline, deals, etc.) sera afetada

