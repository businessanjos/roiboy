
# Correção: PIN Incorreto na Instância Jonathan Marcato

## Diagnóstico

A instância do Jonathan Marcato (ID: `ac869d1d-6564-4b4f-b2a4-753689b029aa`) possui um `pin_hash` armazenado no banco, mas a **ação de atualização de PIN não está implementada** na Edge Function `uazapi-manager`.

### Fluxo do Problema

```text
1. Jonathan tenta alterar PIN → Frontend chama "update_instance_pin"
2. Edge Function NÃO reconhece a ação → Retorna { success: true } sem fazer nada
3. Toast exibe "PIN atualizado" → Falsa confirmação
4. PIN antigo permanece no banco → Verificação sempre falha
```

---

## Solução

Implementar a ação `update_instance_pin` na Edge Function `uazapi-manager`.

### Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/uazapi-manager/index.ts` | Adicionar bloco `update_instance_pin` após `verify_instance_pin` |

### Código a Adicionar (após linha 202)

```typescript
} else if (action === "update_instance_pin") {
  // Validar integration_id
  if (!integration_id) {
    return new Response(
      JSON.stringify({ error: "integration_id é obrigatório" }), 
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  // Verificar se integração existe e pertence à conta
  const { data: int } = await supabase
    .from("integrations")
    .select("id")
    .eq("id", integration_id)
    .eq("account_id", accountId)
    .single();
    
  if (!int) {
    return new Response(
      JSON.stringify({ error: "Instância não encontrada" }), 
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  // Gerar hash do novo PIN ou null para remover
  let pinHash: string | null = null;
  if (payload.pin && payload.pin !== "null") {
    const h = await crypto.subtle.digest(
      'SHA-256', 
      new TextEncoder().encode(payload.pin + accountId)
    );
    pinHash = Array.from(new Uint8Array(h))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  // Atualizar no banco
  const { error: updateError } = await supabase
    .from("integrations")
    .update({ pin_hash: pinHash })
    .eq("id", integration_id)
    .eq("account_id", accountId);
    
  if (updateError) throw updateError;
  
  result = { success: true };
}
```

---

## Detalhes Técnicos

### Lógica de Hash

O PIN é armazenado como hash SHA-256 usando `pin + accountId` como entrada:

```typescript
SHA256(pin + accountId) → pin_hash
```

Isso garante que:
- PINs iguais em contas diferentes geram hashes diferentes
- O PIN nunca é armazenado em texto plano

### Fluxo Corrigido

```text
1. Jonathan altera PIN para "1234"
2. Frontend chama update_instance_pin com { pin: "1234" }
3. Edge Function gera hash: SHA256("1234" + accountId)
4. Atualiza integrations.pin_hash no banco
5. Próxima verificação usa o novo hash → Acesso liberado
```

---

## Resultado Esperado

Após a correção:
1. Jonathan poderá definir um novo PIN de 4 dígitos
2. O PIN será efetivamente salvo no banco de dados
3. A verificação funcionará com o novo PIN
4. Opção de remover PIN também funcionará (envia `pin: null`)
