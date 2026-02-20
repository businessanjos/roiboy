

## Corrigir tratamento de erro na integracao 3C Plus

### Problema

A edge function `threecplus-auth` retorna HTTP 400 com mensagem descritiva quando o token e invalido (ex: "Token invalido. Verifique seu token da API 3C Plus."). Porem o `supabase.functions.invoke` lanca uma excecao generica para qualquer resposta non-2xx, e o frontend so mostra "Edge Function returned a non-2xx status code" ao inves da mensagem real.

### Solucao

Duas alteracoes:

#### 1. Edge Function `supabase/functions/threecplus-auth/index.ts`

Retornar HTTP 200 para erros de validacao (token invalido, usuario nao encontrado), incluindo `success: false` e `error` no JSON. Reservar status non-2xx apenas para erros reais do servidor.

Mudancas especificas:
- Quando a API 3C Plus retorna 401/403, retornar `{ success: false, error: "Token invalido..." }` com status 200
- Quando a API retorna outro erro, retornar `{ success: false, error: "Erro ao validar..." }` com status 200
- Adicionar logging para diagnosticar problemas com a API 3C Plus (logar o status e corpo da resposta)
- Manter status 401/500 apenas para erros internos reais (auth do usuario ROY, erros do servidor)

#### 2. Frontend `src/components/integrations/IntegrationsContent.tsx`

Atualizar `handle3CPlusConnect` para tratar tanto `data.error` quanto excecoes do invoke:

- No catch, tentar extrair o corpo JSON da resposta de erro usando `err.context?.body` ou parse do erro
- Exibir a mensagem descritiva ao usuario em vez da mensagem generica

### Sobre a conta admin

Adicionar uma nota no texto de ajuda do formulario mencionando que tokens de contas admin podem nao funcionar, orientando o usuario a usar um token de conta de operador/agente.

### Resultado esperado

1. Usuario insere token de conta admin -> ve "Token invalido. Verifique seu token da API 3C Plus." (mensagem clara)
2. Usuario insere token incorreto -> ve mensagem descritiva de erro
3. Usuario insere token valido de operador -> conecta com sucesso

