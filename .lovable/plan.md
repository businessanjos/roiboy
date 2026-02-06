
# Plano de Correção: Mensagens Não Sendo Enviadas no ROY zAPP

## Diagnóstico Completo

### Problema Relatado
O vendedor **Jonathan Marcato** enviou uma mensagem pelo ROY zAPP, mas ela **não apareceu no WhatsApp** do celular dele. O sistema mostrou como "enviada" no ROY, porém não foi efetivamente transmitida.

### Causa Raiz Identificada
A Edge Function `uazapi-manager` foi simplificada excessivamente e contém **4 falhas críticas**:

| # | Problema | Impacto |
|---|----------|---------|
| 1 | **`integration_id` ignorado** | Frontend envia qual instância usar, mas função ignora |
| 2 | **Busca com `.maybeSingle()` falha** | Setor "vendas" tem 2 instâncias → erro PGRST116 → token = null |
| 3 | **Falha silenciosa** | Sem token, a ação não executa mas retorna `{success: true}` |
| 4 | **Sem validação de resposta HTTP** | Erros do UAZAPI não são detectados |

### Evidência Técnica
O setor "vendas" possui 2 integrações conectadas:
- `Jonathan Marcato` (ID: ac869d1d-...)
- `[COMERCIAL] Eternum Club` (ID: c3baa312-...)

Quando Jonathan envia mensagem, o frontend envia `integration_id: "ac869d1d-..."`, mas a função ignora e busca por `sector_id: "vendas"`, resultando em erro de múltiplos resultados.

---

## Solução Proposta

### Mudança 1: Priorizar `integration_id` na Busca
Modificar a lógica de busca para usar `integration_id` quando fornecido:

```typescript
const { action, sector_id, phone, message, group_id, integration_id } = payload;

// Buscar integração - PRIORIZAR integration_id
let intData = null;
if (integration_id) {
  // Busca direta por ID específico
  const { data } = await supabase
    .from("integrations")
    .select("id, config, status")
    .eq("id", integration_id)
    .eq("account_id", accountId)
    .single();
  intData = data;
} else if (sector_id) {
  // Fallback: primeira integração do setor
  const { data } = await supabase
    .from("integrations")
    .select("id, config, status")
    .eq("account_id", accountId)
    .eq("type", "whatsapp")
    .eq("sector_id", sector_id)
    .limit(1);
  intData = data?.[0];
} else {
  // Fallback: integração global
  const { data } = await supabase
    .from("integrations")
    .select("id, config, status")
    .eq("account_id", accountId)
    .eq("type", "whatsapp")
    .is("sector_id", null)
    .limit(1);
  intData = data?.[0];
}
```

### Mudança 2: Validar Token Antes de Prosseguir
Retornar erro explícito se não encontrar integração:

```typescript
const token = intData?.config?.instance_token;

// Ações que requerem token - validar antes
const tokenRequiredActions = ["send_text", "send_to_group", "list_groups", "disconnect"];
if (tokenRequiredActions.includes(action) && !token) {
  return new Response(JSON.stringify({ 
    error: "WhatsApp não configurado para este setor" 
  }), { 
    status: 400, 
    headers: { ...corsHeaders, "Content-Type": "application/json" } 
  });
}
```

### Mudança 3: Validar Resposta HTTP do UAZAPI
Modificar funções auxiliares para verificar erros:

```typescript
async function uazapiInstance(endpoint: string, method: string, token: string, body?: unknown) {
  const r = await fetch(`${UAZAPI_URL}${endpoint}`, { 
    method, 
    headers: { "Content-Type": "application/json", "token": token }, 
    body: body ? JSON.stringify(body) : undefined 
  });
  
  const json = await r.json();
  
  // Verificar erro na resposta
  if (!r.ok || json.error) {
    throw new Error(json.error || json.message || `UAZAPI error: ${r.status}`);
  }
  
  return json;
}
```

### Mudança 4: Adicionar Logs para Diagnóstico
Incluir console.log em pontos críticos:

