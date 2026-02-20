

## Corrigir click-to-call usando o fluxo correto da API

### Causa raiz

Os logs mostram que o login na campanha funciona corretamente (status 204), mas o endpoint `POST /click2call` retorna **403 Forbidden** ("Voce nao tem permissao para acessar esse recurso"). Isso indica que o token de Agente/Operador nao tem permissao para esse endpoint.

A documentacao da API do 3C Plus oferece dois caminhos para ligacao manual:

| Endpoint | Permissao | Descricao |
|---|---|---|
| `POST /click2call` | Supervisor/Admin | Inicia ligacao se agente estiver idle |
| `POST /agent/manual_call/enter` + `POST /agent/manual_call/dial` | Agente | Fluxo de ligacao manual em 2 etapas |

### Solucao

Alterar a edge function `threecplus-call` para usar o fluxo de ligacao manual em 2 etapas, que funciona com token de Agente:

1. **Etapa 1:** `POST /agent/manual_call/enter?api_token=...` - Entra no modo de ligacao manual
2. **Etapa 2:** `POST /agent/manual_call/dial?api_token=...` com body `{ phone: "numero" }` - Disca o numero

Se a etapa 1 falhar (ex: agente ja esta no modo manual), tentar diretamente a etapa 2. Se ambos falharem, tentar o endpoint `/click2call` como fallback (caso o token tenha permissao de Supervisor).

### Alteracoes

#### `supabase/functions/threecplus-call/index.ts`

Substituir a chamada unica ao `/click2call` pelo fluxo em 2 etapas:

```text
Fluxo atual (falha com 403):
  POST /click2call { phone }

Novo fluxo:
  1. POST /agent/manual_call/enter  (entrar no modo manual)
  2. POST /agent/manual_call/dial   { phone }  (discar)
  3. Se ambos falharem: fallback para POST /click2call { phone }
```

- Manter o login na campanha (etapa 0) que ja funciona
- Adicionar logs para cada etapa do fluxo
- Tratar erros especificos de cada etapa com mensagens claras

### Arquivos envolvidos

- **Editar:** `supabase/functions/threecplus-call/index.ts` - Substituir `/click2call` pelo fluxo `/agent/manual_call/enter` + `/agent/manual_call/dial`

