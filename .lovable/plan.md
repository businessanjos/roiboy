
# Diagnóstico: Mensagens Não Sendo Enviadas no ROY zAPP

## Resumo do Problema

O usuário está vendo o erro **"Edge Function returned a non-2xx status code"** ao tentar enviar mensagens no ROY zAPP. A mensagem aparece como "enviada" visualmente no chat mas retorna erro 500.

---

## Causa Raiz Identificada

### Erro nos Logs:
```
[uazapi-manager] Error: Method Not Allowed.
```

### O que acontece:

1. A Edge Function `uazapi-manager` foi recentemente simplificada
2. O endpoint usado está **INCORRETO**: `/message/sendText` 
3. O endpoint correto do UAZAPI GO v2 é: `/send/text`
4. O UAZAPI retorna "Method Not Allowed" porque esse endpoint não existe

### Evidência Técnica:

**Código atual (INCORRETO):**
```typescript
// Linha 132 - supabase/functions/uazapi-manager/index.ts
result = await uazapiInstance("/message/sendText", "POST", token!, { number: cleanPhone, text: message });
```

**Código que FUNCIONA (referência send-reminder e test-cx-moment-send):**
```typescript
// supabase/functions/send-reminder/index.ts
const apiUrl = `${UAZAPI_URL}/send/text`;  // ✅ Endpoint correto
const response = await fetch(apiUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "token": whatsappConfig.instance_token,  // ✅ lowercase "token"
  },
  body: JSON.stringify({ number: cleanPhone, text: personalizedMessage }),
});
```

---

## Lista de Problemas Encontrados

| # | Problema | Impacto |
|---|----------|---------|
| 1 | **Endpoint errado para texto** | `/message/sendText` → deve ser `/send/text` |
| 2 | **Falta suporte a mídia** | `send_media` não implementado → imagens/arquivos não enviam |
| 3 | **Falta suporte a grupos** | Endpoint de grupo também está errado |
| 4 | **Falta respostas com citação** | `quoted_message_id` ignorado |
| 5 | **Verificação de sucesso incorreta** | UAZAPI retorna `{ error: false }` em sucesso, não status HTTP |

---

## Solução Proposta

### Mudanças Necessárias:

**1. Corrigir endpoint de envio de texto:**
```typescript
// DE:
result = await uazapiInstance("/message/sendText", "POST", token!, { number: cleanPhone, text: message });

// PARA:
result = await uazapiInstance("/send/text", "POST", token!, { 
  number: cleanPhone, 
  text: message,
  ...(payload.quoted_message_id ? { quotedMsgId: payload.quoted_message_id } : {})
});
```

**2. Adicionar suporte a envio de mídia:**
```typescript
} else if (action === "send_media") {
  const cleanPhone = phone?.replace(/\D/g, "");
  if (!cleanPhone || cleanPhone.length < 10) {
    return new Response(JSON.stringify({ error: "Número de telefone inválido" }), { 
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
  result = await uazapiInstance("/send/media", "POST", token!, { 
    number: cleanPhone, 
    type: payload.media_type || "image",
    file: payload.media_url,
    text: payload.caption || "",
    ...(payload.quoted_message_id ? { quotedMsgId: payload.quoted_message_id } : {})
  });
```

**3. Corrigir endpoint de envio para grupos:**
```typescript
// DE:
result = await uazapiInstance("/message/sendText", "POST", token!, { groupJid: jid, text: message });

// PARA:
result = await uazapiInstance("/send/text", "POST", token!, { 
  groupJid: jid, 
  text: message 
});
```

**4. Adicionar suporte a mídia em grupos:**
```typescript
} else if (action === "send_media_to_group") {
  const jid = group_id?.includes("@g.us") ? group_id : `${group_id}@g.us`;
  result = await uazapiInstance("/send/media", "POST", token!, { 
    groupJid: jid, 
    type: payload.media_type || "image",
    file: payload.media_url,
    text: payload.caption || ""
  });
```

**5. Melhorar verificação de sucesso do UAZAPI:**
```typescript
async function uazapiInstance(endpoint: string, method: string, token: string, body?: unknown) {
  const r = await fetch(`${UAZAPI_URL}${endpoint}`, { 
    method, 
    headers: { "Content-Type": "application/json", "token": token }, 
    body: body ? JSON.stringify(body) : undefined 
  });
  const json = await r.json();
  
  // UAZAPI retorna { error: false } quando sucesso, não usa HTTP status
  if (json.error === true || json.error === "true") {
    throw new Error(json.message || json.error_message || `UAZAPI error: ${r.status}`);
  }
  
  // "Method Not Allowed" significa endpoint errado
  if (json.message === "Method Not Allowed" || r.status === 405) {
    throw new Error(`Endpoint inválido ou método incorreto: ${endpoint}`);
  }
  
  return json;
}
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/uazapi-manager/index.ts` | Corrigir endpoints, adicionar suporte a mídia, melhorar validação |

---

## Resultado Esperado

Após a correção:
1. Mensagens de texto serão enviadas corretamente via `/send/text`
2. Imagens, documentos e áudios funcionarão via `/send/media`
3. Mensagens em grupos funcionarão corretamente
4. Respostas com citação (`quotedMsgId`) serão enviadas
5. Erros claros serão retornados ao frontend em caso de falha

---

