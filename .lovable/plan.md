
# Plano: Edge Function de Teste Manual para Momentos CX

## Objetivo
Criar uma edge function que permite enviar um Momento CX para um número de telefone customizado (diferente do cliente) para fins de teste, e adicionar um botão discreto no dialog de edição para acionar esse teste.

---

## Arquitetura da Solução

### 1. Nova Edge Function: `test-cx-moment-send`

**Localização:** `supabase/functions/test-cx-moment-send/index.ts`

**Parâmetros de entrada:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `life_event_id` | uuid | ID do momento CX a testar |
| `test_phone` | string | Número de telefone para receber o teste (formato E.164) |

**Fluxo:**

```text
1. Receber life_event_id + test_phone
           |
           v
2. Buscar dados do momento CX
   - message, title, event_type
   - images anexadas
           |
           v
3. Buscar dados do cliente
   - full_name (para substituir variáveis)
           |
           v
4. Buscar integração WhatsApp ativa
   - Tabela: integrations (config JSONB)
   - Filtro: type=whatsapp, status=connected, sector_id=operacoes
           |
           v
5. Personalizar mensagem
   - Substituir {nome}, {primeiro_nome}, {momento_titulo}
           |
           v
6. Enviar via uazapi
   - Texto primeiro
   - Depois imagens (se houver)
           |
           v
7. Retornar resultado (success/error)
   - NÃO atualiza status do momento
```

### 2. Correção do Schema de Integração

A função usará a tabela `integrations` corretamente:

```typescript
// Buscar integração WhatsApp
const { data: integrations } = await supabase
  .from("integrations")
  .select("id, config, sector_id")
  .eq("account_id", moment.account_id)
  .eq("type", "whatsapp")
  .eq("status", "connected")
  .eq("sector_id", "operacoes")
  .limit(1);

const integration = integrations?.[0];
if (!integration) {
  // Fallback para qualquer integração ativa
  const { data: fallback } = await supabase
    .from("integrations")
    .select("id, config, sector_id")
    .eq("account_id", moment.account_id)
    .eq("type", "whatsapp")
    .eq("status", "connected")
    .limit(1);
  integration = fallback?.[0];
}

// Extrair dados do config JSONB
const provider = integration.config?.provider; // "uazapi"
const instanceToken = integration.config?.instance_token;
const apiUrl = UAZAPI_URL; // Variável de ambiente
```

### 3. Botão de Teste no Dialog

**Localização:** `src/components/client/ClientLifeEvents.tsx`

**Posição:** No `DialogFooter`, antes do botão "Cancelar", um botão discreto (ghost/link style)

**Comportamento:**
- Só aparece ao EDITAR um momento existente (`editingEvent !== null`)
- Só aparece se `formAutoSend` estiver ativo
- Abre um mini-dialog/popover para inserir o número de teste
- Valida formato do telefone
- Chama a edge function

**UI Mock:**

```text
┌─────────────────────────────────────────────────┐
│                DialogFooter                      │
├─────────────────────────────────────────────────┤
│ [🔬 Testar envio]   [Cancelar]  [Salvar]        │
│                          ↓                       │
│              ┌──────────────────────────┐        │
│              │ Número para teste:       │        │
│              │ [+5531971237088        ] │        │
│              │ [Enviar Teste]           │        │
│              └──────────────────────────┘        │
└─────────────────────────────────────────────────┘
```

---

## Alterações em Arquivos

### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/test-cx-moment-send/index.ts` | Edge function de teste manual |

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/config.toml` | Adicionar configuração `verify_jwt = false` |
| `src/components/client/ClientLifeEvents.tsx` | Adicionar botão de teste + popover + handler |

---

## Detalhes da Implementação

### Edge Function: Envio de Mensagem

```typescript
// Enviar texto via UAZAPI
const cleanPhone = testPhone.replace(/\D/g, "");

const textResponse = await fetch(`${UAZAPI_URL}/sendText`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${instanceToken}`,
  },
  body: JSON.stringify({
    phone: cleanPhone,
    message: personalizedMessage,
  }),
});

// Enviar imagens (se houver)
for (const image of images) {
  await new Promise(resolve => setTimeout(resolve, 2000)); // Delay
  
  await fetch(`${UAZAPI_URL}/sendMedia`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${instanceToken}`,
    },
    body: JSON.stringify({
      phone: cleanPhone,
      type: "image",
      media: image.image_url,
      caption: "",
    }),
  });
}
```

### Frontend: Handler de Teste

```typescript
const [testDialogOpen, setTestDialogOpen] = useState(false);
const [testPhone, setTestPhone] = useState("+55");
const [sendingTest, setSendingTest] = useState(false);

const handleTestSend = async () => {
  if (!editingEvent || !testPhone.trim()) return;
  
  setSendingTest(true);
  try {
    const { data, error } = await supabase.functions.invoke("test-cx-moment-send", {
      body: {
        life_event_id: editingEvent.id,
        test_phone: testPhone,
      },
    });
    
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    
    toast.success("Teste enviado com sucesso!");
    setTestDialogOpen(false);
  } catch (error) {
    toast.error(error.message || "Erro ao enviar teste");
  } finally {
    setSendingTest(false);
  }
};
```

---

## Segurança

- A edge function valida que o usuário tem acesso ao `account_id` do momento
- Usa `verify_jwt = false` mas valida o token manualmente via `getClaims()`
- Não modifica o status do momento (apenas leitura + envio externo)
- Logs de teste não são persistidos como envios oficiais

---

## Benefícios

1. **Teste seguro**: Não altera o status do momento original
2. **Número customizado**: Permite testar em qualquer número
3. **Discreto**: Botão só aparece para momentos existentes com auto-send
4. **Completo**: Testa texto + imagens exatamente como seria enviado
5. **Diagnóstico**: Retorna erros detalhados para debugging
