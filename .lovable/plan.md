

## Correção: Polling de status separado da carga de dados

### Problema

Quando o status muda de "pending" para "approved", o polling chama `fetchApprovedData` que faz a Edge Function computar TODOS os visuais. Se essa computação falhar, demorar ou timeout:
1. `res.json()` lança exceção (ou retorna erro)
2. O `setInterval` não tem try-catch — a exceção é silenciada
3. O state nunca muda de "pending" para "approved"
4. O usuário fica preso em "Aguardando Aprovação" eternamente

### Solução

Separar o **check de status** (leve) da **carga de dados** (pesada):

**1. Edge Function (`supabase/functions/shared-dashboard/index.ts`)**
- Adicionar suporte ao query param `status_only=true` no GET handler
- Quando presente, após verificar que o acesso é "approved", retornar `{ status: "approved" }` imediatamente SEM computar visuais
- Path rápido: ~50ms em vez de potenciais segundos

**2. Frontend (`src/pages/SharedInsightsDashboard.tsx`)**

Polling (linhas 241-249):
- Trocar `fetchApprovedData` por uma chamada leve: `callEdge("GET", `?token=${token}&email=${email}&status_only=true`)`
- Adicionar try-catch no intervalo
- Quando status === "approved": setar state para "approved" e então chamar `fetchApprovedData` separadamente (com loading state)

```typescript
useEffect(() => {
  if (state !== "pending" || !token || !email) return;
  const interval = setInterval(async () => {
    try {
      const data = await callEdge("GET", `?token=${token}&email=${encodeURIComponent(email)}&status_only=true`);
      if (data.status === "approved") {
        setState("approved");
        clearInterval(interval);
        fetchApprovedData(filters, email);
      } else if (data.status === "rejected") {
        setState("rejected");
        clearInterval(interval);
      }
    } catch { /* ignore polling errors */ }
  }, 5000);
  return () => clearInterval(interval);
}, [state, token, email, callEdge, fetchApprovedData, filters]);
```

Edge Function — novo branch no GET:
```typescript
// After checking accessRequest.status === "approved"
const statusOnly = url.searchParams.get("status_only");
if (statusOnly === "true") {
  return new Response(JSON.stringify({ status: "approved" }), { ... });
}
// ... proceed with full visual computation
```

### Arquivos alterados
- `supabase/functions/shared-dashboard/index.ts` — adicionar branch `status_only`
- `src/pages/SharedInsightsDashboard.tsx` — polling leve com try-catch