## Código Completo Atualizado

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { 
  "Access-Control-Allow-Origin": "*", 
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" 
};
const UAZAPI_URL = (Deno.env.get("UAZAPI_URL") || "").replace(/\/$/, ''); // Remove trailing slash
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
  console.log(`[uazapi] Calling: ${method} ${UAZAPI_URL}${endpoint}`);
  const r = await fetch(`${UAZAPI_URL}${endpoint}`, { 
    method, 
    headers: { "Content-Type": "application/json", "token": token }, 
    body: body ? JSON.stringify(body) : undefined 
  });
  
  const responseText = await r.text();
  console.log(`[uazapi] Response: ${r.status} - ${responseText.substring(0, 300)}`);
  
  let json: any;
  try {
    json = JSON.parse(responseText);
  } catch {
    throw new Error(`Resposta inválida do WhatsApp: ${responseText.substring(0, 100)}`);
  }
  
  // UAZAPI retorna { error: false } em sucesso, { error: true } em falha
  if (json.error === true || json.error === "true") {
    throw new Error(json.message || json.error_message || "Erro ao enviar mensagem");
  }
  
  // "Method Not Allowed" = endpoint errado
  if (json.message === "Method Not Allowed" || r.status === 405) {
    throw new Error(`Endpoint inválido: ${endpoint}`);
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
      const { data } = await supabase.from("integrations").select("id, config, status").eq("id", integration_id).eq("account_id", accountId).single();
      intData = data;
    } else if (sector_id) {
      const { data } = await supabase.from("integrations").select("id, config, status").eq("account_id", accountId).eq("type", "whatsapp").eq("sector_id", sector_id).limit(1);
      intData = data?.[0] || null;
    } else {
      const { data } = await supabase.from("integrations").select("id, config, status").eq("account_id", accountId).eq("type", "whatsapp").is("sector_id", null).limit(1);
      intData = data?.[0] || null;
    }

    const token = intData?.config?.instance_token;
    const instanceName = intData?.config?.instance_name || `roy-${accountId.slice(0,8)}`;

    console.log(`[uazapi-manager] Found integration: ${intData?.id || "NONE"}, token: ${token ? "present" : "MISSING"}`);

    // Ações que requerem token
    const tokenRequiredActions = ["send_text", "send_media", "send_to_group", "send_media_to_group", "list_groups", "disconnect"];
    if (tokenRequiredActions.includes(action) && !token) {
      console.error(`[uazapi-manager] Token required but missing for action: ${action}`);
      return new Response(JSON.stringify({ error: "WhatsApp não configurado para este setor." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      // ✅ CORRIGIDO: Usar /send/text em vez de /message/sendText
      const cleanPhone = phone?.replace(/\D/g, "");
      if (!cleanPhone || cleanPhone.length < 10) {
        return new Response(JSON.stringify({ error: "Número de telefone inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      const textBody: Record<string, unknown> = { number: cleanPhone, text: message };
      if (payload.quoted_message_id) textBody.quotedMsgId = payload.quoted_message_id;
      if (payload.mentions) textBody.mentions = payload.mentions;
      
      result = await uazapiInstance("/send/text", "POST", token!, textBody);
    
    } else if (action === "send_media") {
      // ✅ NOVO: Suporte a envio de mídia
      const cleanPhone = phone?.replace(/\D/g, "");
      if (!cleanPhone || cleanPhone.length < 10) {
        return new Response(JSON.stringify({ error: "Número de telefone inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      const mediaBody: Record<string, unknown> = { 
        number: cleanPhone, 
        type: payload.media_type || "image",
        file: payload.media_url,
        text: payload.caption || ""
      };
      if (payload.quoted_message_id) mediaBody.quotedMsgId = payload.quoted_message_id;
      if (payload.file_name) mediaBody.fileName = payload.file_name;
      
      result = await uazapiInstance("/send/media", "POST", token!, mediaBody);
    
    } else if (action === "send_to_group") {
      // ✅ CORRIGIDO: Usar /send/text para grupos
      const jid = group_id?.includes("@g.us") ? group_id : `${group_id}@g.us`;
      
      const groupBody: Record<string, unknown> = { groupJid: jid, text: message };
      if (payload.quoted_message_id) groupBody.quotedMsgId = payload.quoted_message_id;
      if (payload.mentions) groupBody.mentions = payload.mentions;
      
      result = await uazapiInstance("/send/text", "POST", token!, groupBody);
    
    } else if (action === "send_media_to_group") {
      // ✅ NOVO: Mídia em grupos
      const jid = group_id?.includes("@g.us") ? group_id : `${group_id}@g.us`;
      
      const mediaBody: Record<string, unknown> = { 
        groupJid: jid, 
        type: payload.media_type || "image",
        file: payload.media_url,
        text: payload.caption || ""
      };
      if (payload.quoted_message_id) mediaBody.quotedMsgId = payload.quoted_message_id;
      if (payload.file_name) mediaBody.fileName = payload.file_name;
      
      result = await uazapiInstance("/send/media", "POST", token!, mediaBody);
    
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

## Resumo das Correções

| Problema | Antes | Depois |
|----------|-------|--------|
| Endpoint texto | `/message/sendText` | `/send/text` |
| Endpoint mídia | Não existia | `/send/media` |
| Grupos texto | `/message/sendText` | `/send/text` |
| Grupos mídia | Não existia | `/send/media` |
| Citações | Ignorado | `quotedMsgId` |
| Menções | Ignorado | `mentions` |
| Validação resposta | Só HTTP status | Verifica `json.error` |
