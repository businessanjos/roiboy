
# Plano: Corrigir Erro de Envio de Mensagens com Múltiplas Instâncias WhatsApp

## Problema Identificado

O time de Operações (e Vendas) enfrenta o erro "Edge Function returned a non-2xx status code" ao tentar enviar mensagens. A investigação revelou:

### Causa Raiz Técnica

O setor **Vendas** possui **2 integrações de WhatsApp** simultaneamente:
- `[COMERCIAL] Eternum Club` (c3baa312-78b9-400f-802a-705d56731f90)
- `Whatsapp Jota` (026d6fef-8c3b-4e65-8a9f-68f5d9f9fbf6)

Quando o frontend não especifica qual instância usar via `integration_id`, a Edge Function busca por `sector_id` usando `maybeSingle()`. Esta função **retorna erro quando encontra mais de uma row**, causando falha no envio.

### Fluxo do Erro

```text
1. Usuário tenta enviar mensagem
2. Frontend chama uazapi-manager com sector_id: "vendas" (sem integration_id)
3. Edge Function executa: .eq("sector_id", "vendas").maybeSingle()
4. Supabase encontra 2 rows → retorna ERRO (não data)
5. existingWhatsapp fica null, savedInstanceToken fica undefined
6. A ação send_text falha ou usa fallback incorreto
7. Erro 500 retornado → "Edge Function returned a non-2xx status code"
```

## Solução: Três Correções

### 1. Edge Function: Trocar `maybeSingle()` por `.limit(1)` 

**Arquivo**: `supabase/functions/uazapi-manager/index.ts` (linhas 365-384)

Modificar a query para retornar a **primeira integração encontrada** em vez de falhar quando há múltiplas:

```typescript
// ANTES (PROBLEMÁTICO)
const { data, error: existingError } = await integrationQuery.maybeSingle();
existingWhatsapp = data;

// DEPOIS (SEGURO)
// Use limit(1) para pegar a primeira integração quando há múltiplas
const { data: integrations, error: existingError } = await integrationQuery.limit(1);
if (existingError) {
  console.error(`[UAZAPI] Error fetching integration: ${existingError.message}`);
}
existingWhatsapp = integrations?.[0] || null;

// Log warning when there might be multiple integrations
if (existingWhatsapp && !integration_id) {
  console.warn(`[UAZAPI] Using first integration found. For sectors with multiple instances, specify integration_id to avoid ambiguity.`);
}
```

### 2. Edge Function: Aplicar mesma correção no fallback de `send_text`

**Arquivo**: `supabase/functions/uazapi-manager/index.ts` (linhas 1631-1649)

Este bloco já usa `.limit(1)` corretamente, mas devemos garantir consistência e adicionar log de warning:

```typescript
// Já está correto, mas adicionar warning para debug
if (integration_id) {
  console.log(`[send_text] Using specific integration_id: ${integration_id}`);
  sendTextIntQuery = sendTextIntQuery.eq("id", integration_id);
} else {
  // Warning: setor pode ter múltiplas instâncias
  console.warn(`[send_text] No integration_id provided, using first integration for sector: ${sector_id || 'default'}`);
  if (sector_id) {
    sendTextIntQuery = sendTextIntQuery.eq("sector_id", sector_id);
  } else {
    sendTextIntQuery = sendTextIntQuery.is("sector_id", null);
  }
}
```

### 3. Frontend: Garantir que `integration_id` seja sempre definido

**Arquivo**: `src/hooks/useZappData.tsx`

Quando há múltiplas instâncias, o hook deve garantir que busque a preferência do usuário automaticamente:

Verificar se o `integrationId` está sendo passado corretamente quando o usuário abre uma conversa. Se não, o hook pode buscar a preferência salva do usuário ou usar a primeira instância conectada.

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/uazapi-manager/index.ts` | Trocar `maybeSingle()` por `.limit(1)` na linha ~381; adicionar warnings para debug |

## Código Específico da Correção Principal

A mudança principal é simples e cirúrgica:

```typescript
// Linha ~365-384 - SUBSTITUIR maybeSingle por limit(1)
} else {
  // Fallback to sector_id based lookup
  let integrationQuery = supabase
    .from("integrations")
    .select("config, status, sector_id, id")
    .eq("account_id", accountId)
    .eq("type", "whatsapp");
  
  // CRITICAL: sector_id can be null for default sector
  if (sector_id) {
    integrationQuery = integrationQuery.eq("sector_id", sector_id);
  } else {
    // For default sector, explicitly match null sector_id
    integrationQuery = integrationQuery.is("sector_id", null);
  }
  
  // FIX: Use limit(1) instead of maybeSingle() to handle multiple integrations gracefully
  const { data: integrations, error: existingError } = await integrationQuery.limit(1);
  existingWhatsapp = integrations?.[0] || null;
  
  if (existingError) {
    console.error(`[UAZAPI] Error fetching integration:`, existingError.message);
  }
  
  // Warn about potential ambiguity with multiple instances
  if (existingWhatsapp && !integration_id) {
    console.warn(`[UAZAPI] Action: ${action}, Sector: ${sector_id || 'default'} - Using first integration. Consider specifying integration_id for sectors with multiple instances.`);
  }
  
  console.log(`[UAZAPI] Action: ${action}, Sector: ${sector_id || 'default'}, Integration found:`, existingWhatsapp ? `ID=${existingWhatsapp.id}` : 'none');
}
```

## Impacto e Testes

| Cenário | Antes | Depois |
|---------|-------|--------|
| Setor com 1 instância | Funciona | Funciona |
| Setor com 2+ instâncias (com integration_id) | Funciona | Funciona |
| Setor com 2+ instâncias (SEM integration_id) | **ERRO 500** | Usa primeira instância |
| Setor sem instância | Erro claro | Erro claro |

## Por que essa correção resolve o problema definitivamente

1. **`maybeSingle()` é rígido**: Falha quando há mais de 1 resultado (comportamento intencional do Supabase)
2. **`.limit(1)` é flexível**: Retorna apenas 1 resultado independente de quantos existam
3. **Backward compatible**: O código já funciona quando `integration_id` é especificado
4. **Logging melhorado**: Warnings ajudam a identificar uso incorreto sem quebrar a aplicação
