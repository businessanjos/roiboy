

## Manter Leads convertidos visiveis na listagem

### Problema

Quando um Lead e convertido em Cliente (via negocio ganho), ele recebe `status = 'converted'` e `converted_to_client_id` preenchido. O hook `useLeads` filtra esses leads com `.is('converted_to_client_id', null)`, fazendo com que desaparecam da listagem. Alem disso, o `markAsConvertedToDeal` remove o lead do estado local com `setLeads(prev => prev.filter(...))`.

### Solucao

#### 1. `src/hooks/useLeads.tsx` - Remover filtro que esconde leads convertidos

- Remover a linha `.is('converted_to_client_id', null)` da query `fetchLeads`
- Na funcao `markAsConvertedToDeal`, remover o `setLeads(prev => prev.filter(...))` e substituir por um `await fetchLeads()` para atualizar o estado com o lead agora marcado como "converted"

#### 2. `src/pages/Leads.tsx` - Adicionar status "Convertido" na UI

- Adicionar `{ value: "converted", label: "Convertido", color: "bg-purple-500" }` ao array `LEAD_STATUS`
- Isso faz com que leads convertidos exibam um badge roxo "Convertido" na listagem, diferenciando-os visualmente

#### 3. `src/components/leads/LeadDetailSheet.tsx` - Adicionar status "Convertido"

- Adicionar a mesma entrada ao array `LEAD_STATUS` local para que o detalhe do lead tambem exiba o status corretamente

#### 4. `src/components/sales/LeadsTab.tsx` - Adicionar status "Convertido"

- Adicionar a mesma entrada ao array `LEAD_STATUS` local da aba de Leads do setor Vendas

### O que NAO sera alterado

- As queries de deteccao de duplicados (`useLeadDuplicateDetection`) e visualizacoes analiticas (`useVisualData`, `useStackedVisualData`, `useVisualDrilldown`) continuarao filtrando leads convertidos, pois nesses contextos faz sentido nao misturar leads ativos com convertidos
- A busca no RoyZapp tambem mantera o filtro, pois so interessa buscar leads nao convertidos para iniciar conversas

### Resultado esperado

- Leads convertidos permanecem visiveis na listagem com badge roxo "Convertido"
- O usuario pode clicar no lead convertido e ver seus detalhes, incluindo o vinculo com o cliente
- O historico do lead e preservado e acessivel

