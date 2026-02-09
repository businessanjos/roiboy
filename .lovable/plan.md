
# Melhoria na Busca de Clientes - Ranking por Relevancia

## Problema Identificado
Ao buscar "Ana Carolina", a logica atual usa OR entre os termos: retorna qualquer cliente que contenha "Ana" **ou** "Carolina" no nome. Isso gera 148 resultados, e a cliente "Ana Carolina Gomes Oliveira da Silva" fica perdida no meio por estar ordenada alfabeticamente (e nao por relevancia).

## Solucao

Alterar a Edge Function `list-clients` para implementar um sistema de ranking por similaridade quando ha busca com multiplos termos.

### Estrategia de Ordenacao (server-side)

1. **Prioridade 1 - Match exato da frase completa**: Clientes cujo nome contenha a string exata "Ana Carolina" aparecem primeiro
2. **Prioridade 2 - Todos os termos presentes**: Clientes que contenham TODOS os termos buscados (Ana E Carolina)
3. **Prioridade 3 - Ao menos um termo**: Clientes que contenham pelo menos um dos termos

### Mudancas Tecnicas

**Arquivo:** `supabase/functions/list-clients/index.ts`

A busca continuara usando OR no filtro do Supabase (para nao perder resultados), mas apos receber os dados, os clientes serao reordenados por relevancia:

```text
Fluxo atual:
  Busca OR -> Ordenacao alfabetica -> Retorno

Fluxo novo:
  Busca OR -> Reordenacao por relevancia -> Retorno
```

Logica de scoring pos-query:
- **+100 pontos**: nome contem a frase exata digitada (ex: "ana carolina")
- **+10 pontos por termo**: para cada termo encontrado no nome
- Desempate: ordem alfabetica

Isso garante que "ANA CAROLINA GOMES OLIVEIRA DA SILVA" apareca no topo ao buscar "Ana Carolina", enquanto clientes como "Ana Paula Cardoso" aparecem depois.

### Impacto
- Nenhuma mudanca no frontend (o hook `useOptimizedClients` e os componentes continuam iguais)
- Apenas a Edge Function e modificada
- A paginacao e contagem total continuam funcionando normalmente
- Performance: o scoring e feito em memoria apenas nos registros ja retornados pela pagina (max 200), sem custo adicional
