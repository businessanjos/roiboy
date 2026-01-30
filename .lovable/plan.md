
# Plano: Adicionar Horário e Disparo Automático de Mensagens para Momentos CX

## Objetivo
Adicionar a opção de selecionar **data + horário** para os Momentos CX (como aniversários) e implementar o **disparo automático** da mensagem de parabenização pelo WhatsApp da **Operação** na data e hora selecionadas, incluindo o envio das **imagens anexadas**.

---

## Visão Geral da Arquitetura

```text
+------------------+     +------------------------+     +----------------------+
|  Formulário CX   | --> |   client_life_events   | --> |  Cron Job (5 min)    |
|  (data + hora)   |     |  (scheduled_send_at)   |     |  process-cx-moments  |
+------------------+     +------------------------+     +----------------------+
                                                                   |
                                                                   v
                                                        +------------------------+
                                                        |  Edge Function         |
                                                        |  send-cx-moment-auto   |
                                                        +------------------------+
                                                                   |
                                                                   v
                                                        +------------------------+
                                                        |  UAZAPI - Operações    |
                                                        |  (texto + imagens)     |
                                                        +------------------------+
```

---

## Alterações Necessárias

### 1. Banco de Dados

Adicionar novas colunas na tabela `client_life_events`:

```sql
ALTER TABLE public.client_life_events 
ADD COLUMN scheduled_send_at TIMESTAMPTZ,
ADD COLUMN send_status TEXT DEFAULT 'pending' CHECK (send_status IN ('pending', 'scheduled', 'sent', 'failed', 'cancelled')),
ADD COLUMN sent_at TIMESTAMPTZ,
ADD COLUMN send_error TEXT,
ADD COLUMN integration_id UUID;
```

**Campos:**
- `scheduled_send_at`: Data e hora para envio automático (NULL = sem envio automático)
- `send_status`: Status do envio (pending, scheduled, sent, failed, cancelled)
- `sent_at`: Quando foi enviado
- `send_error`: Mensagem de erro se falhar
- `integration_id`: ID da integração WhatsApp usada para enviar

---

### 2. Frontend - ClientLifeEvents.tsx

**Novo campo de Data/Hora:**
- Substituir o campo `type="date"` por um campo combinado de data e hora
- Adicionar toggle "Enviar mensagem automaticamente"
- Quando ativado, mostrar campo de horário de envio

**Novo estado do formulário:**
```typescript
const [formSendTime, setFormSendTime] = useState("09:00");
const [formAutoSend, setFormAutoSend] = useState(false);
```

**Interface atualizada:**
```typescript
interface LifeEvent {
  // ... campos existentes
  scheduled_send_at: string | null;
  send_status: string;
  sent_at: string | null;
}
```

**Campos no formulário:**
1. Tipo de Momento
2. Título *
3. Data
4. **Horário de Envio** (quando auto-send ativo)
5. Mensagem *
6. Descrição (opcional)
7. Imagens (opcional)
8. Evento Recorrente
9. **Enviar Automaticamente** (toggle)

**Lógica de cálculo:**
- Para eventos recorrentes (aniversários), calcular a próxima ocorrência
- Combinar data + horário para gerar `scheduled_send_at`
- Exemplo: Aniversário 12/02/1988 às 09:00 → próximo envio: 12/02/2026 09:00

---

### 3. Nova Edge Function: `send-cx-moment-auto`

**Responsabilidades:**
1. Buscar Momentos CX com `scheduled_send_at <= now()` e `send_status = 'scheduled'`
2. Para cada momento:
   - Buscar dados do cliente (nome, telefone)
   - Buscar integração WhatsApp do setor **Operações**
   - Personalizar mensagem com variáveis
   - Enviar texto via UAZAPI
   - Enviar imagens anexadas (se houver)
   - Atualizar status para 'sent' ou 'failed'

**Seleção da Integração WhatsApp:**
```sql
SELECT * FROM integrations 
WHERE account_id = ? 
  AND type = 'whatsapp' 
  AND status = 'connected' 
  AND sector_id = 'operacoes'
LIMIT 1
```

**Envio de Mídia:**
- Usar endpoint `/send/media` da UAZAPI
- Enviar cada imagem com caption (primeira imagem pode ter a mensagem completa)

