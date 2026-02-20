

## Corrigir timing da chamada manual - aguardar agente ficar ocioso

### Causa raiz

Os logs mostram claramente a sequencia de erros:

```
Login response: 204                          (OK)
manual_call/enter: 422 "Agente nao esta ocioso"   (falha - agente ainda nao esta idle)
manual_call/dial: 422 "Agente nao esta em modo manual"  (falha - nao entrou no modo manual)
```

Apos o `POST /agent/login`, o agente leva alguns instantes para transicionar para o estado "idle". O codigo atual tenta entrar no modo manual imediatamente, antes do agente estar pronto.

### Solucao

Adicionar um mecanismo de **retry com delay** no `manual_call/enter`. Apos o login na campanha, o sistema deve:

1. Aguardar 2 segundos antes da primeira tentativa
2. Tentar `POST /agent/manual_call/enter` ate 3 vezes, com 2 segundos de intervalo entre cada tentativa
3. Quando o enter for bem-sucedido, chamar `POST /agent/manual_call/dial` com o numero do telefone
4. Se todas as tentativas falharem, tentar `/click2call` como fallback

### Alteracoes

#### `supabase/functions/threecplus-call/index.ts`

Reescrever a logica apos o login da campanha para incluir retry:

```text
Fluxo atual (falha por timing):
  1. Login na campanha (204 OK)
  2. manual_call/enter (422 - agente nao esta ocioso)
  3. manual_call/dial (422 - nao esta em modo manual)

Novo fluxo com retry:
  1. Login na campanha (204 OK)
  2. Aguardar 2 segundos
  3. Tentar manual_call/enter (ate 3 tentativas com 2s de intervalo)
  4. manual_call/dial com { phone: cleanPhone }
  5. Se falhar: fallback para /click2call
```

Implementacao do retry:
- Usar um loop `for` com ate 3 iteracoes
- Cada iteracao aguarda 2 segundos via `await new Promise(r => setTimeout(r, 2000))`
- Se o status da resposta for 422 e contiver "ocioso" ou "idle", continua o loop
- Se for 200/204 (sucesso), sai do loop e faz o dial
- Se for outro erro, sai do loop e vai para fallback

### Arquivos envolvidos

- **Editar:** `supabase/functions/threecplus-call/index.ts` - Adicionar retry com delay no manual_call/enter

