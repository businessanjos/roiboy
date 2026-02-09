
# Expandir get-client-by-phone para buscar tambem na tabela Leads

## Causa Raiz
A Edge Function `get-client-by-phone` consulta apenas a tabela `clients` (coluna `phone_e164`). O registro da Tatiane Ferreira esta na tabela `leads` (coluna `phone`), que nao e consultada. Por isso retorna `found: false`.

## Solucao

Modificar a Edge Function `get-client-by-phone` para buscar em **ambas** as tabelas: primeiro em `clients`, depois em `leads`.

## Logica Proposta

```text
1. Recebe phone_e164 (normalizado)
2. Busca na tabela clients (por phone_e164) -> se encontrar, retorna found: true, type: "client"
3. Se nao encontrar, busca na tabela leads (por phone) -> se encontrar, retorna found: true, type: "lead"
4. Se nao encontrar em nenhuma, retorna found: false
```

## Mudancas Tecnicas

**Arquivo:** `supabase/functions/get-client-by-phone/index.ts`

### 1. Adicionar busca na tabela leads (apos a busca em clients)

Se o cliente nao for encontrado, buscar na tabela `leads`:

```typescript
// Se nao encontrou em clients, buscar em leads
if (!client) {
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, full_name, phone, status, tags, email, instagram, source")
    .eq("phone", phone)
    .eq("account_id", auth.accountId)
    .maybeSingle();

  if (lead) {
    // Retornar lead encontrado
    return new Response(JSON.stringify({
      found: true,
      type: "lead",
      lead: {
        id: lead.id,
        full_name: lead.full_name,
        phone: lead.phone,
        status: lead.status,
        tags: lead.tags,
        email: lead.email,
        instagram: lead.instagram,
        source: lead.source,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}
```

### 2. Adicionar campo `type` na resposta de clients

Quando encontrar um client, incluir `type: "client"` na resposta para diferenciar.

### 3. Buscar tambem em additional_phones dos leads

Alem do campo `phone`, verificar se o numero aparece no array `additional_phones` da tabela leads.

## Formato da Resposta

**Lead encontrado:**
```json
{
  "found": true,
  "type": "lead",
  "lead": {
    "id": "...",
    "full_name": "Tatiane Ferreira",
    "phone": "+5561998662638",
    "status": "novo",
    "email": "...",
    "instagram": "...",
    "source": "..."
  }
}
```

**Cliente encontrado (como ja funciona, com type adicionado):**
```json
{
  "found": true,
  "type": "client",
  "client": { ... },
  "scores": { ... },
  "risk_events": [],
  "recent_events": [],
  "recommendations": []
}
```

**Nenhum encontrado:**
```json
{ "found": false }
```

## Impacto
- Retrocompativel: respostas de client continuam iguais, apenas com campo `type` adicionado
- No n8n, voce podera usar o campo `type` para diferenciar se e lead ou cliente
- Nenhuma mudanca no frontend