```typescript
console.log(`[uazapi-manager] Action: ${action}, integration_id: ${integration_id}, sector_id: ${sector_id}`);
console.log(`[uazapi-manager] Found integration: ${intData?.id}, token: ${token ? "present" : "missing"}`);
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/uazapi-manager/index.ts` | Refatorar busca de integração, validar token, verificar respostas HTTP |

---

## Resultado Esperado

Após a correção:
1. Jonathan seleciona sua instância "Jonathan Marcato" no ROY zAPP
2. Frontend envia `integration_id: "ac869d1d-..."`
3. Edge Function busca diretamente por esse ID
4. Token correto é usado para enviar via UAZAPI
5. Mensagem aparece no WhatsApp do celular dele

Se algo der errado:
- Erro claro é retornado ao frontend
- Toast vermelho aparece para o usuário
- Mensagem fica marcada como "falha" no ROY

---

## Código Completo da Correção

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { 
  "Access-Control-Allow-Origin": "*", 
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" 
};
const UAZAPI_URL = Deno.env.get("UAZAPI_URL") || "";
const UAZAPI_ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN") || "";

async function uazapiAdmin(endpoint: string, method: string, body?: unknown) {
  const r = await fetch(`${UAZAPI_URL}${endpoint}`, { 
    method, 
    headers: { "Content-Type": "application/json", "admintoken": UAZAPI_ADMIN_TOKEN }, 
    body: body ? JSON.stringify(body) : undefined 
  });
  const json = await r.json();
  if (!r.ok && json.error) throw new Error(json.error);
  return json;
}

