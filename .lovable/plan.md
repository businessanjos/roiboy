

## Corrigir erro "Failed to fetch" ao testar conexao Omie

### Problema

O botao "Testar Conexao" faz uma chamada direta do navegador para `https://app.omie.com.br/api/v1/geral/clientes/`. A API do Omie nao permite requisicoes cross-origin (CORS), entao o navegador bloqueia a resposta e retorna "Failed to fetch".

### Solucao

Criar uma Edge Function `test-omie-connection` que atua como proxy para a chamada de teste, e alterar o frontend para usar essa funcao em vez de chamar a API do Omie diretamente.

### Alteracoes

**1. Nova Edge Function: `supabase/functions/test-omie-connection/index.ts`**

- Recebe `app_key` e `app_secret` no body
- Faz a chamada `ListarClientes` (pagina 1, 1 registro) para a API do Omie do lado servidor (sem restricao CORS)
- Retorna sucesso ou erro com a mensagem do Omie
- Inclui headers CORS corretos para o frontend

**2. Alterar `src/components/integrations/OmieIntegrationTab.tsx`**

- Na funcao `handleTestConnection`, substituir o `fetch` direto para `app.omie.com.br` por uma chamada via `supabase.functions.invoke('test-omie-connection', { body: { app_key, app_secret } })`
- Manter a mesma logica de exibicao de toast de sucesso/erro

### Detalhes tecnicos

A Edge Function tera esta estrutura simplificada:

```text
POST /test-omie-connection
Body: { app_key: string, app_secret: string }

1. Chama POST https://app.omie.com.br/api/v1/geral/clientes/
   com ListarClientes, pagina 1, registros 1
2. Se retornar faultstring -> { success: false, error: faultstring }
3. Se retornar dados -> { success: true }
4. Se erro de rede -> { success: false, error: mensagem }
```

No frontend, a chamada muda de:
```text
fetch("https://app.omie.com.br/api/v1/geral/clientes/", ...)
```
Para:
```text
supabase.functions.invoke("test-omie-connection", { body: { app_key, app_secret } })
```

