

## Correcao: Seletor de etapas nao aparece para alguns usuarios

### Problema

O `fetchDealStages` roda em um `useEffect` que depende de `currentUser?.account_id`. Porem, quando o dialogo do gerenciador abre (`managerOpen`), somente os campos sao re-buscados (linha 337-341), **mas as etapas do pipeline NAO sao re-buscadas**. Isso causa uma condicao de corrida:

1. Componente monta, `currentUser` ainda e null, effect nao faz nada
2. `currentUser` carrega, effect roda e busca stages
3. Mas se o usuario abrir o dialogo de edicao ANTES do fetch completar, `dealStages` esta vazio
4. A condicao `dealStages.length > 0` na linha 741 esconde o seletor de etapas

Adicionalmente, nao ha tratamento de erro no fetch - se a query falhar silenciosamente, `dealStages` permanece vazio.

### Solucao

Fazer com que as etapas do pipeline sejam buscadas de forma confiavel, tanto no mount quanto ao abrir o dialogo de edicao.

### Alteracoes tecnicas

**Arquivo:** `src/components/custom-fields/CustomFieldsManager.tsx`

1. **Extrair `fetchDealStages` para funcao reutilizavel** - Mover a logica de busca de etapas para fora do `useEffect`, tornando-a uma funcao async acessivel (similar ao `fetchFields`)

2. **Buscar stages quando o manager abre** - No `useEffect` que roda quando `managerOpen` muda (linha 337-341), tambem chamar `fetchDealStages` junto com `fetchFields`

3. **Buscar stages dentro do `openEditDialog`** - Antes de processar `required_stages`, garantir que `dealStages` esteja carregado, buscando novamente se estiver vazio

4. **Adicionar tratamento de erro** - Adicionar `try/catch` e `console.error` no fetch de stages para diagnosticar problemas futuros

| Mudanca | Motivo |
|---|---|
| Extrair fetchDealStages como funcao | Reutilizacao em multiplos pontos |
| Chamar no useEffect do managerOpen | Garantir stages ao abrir dialogo |
| Chamar dentro de openEditDialog | Garantir stages antes de processar required_stages |
| Adicionar error handling | Diagnostico de falhas silenciosas |