async function uazapiInstance(endpoint: string, method: string, token: string, body?: unknown) {
  const r = await fetch(`${UAZAPI_URL}${endpoint}`, { 
    method, 
    headers: { "Content-Type": "application/json", "token": token }, 
    body: body ? JSON.stringify(body) : undefined 
  });
  const json = await r.json();
  // Verificar erros do UAZAPI
  if (!r.ok || json.error) {
    throw new Error(json.error || json.message || `UAZAPI responded with ${r.status}`);
  }
  return json;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: userData } = await supabase.from("users").select("id, name, account_id, role, is_also_admin").eq("auth_user_id", user.id).single();
    if (!userData) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const payload = await req.json();
    const { action, sector_id, phone, message, group_id, integration_id } = payload;
    const accountId = userData.account_id;

    console.log(`[uazapi-manager] Action: ${action}, integration_id: ${integration_id}, sector_id: ${sector_id}`);

    // Buscar integração - PRIORIZAR integration_id
    let intData: { id: string; config: { instance_token?: string; instance_name?: string }; status: string } | null = null;
    
    if (integration_id) {
      const { data } = await supabase
        .from("integrations")
        .select("id, config, status")
        .eq("id", integration_id)
        .eq("account_id", accountId)
        .single();
      intData = data;
    } else if (sector_id) {
      const { data } = await supabase
        .from("integrations")
        .select("id, config, status")
        .eq("account_id", accountId)
        .eq("type", "whatsapp")
        .eq("sector_id", sector_id)
        .limit(1);
      intData = data?.[0] || null;
    } else {
      const { data } = await supabase
        .from("integrations")
        .select("id, config, status")
        .eq("account_id", accountId)
        .eq("type", "whatsapp")
        .is("sector_id", null)
        .limit(1);
      intData = data?.[0] || null;
    }

    const token = intData?.config?.instance_token;
    const instanceName = intData?.config?.instance_name || `roy-${accountId.slice(0,8)}`;

    console.log(`[uazapi-manager] Found integration: ${intData?.id || "NONE"}, token: ${token ? "present" : "MISSING"}`);

    // Ações que requerem token
    const tokenRequiredActions = ["send_text", "send_to_group", "list_groups", "disconnect"];
    if (tokenRequiredActions.includes(action) && !token) {
      console.error(`[uazapi-manager] Token required but missing for action: ${action}`);
      return new Response(JSON.stringify({ 
        error: "WhatsApp não configurado para este setor. Verifique as integrações." 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    let result: unknown = { success: true };

    if (action === "status") {
      const all = await uazapiAdmin("/instance/all", "GET") as Array<{name?:string;status?:string;owner?:string}>;
      const inst = all.find(i => i.name === instanceName);
      result = { state: inst?.status || "unknown", connected: inst?.status === "connected", owner: inst?.owner };
      if (intData?.id) await supabase.from("integrations").update({ status: inst?.status === "connected" ? "connected" : "disconnected" }).eq("id", intData.id);
    } else if (action === "create") {
      const r = await uazapiAdmin("/instance/init", "POST", { name: instanceName });
      const newToken = r.token || r.instance?.token;
      await supabase.from("integrations").upsert({ account_id: accountId, type: "whatsapp", sector_id: sector_id || null, status: "pending", config: { provider: "uazapi", instance_name: instanceName, instance_token: newToken } }, { onConflict: "account_id,type,sector_id" });
      result = { ...r, token: newToken };
    } else if (action === "connect" || action === "qrcode") {
      result = await uazapiAdmin(`/instance/connect/${instanceName}`, "GET");
    } else if (action === "disconnect") {
      try { await uazapiInstance("/logout", "POST", token!); } catch {}
      if (intData?.id) await supabase.from("integrations").update({ status: "disconnected" }).eq("id", intData.id);
      result = { disconnected: true };
    } else if (action === "send_text") {
      const cleanPhone = phone?.replace(/\D/g, "");
      if (!cleanPhone || cleanPhone.length < 10) {
        return new Response(JSON.stringify({ error: "Número de telefone inválido" }), { 
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }
      result = await uazapiInstance("/message/sendText", "POST", token!, { number: cleanPhone, text: message });
    } else if (action === "send_to_group") {
      const jid = group_id?.includes("@g.us") ? group_id : `${group_id}@g.us`;
      result = await uazapiInstance("/message/sendText", "POST", token!, { groupJid: jid, text: message });
    } else if (action === "list_groups") {
      const r = await uazapiInstance("/group/fetchAllGroups", "GET", token!);
      result = { groups: (Array.isArray(r) ? r : r.groups || []).map((g:any) => ({ group_jid: g.JID||g.jid||g.id, name: g.Name||g.name||g.Subject })) };
    } else if (action === "list_instances") {
      const all = await uazapiAdmin("/instance/all", "GET") as Array<{name?:string;status?:string;owner?:string}>;
      result = { instances: all.filter(i => i.name?.startsWith(`roy-${accountId.slice(0,8)}`)) };
    } else if (action === "list_sector_instances") {
      const { data: ints } = await supabase.from("integrations").select("id, sector_id, config, status, display_name, pin_hash").eq("account_id", accountId).eq("type", "whatsapp").not("sector_id", "is", null);
      result = { instances: (ints||[]).map((i:any) => ({ id: i.id, sector_id: i.sector_id, instance_name: i.config?.instance_name, status: i.status, has_pin: !!i.pin_hash })) };
    } else if (action === "add_instance_to_sector") {
      const all = await uazapiAdmin("/instance/all", "GET") as Array<{name?:string;token?:string;status?:string;owner?:string}>;
      const inst = all.find(i => i.name === payload.instance_name);
      if (!inst) return new Response(JSON.stringify({ error: "Instance not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      await supabase.from("integrations").insert({ account_id: accountId, type: "whatsapp", sector_id, status: inst.status === "connected" ? "connected" : "disconnected", config: { provider: "uazapi", instance_name: payload.instance_name, instance_token: inst.token, owner: inst.owner } });
      result = { success: true };
    } else if (action === "verify_instance_pin") {
      const { data: int } = await supabase.from("integrations").select("pin_hash").eq("id", payload.integration_id).single();
      if (!int?.pin_hash) result = { valid: true };
      else {
        const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload.pin + accountId));
        result = { valid: Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('') === int.pin_hash };
      }
    }

    return new Response(JSON.stringify({ data: result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[uazapi-manager] Error:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
```

---

## Nota Técnica

Esta é uma correção urgente focada em **restaurar o envio de mensagens**. Funcionalidades adicionais como:
- Envio de mídia (`send_media`)
- Respostas com citação (`quoted_message_id`)
- Edição/exclusão de mensagens

Podem ser adicionadas em uma atualização posterior se necessário.
