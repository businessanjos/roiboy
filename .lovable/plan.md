
# Plano: Correção de Erros de Envio de Mensagens no ROY zAPP - Setor Operações

## Diagnóstico Completo

Após investigação detalhada dos logs e banco de dados, identifiquei os seguintes problemas:

### Problema 1: Número de Telefone com Formato Inválido

**Situação encontrada:**
- A conversa da cliente "Jéssica Almeida Marcato" tem o telefone `+97461465018463`
- O código de país 974 pertence ao **Qatar**, não ao Brasil
- Isso causa falha no UAZAPI ao tentar enviar mensagens

**Causa raiz:**
- O telefone foi salvo incorretamente no banco de dados (tanto na tabela `clients` quanto em `zapp_conversations`)
- Quando o UAZAPI tenta enviar para esse número, ele falha porque é um número inválido/não existente no WhatsApp

### Problema 2: Erro "Could not parse Group JID" (separado)

**Este erro está relacionado à busca de participantes de grupos, não ao envio de mensagens diretas**
- O sistema tenta buscar informações de grupo com JIDs malformados em alguns casos
- Isso acontece na ação `group_participants` quando um `group_id` inválido é passado

---

## Soluções Propostas

### Correção 1: Melhorar Tratamento de Erros no Frontend

**Arquivo:** `src/pages/RoyZapp.tsx`

Adicionar detecção de erros específicos do UAZAPI para números inválidos e mostrar mensagens mais informativas:

```typescript
// Adicionar detecção para números inválidos
const isInvalidNumber = errorMsg.includes("invalid") || 
                        errorMsg.includes("Could not parse") ||
                        errorMsg.includes("not valid") ||
                        errorMsg.includes("número inválido");

// Na lógica de mensagem:
if (isInvalidNumber) {
  userErrorMessage = "Número de telefone inválido ou não registrado no WhatsApp";
}
```

### Correção 2: Adicionar Validação de Telefone no Backend

**Arquivo:** `supabase/functions/uazapi-manager/index.ts`

Adicionar validação básica de formato de número antes de enviar ao UAZAPI:

```typescript
// No case "send_text":
const cleanPhone = phone.replace(/\D/g, "");

// Validar formato básico (mínimo 10 dígitos, máximo 15)
if (cleanPhone.length < 10 || cleanPhone.length > 15) {
  return new Response(
    JSON.stringify({ error: "Número de telefone com formato inválido" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### Correção 3: Proteger Busca de Participantes de Grupo

**Arquivo:** `supabase/functions/uazapi-manager/index.ts`

Adicionar validação do `group_id` antes de chamar o UAZAPI para evitar erros "Could not parse Group JID":

```typescript
// No case "group_participants":
if (!group_id || group_id.trim() === "") {
  throw new Error("ID do grupo é obrigatório");
}

// Validar formato básico do group_id
const groupIdClean = group_id.trim();
if (!groupIdClean.match(/^\d+@g\.us$/) && !groupIdClean.match(/^\d+-\d+@g\.us$/) && !groupIdClean.match(/^\d+$/)) {
  return new Response(
    JSON.stringify({ error: "Formato de ID de grupo inválido" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### Correção 4: Melhorar Mensagem de Erro para o Usuário

**Arquivo:** `src/pages/RoyZapp.tsx`

Modificar o catch handler para extrair a mensagem de erro do JSON retornado pela Edge Function:

```typescript
} catch (error: any) {
  console.error("Error sending message:", error);
  
  // Tentar extrair mensagem de erro do response body
  let errorMsg = error.message || "Erro ao enviar mensagem";
  
  // Se for erro de Edge Function, tentar parsear o JSON interno
  if (error.context?.body) {
    try {
      const errorBody = JSON.parse(error.context.body);
      if (errorBody.error) {
        errorMsg = errorBody.error;
      }
    } catch {}
  }
  
  // ... resto do código de tratamento
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/RoyZapp.tsx` | Melhorar parsing de erros e adicionar detecção de números inválidos |
| `supabase/functions/uazapi-manager/index.ts` | Adicionar validação de formato de telefone e group_id |

---

## Ação Imediata Recomendada (Manual)

O telefone da cliente "Jéssica Almeida Marcato" (`+97461465018463`) parece estar incorreto. Para resolver o problema imediatamente:

1. Corrigir o telefone no cadastro do cliente (provavelmente deveria ser `+55...`)
2. A conversa será automaticamente atualizada pelo trigger existente

---

## Resumo Técnico

1. **Frontend** receberá mensagens de erro mais claras do backend
2. **Backend** validará números e group_ids antes de chamar o UAZAPI
3. **Números inválidos** serão rejeitados com mensagem amigável
4. **Grupos com JID malformado** não causarão mais crashes

## Impacto Esperado

- Usuários verão mensagens de erro claras em português
- Erros silenciosos serão eliminados
- O sistema será mais resiliente a dados malformados
