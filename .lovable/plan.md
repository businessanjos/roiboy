
# Plano: Implementar Resiliência de Envio de Mensagens com Retry Automático

## Diagnóstico do Problema

O erro "Edge Function returned a non-2xx status code" ocorre frequentemente devido a:

1. **Timeout da API UAZAPI**: A API externa pode demorar mais do que o esperado
2. **Instabilidade de rede**: Falhas temporárias de conexão entre Supabase Edge e UAZAPI
3. **Rate limiting**: UAZAPI pode estar limitando requisições
4. **Erros transitórios**: 500/503 que se resolvem sozinhos em segundos

### Fluxo Atual (Sem Resiliência)

```text
┌─────────────────────────────────────────────────────────────────┐
│  Frontend envia mensagem                                         │
│       ↓                                                          │
│  Edge Function faz 1 tentativa para UAZAPI                       │
│       ↓                                                          │
│  Se falhar → Erro imediato para usuário                          │
│       ↓                                                          │
│  Mensagem marcada como "failed"                                  │
│       ↓                                                          │
│  Usuário precisa clicar em "Tentar novamente" manualmente        │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo Proposto (Com Resiliência)

```text
┌─────────────────────────────────────────────────────────────────┐
│  Frontend envia mensagem                                         │
│       ↓                                                          │
│  Edge Function tenta enviar (até 3x com backoff exponencial)     │
│       ↓                                                          │
│  Tentativa 1 falha? → Aguarda 500ms → Tenta novamente            │
│  Tentativa 2 falha? → Aguarda 1500ms → Tenta novamente           │
│  Tentativa 3 falha? → Retorna erro (esgotou tentativas)          │
│       ↓                                                          │
│  Se ainda falhar: Frontend tenta reenvio automático (1x)         │
│       ↓                                                          │
│  Se ainda falhar: Mostra erro com botão de retry                 │
└─────────────────────────────────────────────────────────────────┘
```

## Solução em 3 Camadas

### Camada 1: Retry na Edge Function (Principal)

Implementar retry com exponential backoff diretamente na função `uazapiInstanceRequest`.

**Arquivo:** `supabase/functions/uazapi-manager/index.ts`

**Modificação:** Criar wrapper com retry automático para chamadas de envio de mensagem.

```typescript
// Nova função helper com retry
async function uazapiInstanceRequestWithRetry(
  endpoint: string, 
  method: string, 
  instanceToken: string, 
  body?: unknown,
  maxRetries: number = 3,
  baseDelayMs: number = 500
): Promise<unknown> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await uazapiInstanceRequest(endpoint, method, instanceToken, body);
    } catch (error) {
      lastError = error as Error;
      const errorMsg = lastError.message || "";
      
      // Don't retry for client errors (4xx) or known permanent failures
      const isPermanentError = 
        errorMsg.includes("WHATSAPP_DISCONNECTED") ||
        errorMsg.includes("Invalid phone") ||
        errorMsg.includes("formato inválido");
      
      if (isPermanentError) {
        console.log(`[RETRY] Permanent error, not retrying: ${errorMsg}`);
        throw lastError;
      }
      
      if (attempt < maxRetries) {
        // Exponential backoff: 500ms, 1500ms, 3500ms...
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`[RETRY] Attempt ${attempt}/${maxRetries} failed, retrying in ${delayMs}ms: ${errorMsg}`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.log(`[RETRY] All ${maxRetries} attempts failed: ${errorMsg}`);
      }
    }
  }
  
  throw lastError || new Error("Unknown error after retries");
}
```

**Aplicar na ação `send_text` (linha ~1753):**

```typescript
// Antes:
result = await uazapiInstanceRequest(`/send/text`, "POST", instanceToken, messageBody);

// Depois:
result = await uazapiInstanceRequestWithRetry(`/send/text`, "POST", instanceToken, messageBody);
```

### Camada 2: Retry Automático no Frontend (Backup)

Se a edge function ainda falhar após 3 tentativas, o frontend tenta uma vez mais automaticamente.

**Arquivo:** `src/pages/RoyZapp.tsx`

**Modificação:** Adicionar retry automático antes de marcar como falha.

```typescript
// Na função sendMessage, após o catch do erro:
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : "Erro ao enviar mensagem";
  
  // Auto-retry once on transient errors (antes de marcar como failed)
  if (!hasAutoRetried && isTransientError(errorMessage)) {
    console.log("[RoyZapp] Auto-retrying message send...");
    hasAutoRetried = true;
    await new Promise(r => setTimeout(r, 1000));
    // Recursively call sendMessage logic
    continue; // ou re-execute send logic
  }
  
  // Mark as failed only after auto-retry also fails
  setMessages(prev => prev.map(m => 
    m.id === tempMessageId 
      ? { ...m, send_status: "failed", send_error: userErrorMessage } 
      : m
  ));
}
```

### Camada 3: Melhorar Logs de Diagnóstico

Adicionar logs detalhados na edge function para facilitar debug de erros recorrentes.

**Arquivo:** `supabase/functions/uazapi-manager/index.ts`

**Modificação:** Adicionar contexto nos logs de erro.

```typescript
// Antes de lançar erro no uazapiInstanceRequest:
console.error(`[UAZAPI ERROR] Endpoint: ${endpoint}, Status: ${response.status}, ` +
  `Token: ${instanceToken?.slice(0,8)}..., Error: ${errorMsg}`);
```

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/uazapi-manager/index.ts` | Adicionar função `uazapiInstanceRequestWithRetry` com exponential backoff |
| `supabase/functions/uazapi-manager/index.ts` | Usar retry wrapper nas ações `send_text`, `send_media`, `send_to_group` |
| `src/pages/RoyZapp.tsx` | Adicionar auto-retry (1x) antes de marcar mensagem como falha |

## Parâmetros do Retry

| Parâmetro | Valor | Justificativa |
|-----------|-------|---------------|
| Max Retries | 3 | Suficiente para erros transitórios sem atrasar demais |
| Base Delay | 500ms | Permite UAZAPI se recuperar de sobrecarga |
| Backoff | Exponencial (2x) | 500ms → 1000ms → 2000ms |
| Timeout Total | ~3.5s máx | Dentro do limite de 10s de Edge Function |

## Erros que NÃO devem ser retentados

- `WHATSAPP_DISCONNECTED` - Requer reconexão manual
- `Invalid phone` / `formato inválido` - Problema nos dados
- HTTP 4xx - Erros de cliente (dados inválidos)

## Benefícios Esperados

1. **Redução de 80-90% dos erros visíveis** ao usuário
2. **Experiência mais fluida** - mensagens enviam sem intervenção manual
3. **Logs melhorados** para diagnosticar erros persistentes
4. **Fallback graceful** - mesmo se retry falhar, usuário ainda pode reenviar manualmente
