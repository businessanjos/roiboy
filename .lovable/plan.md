

## Plano: Adicionar filtro `type` na função `get-client-by-phone`

### Problema

O node "Procura lead pelo telefone" no n8n chama `get-client-by-phone`, que busca primeiro na tabela `clients` e só busca em `leads` se não encontrar cliente. Quando o mesmo telefone existe em ambas as tabelas, retorna o cliente em vez do lead, quebrando o fluxo.

### Solução

Adicionar um query parameter opcional `type` à função. Quando `type=lead`, a busca na tabela `clients` é completamente ignorada — a função vai direto para a busca em `leads`.

### Alteração

**Arquivo: `supabase/functions/get-client-by-phone/index.ts`**

1. Ler o parâmetro `type` da URL: `const searchType = url.searchParams.get("type");`
2. Envolver o bloco de busca de clientes (linhas ~82-100) em `if (searchType !== 'lead')` — se `type=lead`, pula direto para a busca de leads
3. Quando `type=lead` e o lead é encontrado, retornar sem buscar scores, risk_events, etc. (que são dados de cliente)

No n8n, basta adicionar `&type=lead` na URL do node "Procura lead pelo telefone".

### Compatibilidade

- Sem o parâmetro `type`, o comportamento permanece idêntico ao atual (busca cliente primeiro, depois lead)
- Com `type=lead`, ignora clientes completamente

