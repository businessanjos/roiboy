

## Adicionar tag de etapa do negocio nas conversas do ROY zAPP

### Objetivo

Exibir ao lado da tag do vendedor responsavel uma badge indicando em qual etapa do pipeline o negocio mais recente do lead se encontra, com a cor correspondente da etapa.

### Abordagem

A estrategia e similar a como `clientProducts` ja funciona: apos buscar os assignments, coletar todos os `lead_id`s, fazer uma query batch para buscar o negocio mais recente de cada lead com sua etapa, e passar esse mapa como prop ate o `ZappConversationItem`.

### Alteracoes tecnicas

**1. `src/hooks/useZappData.tsx` - Buscar etapas dos negocios por lead**

- Adicionar um novo estado `leadDealStages` do tipo `Record<string, { stageName: string; stageColor: string }>`
- Dentro de `fetchAssignmentsOnly`, apos a busca de `clientProducts` (linhas 220-246), coletar todos os `lead_id`s das conversas
- Fazer uma query na tabela `deals` filtrando por esses `lead_id`s, status `open`, ordenando por `created_at desc`, e buscando `stage:deal_stages(name, color)`
- Agrupar por `lead_id` pegando apenas o primeiro resultado (negocio mais recente)
- Armazenar no estado `leadDealStages`
- Expor `leadDealStages` no retorno do hook (linha 1030)

**2. `src/pages/RoyZapp.tsx` - Passar dados para o painel**

- Extrair `leadDealStages` do retorno de `useZappData`
- Passar como prop para `ZappConversationPanel`

**3. `src/components/royzapp/ZappConversationPanel.tsx` - Repassar para items**

- Adicionar `leadDealStages` na interface de props
- Passar para cada `ZappConversationItem`

**4. `src/components/royzapp/ZappConversationItem.tsx` - Renderizar a badge**

- Adicionar prop `leadDealStages`
- Extrair o `lead_id` da conversa via `assignment.zapp_conversation?.lead_id`
- Renderizar uma badge ao lado da badge do agente (linha ~338), com o nome da etapa e a cor correspondente, usando um icone de funil (TrendingUp ou similar do lucide)
- Atualizar a funcao de comparacao do `memo` para incluir `leadDealStages`

### Resultado esperado

Cada conversa vinculada a um lead com negocio ativo mostrara uma tag colorida com o nome da etapa (ex: "Qualificacao", "Proposta", etc.) ao lado da tag do vendedor, permitindo que a equipe identifique rapidamente o estagio do funil de cada contato sem sair do chat.

