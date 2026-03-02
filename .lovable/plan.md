
## Corrigir erro "Erro ao carregar leads" ao abrir o Pipeline

### Problema identificado

O erro "TypeError: Failed to fetch" ocorre porque o hook `useLeads()` e chamado imediatamente ao montar a pagina do Pipeline, mesmo quando o usuario esta na aba "Pipeline" e nao na aba "Prospecao".

Com 672+ negocios abertos, o Pipeline ja dispara centenas de requisicoes simultaneas (uma query `internal_tasks` por card de negocio via `useDealActivityStatus`). Quando o `useLeads` tenta buscar todos os leads ao mesmo tempo, o navegador atinge o limite de conexoes simultaneas (6 por dominio), e algumas requisicoes falham com "Failed to fetch".

### Causa raiz

- Linha 90 de `SalesPipeline.tsx`: `const { leads, loading: leadsLoading, refetch: refetchLeads } = useLeads();`
- Este hook busca TODOS os leads com paginacao (lotes de 1000) imediatamente no mount
- O unico uso dos dados de `leads` na aba Pipeline e mostrar o contador no badge: `leads.length`
- A aba `LeadsTab` provavelmente tem sua propria busca de dados independente

### Solucao

Adiar o carregamento dos leads ate que o usuario realmente acesse a aba "Prospecao", ou ate que o carregamento principal do pipeline termine.

**Alteracao em `src/pages/SalesPipeline.tsx`:**

1. Remover a chamada eageer do `useLeads()` no topo do componente
2. Carregar leads apenas quando `mainTab === 'prospeccao'` ou apos o pipeline terminar de carregar
3. Para o badge de contagem na aba Prospecao, fazer uma query leve separada (apenas count) ou mostrar o badge somente apos os leads serem carregados

**Alteracao em `src/hooks/useLeads.tsx`:**

1. Adicionar um parametro `enabled` opcional ao hook para controlar quando a busca e executada
2. Quando `enabled` for `false`, nao disparar o fetch automatico

### Detalhes tecnicos

```text
Antes:  useLeads() -> fetch imediato de todos os leads (competindo com 672+ queries de tasks)
Depois: useLeads({ enabled: mainTab === 'prospeccao' || !loading }) -> fetch adiado
```

Alternativa mais simples: usar uma query de contagem leve (`select('id', { count: 'exact', head: true })`) para o badge, e carregar os dados completos apenas na aba Prospecao.

### Resultado

- O Pipeline abrira sem disparar a busca pesada de leads
- O erro "Failed to fetch" sera eliminado pois as requisicoes nao competirao entre si
- A contagem do badge sera carregada com uma query leve
- Os dados completos dos leads serao buscados apenas quando necessario