---

### 4. Cron Job para Processar Momentos

Criar cron job que roda a cada 5 minutos para processar momentos agendados:

```sql
SELECT cron.schedule(
  'process-cx-moments',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mtzoavtbtqflufyccern.supabase.co/functions/v1/send-cx-moment-auto',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <anon_key>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

### 5. Lógica de Recorrência

Para eventos recorrentes (aniversários), o sistema deve:

1. Após envio bem-sucedido, calcular próxima ocorrência (+1 ano)
2. Atualizar `scheduled_send_at` para o próximo ano
3. Resetar `send_status` para 'scheduled'

**Exemplo:**
- Aniversário: 12/02/1988
- Enviado em: 12/02/2026 09:00
- Próximo envio: 12/02/2027 09:00

---

## Fluxo de Usuário

1. Usuário abre formulário "Novo Momento CX"
2. Seleciona tipo: **Aniversário**
3. Preenche título: "Aniversário do João"
4. Seleciona data: 12/02/1988
5. Escreve mensagem: "Parabéns {primeiro_nome}! 🎂"
6. Anexa imagens de celebração
7. Ativa toggle **"Enviar automaticamente"**
8. Seleciona horário: **09:00**
9. Salva

**Resultado:**
- Momento salvo com `scheduled_send_at = 2026-02-12 09:00:00`
- No dia 12/02 às 09:00, o cron job dispara
- Cliente recebe mensagem + imagens pelo WhatsApp da Operação

---

## Indicadores Visuais

Na listagem de Momentos CX, mostrar status de envio:
- 🕐 **Agendado** - Badge azul com ícone de relógio
- ✅ **Enviado** - Badge verde com data/hora de envio
- ❌ **Falhou** - Badge vermelha com tooltip de erro
- ⏸️ **Pendente** - Sem badge (envio manual)

---

## Detalhes Técnicos

### Validações no handleSave:
```typescript
if (formAutoSend && !formDate) {
  toast.error("Data é obrigatória para envio automático");
  return;
}

if (formAutoSend && !formSendTime) {
  toast.error("Horário é obrigatório para envio automático");
  return;
}
```

### Cálculo de scheduled_send_at:
```typescript
const calculateScheduledSendAt = () => {
  if (!formAutoSend || !formDate) return null;
  
  const [year, month, day] = formDate.split('-').map(Number);
  const [hours, minutes] = formSendTime.split(':').map(Number);
  
  let sendDate = new Date(year, month - 1, day, hours, minutes);
  
  // Para eventos recorrentes, calcular próxima ocorrência
  if (formRecurring) {
    const today = new Date();
    sendDate.setFullYear(today.getFullYear());
    if (sendDate < today) {
      sendDate.setFullYear(today.getFullYear() + 1);
    }
  }
  
  return sendDate.toISOString();
};
```

### Envio de imagens via UAZAPI:
```typescript
// Para cada imagem anexada
for (const image of images) {
  await fetch(`${UAZAPI_URL}/send/media`, {
    method: "POST",
    headers: { "token": instanceToken },
    body: JSON.stringify({
      number: cleanPhone,
      type: "image",
      file: image.image_url,
      text: index === 0 ? personalizedMessage : "" // Só primeira imagem tem caption
    })
  });
}
```

---

## Arquivos a Modificar

1. **Banco de dados**: Migration para adicionar colunas
2. **src/components/client/ClientLifeEvents.tsx**: UI do formulário e listagem
3. **supabase/functions/send-cx-moment-auto/index.ts**: Nova edge function
4. **Cron job**: Agendar via SQL (não via migration)

---

## Considerações de Segurança

- Usar service role key na edge function para acessar dados de múltiplas contas
- Validar que o cliente pertence à mesma conta da integração
- Rate limiting: processar máximo de 10 momentos por execução
- Delay aleatório entre envios (3-10 segundos) para evitar bloqueio

---

## Fallbacks

- Se não houver WhatsApp da Operação conectado, marcar como 'failed' com erro descritivo
- Se imagem falhar mas texto enviar, marcar como 'sent' com nota de erro parcial
- Manter logs de todas as tentativas de envio
